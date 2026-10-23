"""CreditWise financial engine.

Single source of truth for every loan calculation in the application. All
money arithmetic uses ``Decimal`` and is rounded to paise (0.01) with
ROUND_HALF_UP, so the totals shown in the UI, CSV and PDF are exact sums of
the schedule rows rather than floating-point approximations.

Model: standard fixed-rate, monthly-reducing-balance amortising loan.

    EMI = P * r * (1 + r)^n / ((1 + r)^n - 1),   r = annual% / 12 / 100
    EMI = P / n                                  when r == 0

Rounding convention: the EMI is rounded to paise once. Each month's interest
is the outstanding balance times r, rounded to paise. The final instalment
repays whatever balance remains (plus its interest), so the closing balance
is exactly zero; this final payment may differ from the EMI by a few paise.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal, getcontext
from typing import Literal

getcontext().prec = 50

PAISE = Decimal("0.01")
ZERO = Decimal("0")
HUNDRED = Decimal("100")
TWELVE = Decimal("12")

# Supported input ranges. Kept here so the API schemas and tests share them.
MIN_PRINCIPAL = Decimal("1000")
MAX_PRINCIPAL = Decimal("1000000000")  # ₹100 crore
MAX_ANNUAL_RATE = Decimal("50")
MAX_TENURE_MONTHS = 480  # 40 years
MAX_FEE_PERCENT = Decimal("10")

FeeType = Literal["percent", "flat"]


class LoanInputError(ValueError):
    """Raised when loan inputs are outside the supported domain."""


def to_decimal(value: Decimal | int | float | str) -> Decimal:
    if isinstance(value, Decimal):
        d = value
    else:
        # str() avoids importing binary float artefacts (0.1 -> 0.1000000000000000055...)
        d = Decimal(str(value))
    if not d.is_finite():
        raise LoanInputError("Value must be a finite number.")
    return d


def round_money(value: Decimal) -> Decimal:
    return value.quantize(PAISE, rounding=ROUND_HALF_UP)


def monthly_rate(annual_rate_pct: Decimal) -> Decimal:
    return annual_rate_pct / HUNDRED / TWELVE


@dataclass(frozen=True)
class LoanInput:
    principal: Decimal
    annual_rate: Decimal  # percent per annum, e.g. 8.5
    tenure_months: int
    fee_type: FeeType = "percent"
    fee_value: Decimal = ZERO  # percent of principal, or flat INR amount

    @classmethod
    def create(
        cls,
        principal: Decimal | int | float | str,
        annual_rate: Decimal | int | float | str,
        tenure_months: int,
        fee_type: FeeType = "percent",
        fee_value: Decimal | int | float | str = 0,
    ) -> "LoanInput":
        loan = cls(
            principal=to_decimal(principal),
            annual_rate=to_decimal(annual_rate),
            tenure_months=tenure_months,
            fee_type=fee_type,
            fee_value=to_decimal(fee_value),
        )
        loan.validate()
        return loan

    def validate(self) -> None:
        if not MIN_PRINCIPAL <= self.principal <= MAX_PRINCIPAL:
            raise LoanInputError(
                f"Loan amount must be between ₹{MIN_PRINCIPAL:,} and ₹{MAX_PRINCIPAL:,}."
            )
        if round_money(self.principal) != self.principal:
            raise LoanInputError("Loan amount cannot have more than two decimal places.")
        if not ZERO <= self.annual_rate <= MAX_ANNUAL_RATE:
            raise LoanInputError(f"Interest rate must be between 0% and {MAX_ANNUAL_RATE}%.")
        if isinstance(self.tenure_months, bool) or not isinstance(self.tenure_months, int):
            raise LoanInputError("Tenure must be a whole number of months.")
        if not 1 <= self.tenure_months <= MAX_TENURE_MONTHS:
            raise LoanInputError(f"Tenure must be between 1 and {MAX_TENURE_MONTHS} months.")
        if self.fee_type not in ("percent", "flat"):
            raise LoanInputError("Processing fee type must be 'percent' or 'flat'.")
        if self.fee_value < ZERO:
            raise LoanInputError("Processing fee cannot be negative.")
        if self.fee_type == "percent" and self.fee_value > MAX_FEE_PERCENT:
            raise LoanInputError(f"Processing fee cannot exceed {MAX_FEE_PERCENT}% of the loan.")
        if self.fee_type == "flat" and self.fee_value >= self.principal:
            raise LoanInputError("Processing fee must be smaller than the loan amount.")

    @property
    def fee_amount(self) -> Decimal:
        if self.fee_type == "percent":
            return round_money(self.principal * self.fee_value / HUNDRED)
        return round_money(self.fee_value)


def compute_emi(principal: Decimal, annual_rate_pct: Decimal, tenure_months: int) -> Decimal:
    """Unrounded EMI for a fixed-rate amortising loan."""
    if tenure_months < 1:
        raise LoanInputError("Tenure must be at least one month.")
    r = monthly_rate(annual_rate_pct)
    if r == ZERO:
        return principal / Decimal(tenure_months)
    growth = (1 + r) ** tenure_months
    return principal * r * growth / (growth - 1)


@dataclass(frozen=True)
class ScheduleRow:
    month: int
    opening_balance: Decimal
    payment: Decimal
    principal: Decimal
    interest: Decimal
    closing_balance: Decimal


@dataclass(frozen=True)
class YearRow:
    year: int
    principal: Decimal
    interest: Decimal
    payment: Decimal
    closing_balance: Decimal


@dataclass(frozen=True)
class LoanSummary:
    emi: Decimal
    final_payment: Decimal
    principal: Decimal
    total_interest: Decimal
    total_payment: Decimal  # principal + interest (sum of all instalments)
    fee_amount: Decimal
    total_borrowing_cost: Decimal  # interest + processing fee
    total_outflow: Decimal  # instalments + processing fee
    effective_monthly_cost: Decimal  # total_outflow / n
    interest_share_pct: Decimal  # interest as % of total instalments
    effective_annual_rate: Decimal  # nominal annual rate incl. fee (see below)


@dataclass(frozen=True)
class LoanResult:
    input: LoanInput
    summary: LoanSummary
    schedule: list[ScheduleRow] = field(repr=False)
    yearly: list[YearRow] = field(repr=False)


def amortization_schedule(loan: LoanInput) -> list[ScheduleRow]:
    n = loan.tenure_months
    r = monthly_rate(loan.annual_rate)
    emi = round_money(compute_emi(loan.principal, loan.annual_rate, n))
    balance = round_money(loan.principal)
    rows: list[ScheduleRow] = []
    for month in range(1, n + 1):
        opening = balance
        interest = round_money(opening * r)
        if month == n:
            principal_part = opening
        else:
            # Never repay more than is outstanding, never go negative.
            principal_part = min(max(emi - interest, ZERO), opening)
        payment = principal_part + interest
        balance = opening - principal_part
        rows.append(
            ScheduleRow(
                month=month,
                opening_balance=opening,
                payment=payment,
                principal=principal_part,
                interest=interest,
                closing_balance=balance,
            )
        )
    return rows


def yearly_breakdown(schedule: list[ScheduleRow]) -> list[YearRow]:
    years: list[YearRow] = []
    for start in range(0, len(schedule), 12):
        chunk = schedule[start : start + 12]
        years.append(
            YearRow(
                year=start // 12 + 1,
                principal=sum((r.principal for r in chunk), ZERO),
                interest=sum((r.interest for r in chunk), ZERO),
                payment=sum((r.payment for r in chunk), ZERO),
                closing_balance=chunk[-1].closing_balance,
            )
        )
    return years


def effective_annual_rate(
    payments: list[Decimal], net_disbursed: Decimal, tolerance: float = 1e-12
) -> Decimal:
    """Nominal annual rate (monthly IRR x 12, in %) that equates the stream of
    instalments to the amount actually received (principal minus upfront fee).

    Expressed on the same nominal basis as the quoted rate so the two are
    directly comparable. Solved by bisection; returned to 2 decimal places.
    """
    pays = [float(p) for p in payments]
    target = float(net_disbursed)

    def pv(rate: float) -> float:
        total, factor = 0.0, 1.0
        for p in pays:
            factor /= 1.0 + rate
            total += p * factor
        return total

    if pv(0.0) <= target:
        return ZERO
    lo, hi = 0.0, 1.0
    while pv(hi) > target:  # extremely defensive; 100%/month is far beyond input limits
        hi *= 2
    for _ in range(200):
        mid = (lo + hi) / 2
        if pv(mid) > target:
            lo = mid
        else:
            hi = mid
        if hi - lo < tolerance:
            break
    return round_money(Decimal(str((lo + hi) / 2)) * TWELVE * HUNDRED)


def calculate_loan(loan: LoanInput) -> LoanResult:
    loan.validate()
    schedule = amortization_schedule(loan)
    total_interest = sum((r.interest for r in schedule), ZERO)
    total_payment = sum((r.payment for r in schedule), ZERO)
    fee = loan.fee_amount
    n = loan.tenure_months
    total_outflow = total_payment + fee
    interest_share = (
        (total_interest / total_payment * HUNDRED).quantize(PAISE, rounding=ROUND_HALF_UP)
        if total_payment > 0
        else ZERO
    )
    if fee == ZERO:
        ear = round_money(loan.annual_rate)
    else:
        ear = effective_annual_rate([r.payment for r in schedule], loan.principal - fee)
    summary = LoanSummary(
        emi=schedule[0].payment,
        final_payment=schedule[-1].payment,
        principal=round_money(loan.principal),
        total_interest=total_interest,
        total_payment=total_payment,
        fee_amount=fee,
        total_borrowing_cost=total_interest + fee,
        total_outflow=total_outflow,
        effective_monthly_cost=round_money(total_outflow / Decimal(n)),
        interest_share_pct=interest_share,
        effective_annual_rate=ear,
    )
    return LoanResult(input=loan, summary=summary, schedule=schedule, yearly=yearly_breakdown(schedule))


@dataclass(frozen=True)
class ComparisonResult:
    results: list[LoanResult]
    cheapest_index: int
    differences: list[Decimal]  # total_borrowing_cost minus the cheapest scenario's
    same_principal: bool


def compare_loans(loans: list[LoanInput]) -> ComparisonResult:
    if not 2 <= len(loans) <= 3:
        raise LoanInputError("Compare between two and three scenarios.")
    results = [calculate_loan(l) for l in loans]
    costs = [r.summary.total_borrowing_cost for r in results]
    cheapest = min(range(len(costs)), key=lambda i: (costs[i], i))
    return ComparisonResult(
        results=results,
        cheapest_index=cheapest,
        differences=[c - costs[cheapest] for c in costs],
        same_principal=len({l.principal for l in loans}) == 1,
    )


def aggregate_schedules(results: list[LoanResult]) -> list[dict[str, Decimal | int]]:
    """Month-by-month totals across several loans that all start in month 1."""
    if not results:
        return []
    horizon = max(r.input.tenure_months for r in results)
    series = []
    for idx in range(horizon):
        principal = interest = balance = ZERO
        for r in results:
            if idx < len(r.schedule):
                row = r.schedule[idx]
                principal += row.principal
                interest += row.interest
                balance += row.closing_balance
        series.append({"month": idx + 1, "principal": principal, "interest": interest, "balance": balance})
    return series
