import csv
import io

LOAN = {"principal": 1000000, "annual_rate": 9.5, "tenure_months": 60, "fee_type": "percent", "fee_value": 1}


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok", "model": "ready"}


def test_calculate_consistency(client):
    res = client.post("/api/loans/calculate", json=LOAN)
    assert res.status_code == 200
    body = res.json()
    s = body["summary"]
    assert len(body["schedule"]) == 60
    assert body["schedule"][-1]["closing_balance"] == 0
    assert round(sum(r["interest"] for r in body["schedule"]), 2) == s["total_interest"]
    assert round(s["principal"] + s["total_interest"], 2) == s["total_payment"]
    assert s["fee_amount"] == 10000
    assert len(body["yearly"]) == 5


def test_calculate_validation_errors(client):
    for bad in [
        {**LOAN, "principal": -5},
        {**LOAN, "tenure_months": 0},
        {**LOAN, "annual_rate": 75},
        {k: v for k, v in LOAN.items() if k != "principal"},
        {**LOAN, "principal": "abc"},
        {**LOAN, "unexpected": 1},
        {**LOAN, "fee_type": "flat", "fee_value": 2000000},
    ]:
        res = client.post("/api/loans/calculate", json=bad)
        assert res.status_code == 422, bad
        assert "detail" in res.json()


def test_compare(client):
    scenarios = [
        {**LOAN, "label": "Bank A"},
        {**LOAN, "label": "Bank B", "annual_rate": 8.9, "fee_value": 2},
        {**LOAN, "label": "Bank C", "tenure_months": 36},
    ]
    res = client.post("/api/loans/compare", json={"scenarios": scenarios})
    assert res.status_code == 200
    body = res.json()
    costs = [s["summary"]["total_borrowing_cost"] for s in body["scenarios"]]
    assert body["cheapest_index"] == costs.index(min(costs))
    assert body["differences"][body["cheapest_index"]] == 0
    assert body["same_principal"] is True
    assert client.post("/api/loans/compare", json={"scenarios": scenarios[:1]}).status_code == 422


def test_csv_export(client):
    res = client.post("/api/loans/schedule.csv", json=LOAN)
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(res.text)))
    assert rows[0][0] == "Month"
    assert rows[60][0] == "60" and rows[60][-1] == "0.00"
    assert rows[-1][0] == "Total"


def test_pdf_report(client):
    long_loan = {**LOAN, "tenure_months": 360}
    res = client.post("/api/loans/report.pdf", json={"loan": long_loan, "title": "Home loan — draft"})
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    assert 'filename="creditwise-home-loan-draft.pdf"' in res.headers["content-disposition"]
    # 360 rows must span several pages
    assert res.content.count(b"/Type /Page\n") + res.content.count(b"/Type /Page ") >= 5 or res.content.count(b"/Page") >= 6


def test_saved_crud_and_persistence(client, tmp_path):
    assert client.get("/api/calculations").json() == []
    dash = client.get("/api/dashboard").json()
    assert dash["count"] == 0 and dash["series"] == []

    created = client.post("/api/calculations", json={"name": "  Car loan  ", "loan": LOAN})
    assert created.status_code == 201
    rec = created.json()
    assert rec["name"] == "Car loan"
    calc = client.post("/api/loans/calculate", json=LOAN).json()["summary"]
    assert rec["emi"] == calc["emi"] and rec["total_interest"] == calc["total_interest"]

    second = client.post("/api/calculations", json={"name": "Home", "loan": {**LOAN, "principal": 5000000, "tenure_months": 240}}).json()

    # Persistence: a fresh client against the same DB file sees the records.
    from fastapi.testclient import TestClient
    from app.main import app

    assert len(TestClient(app).get("/api/calculations").json()) == 2

    renamed = client.patch(f"/api/calculations/{rec['id']}", json={"name": "Car loan v2"})
    assert renamed.json()["name"] == "Car loan v2"
    assert client.patch(f"/api/calculations/{rec['id']}", json={"name": "   "}).status_code == 422

    dash = client.get("/api/dashboard").json()
    assert dash["count"] == 2
    assert dash["total_principal"] == 6000000
    assert round(dash["total_monthly_emi"], 2) == round(rec["emi"] + second["emi"], 2)
    assert len(dash["series"]) == 240
    assert dash["series"][-1]["balance"] == 0

    assert client.delete(f"/api/calculations/{rec['id']}").status_code == 204
    assert client.delete(f"/api/calculations/{rec['id']}").status_code == 404
    assert client.get(f"/api/calculations/{rec['id']}").status_code == 404
    assert len(client.get("/api/calculations").json()) == 1


def test_saved_validation(client):
    assert client.post("/api/calculations", json={"name": "", "loan": LOAN}).status_code == 422
    assert client.post("/api/calculations", json={"name": "x", "loan": {**LOAN, "principal": 10}}).status_code == 422
