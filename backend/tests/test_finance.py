"""Tests for the financial engine.

Expected EMIs are checked two ways: against published textbook values, and
against an independent float implementation of the closed-form formula.
"""

from decimal import Decimal

import pytest

from app.finance import (
    LoanInput,
    LoanInputError,
    aggregate_schedules,
    calculate_loan,
    compare_loans,
    compute_emi,
)


def independent_emi(p: float, annual_pct: float, n: int) -> float:
    r = annual_pct / 1200
    if r == 0:
        return p / n
    return p * r * (1 + r) ** n / ((1 + r) ** n - 1)


def check_schedule_invariants(result):
    s = result.summary
    sched = result.schedule
    assert len(sched) == result.input.tenure_months
    assert sched[-1].closing_balance == Decimal("0")
    assert sum(r.principal for r in sched) == result.input.principal
    assert s.total_payment == s.principal + s.total_interest
    assert s.total_outflow == s.total_payment + s.fee_amount
    assert s.total_borrowing_cost == s.total_interest + s.fee_amount
    for prev, row in zip(sched, sched[1:]):
        assert row.opening_balance == prev.closing_balance
    for row in sched:
        assert row.payment == row.principal + row.interest
        assert row.closing_balance == row.opening_balance - row.principal
        assert row.closing_balance >= 0
        # interest is charged on the outstanding balance
        r = result.input.annual_rate / 1200
        assert abs(row.interest - row.opening_balance * r) <= Decimal("0.005")
    for row in sched[:-1]:
        assert row.payment == s.emi


def test_textbook_emi_12_percent_one_year():
    res = calculate_loan(LoanInput.create(100000, 12, 12))
    assert res.summary.emi == Decimal("8884.88")
    check_schedule_invariants(res)


def test_standard_home_loan_matches_independent_formula():
    res = calculate_loan(LoanInput.create(5000000, 8.5, 240))
    expected = independent_emi(5000000, 8.5, 240)
    assert abs(float(res.summary.emi) - expected) < 0.006
    assert res.summary.emi == Decimal("43391.16")
    check_schedule_invariants(res)
    # Final instalment absorbs rounding; it must stay within a few rupees of the EMI.
    assert abs(res.summary.final_payment - res.summary.emi) < Decimal("5")


def test_zero_interest_loan():
    res = calculate_loan(LoanInput.create(120000, 0, 12))
    assert res.summary.emi == Decimal("10000.00")
    assert res.summary.total_interest == Decimal("0")
    assert res.summary.total_payment == Decimal("120000")
    check_schedule_invariants(res)


def test_zero_interest_with_uneven_split_adjusts_last_payment():
    res = calculate_loan(LoanInput.create(100000, 0, 3))
    assert res.summary.emi == Decimal("33333.33")
    assert res.summary.final_payment == Decimal("33333.34")
    check_schedule_invariants(res)


def test_one_month_tenure():
    res = calculate_loan(LoanInput.create(50000, 12, 1))
    assert res.summary.emi == Decimal("50500.00")
    assert res.summary.total_interest == Decimal("500.00")
    check_schedule_invariants(res)


def test_long_tenure_480_months():
    res = calculate_loan(LoanInput.create(7500000, 9.25, 480))
    assert abs(float(res.summary.emi) - independent_emi(7500000, 9.25, 480)) < 0.006
    assert len(res.yearly) == 40
    check_schedule_invariants(res)


def test_decimal_interest_rate():
    res = calculate_loan(LoanInput.create(250000, 10.75, 36))
    assert abs(float(res.summary.emi) - independent_emi(250000, 10.75, 36)) < 0.006
    check_schedule_invariants(res)


def test_very_large_supported_amount():
    res = calculate_loan(LoanInput.create(1000000000, 7.99, 360))
    assert abs(float(res.summary.emi) - independent_emi(1e9, 7.99, 360)) < 0.01
    check_schedule_invariants(res)


@pytest.mark.parametrize(
    "kwargs",
    [
        dict(principal=-100000, annual_rate=10, tenure_months=12),
        dict(principal=0, annual_rate=10, tenure_months=12),
        dict(principal=100000, annual_rate=-1, tenure_months=12),
        dict(principal=100000, annual_rate=10, tenure_months=0),
        dict(principal=100000, annual_rate=10, tenure_months=-6),
        dict(principal=100000, annual_rate=10, tenure_months=481),
        dict(principal=100000, annual_rate=51, tenure_months=12),
        dict(principal=2_000_000_000, annual_rate=10, tenure_months=12),
        dict(principal=100000.005, annual_rate=10, tenure_months=12),
        dict(principal=100000, annual_rate=10, tenure_months=12, fee_value=-1),
        dict(principal=100000, annual_rate=10, tenure_months=12, fee_value=11),
        dict(principal=100000, annual_rate=10, tenure_months=12, fee_type="flat", fee_value=100000),
        dict(principal="nan", annual_rate=10, tenure_months=12),
        dict(principal=100000, annual_rate="inf", tenure_months=12),
    ],
)
def test_invalid_inputs_rejected(kwargs):
    with pytest.raises(LoanInputError):
        LoanInput.create(**kwargs)


def test_processing_fee_percent_and_flat():
    pct = calculate_loan(LoanInput.create(1000000, 10, 60, "percent", 1.5))
    flat = calculate_loan(LoanInput.create(1000000, 10, 60, "flat", 15000))
    assert pct.summary.fee_amount == flat.summary.fee_amount == Decimal("15000.00")
    assert pct.summary.total_borrowing_cost == pct.summary.total_interest + Decimal("15000")
    # A fee received upfront raises the effective rate above the quoted rate.
    assert pct.summary.effective_annual_rate > Decimal("10")
    assert pct.summary.effective_monthly_cost == (
        (pct.summary.total_outflow / 60).quantize(Decimal("0.01"))
    )


def test_effective_rate_equals_nominal_without_fee():
    res = calculate_loan(LoanInput.create(1000000, 10, 60))
    assert res.summary.effective_annual_rate == Decimal("10.00")


def test_effective_rate_with_fee_matches_independent_irr():
    res = calculate_loan(LoanInput.create(1000000, 10, 60, "percent", 2))
    pays = [float(r.payment) for r in res.schedule]

    def pv(annual_pct):
        m = annual_pct / 1200
        return sum(p / (1 + m) ** (i + 1) for i, p in enumerate(pays))

    rate = float(res.summary.effective_annual_rate)
    # The 2-dp rate must bracket the amount actually received (₹9,80,000).
    assert pv(rate - 0.01) > 980000 > pv(rate + 0.01)


def test_yearly_breakdown_sums_to_totals():
    res = calculate_loan(LoanInput.create(800000, 9, 30))
    assert len(res.yearly) == 3
    assert sum(y.interest for y in res.yearly) == res.summary.total_interest
    assert sum(y.principal for y in res.yearly) == res.summary.principal
    assert res.yearly[-1].closing_balance == 0


def test_compare_picks_lowest_borrowing_cost():
    a = LoanInput.create(1000000, 9, 60)
    b = LoanInput.create(1000000, 8.5, 60, "percent", 2)
    c = LoanInput.create(1000000, 9, 36)
    cmp = compare_loans([a, b, c])
    costs = [r.summary.total_borrowing_cost for r in cmp.results]
    assert cmp.cheapest_index == costs.index(min(costs))
    assert cmp.differences[cmp.cheapest_index] == 0
    assert all(d >= 0 for d in cmp.differences)
    assert cmp.same_principal


def test_compare_requires_two_to_three():
    with pytest.raises(LoanInputError):
        compare_loans([LoanInput.create(100000, 9, 12)])


def test_aggregate_schedules():
    r1 = calculate_loan(LoanInput.create(100000, 12, 12))
    r2 = calculate_loan(LoanInput.create(200000, 10, 24))
    series = aggregate_schedules([r1, r2])
    assert len(series) == 24
    assert series[0]["interest"] == r1.schedule[0].interest + r2.schedule[0].interest
    assert series[12]["interest"] == r2.schedule[12].interest
    assert series[-1]["balance"] == 0
    assert aggregate_schedules([]) == []
