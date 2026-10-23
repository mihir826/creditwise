"""CreditWise API."""

from __future__ import annotations

import os
import re
from decimal import Decimal

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, ml_service, reports
from . import finance as fin
from .schemas import (
    CalculationOut,
    CompareOut,
    CompareRequest,
    DashboardOut,
    LoanParams,
    PredictionOut,
    PredictionRequest,
    ReportRequest,
    SavedCreate,
    SavedOut,
    SavedRename,
    ScenarioOut,
    ScheduleRowOut,
    SeriesPoint,
    SummaryOut,
    YearRowOut,
)

app = FastAPI(title="CreditWise API", version="1.0.0")

_origins = [o.strip() for o in os.environ.get("CREDITWISE_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def request_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    # The default handler echoes each invalid input back, which itself fails
    # for values JSON cannot represent (Infinity, NaN) and turns a 422 into a 500.
    errors = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", "Invalid input"), "type": e.get("type", "")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


@app.exception_handler(fin.LoanInputError)
async def loan_input_error(_: Request, exc: fin.LoanInputError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(ml_service.PredictionInputError)
async def prediction_input_error(_: Request, exc: ml_service.PredictionInputError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(ml_service.ModelUnavailable)
async def model_unavailable(_: Request, exc: ml_service.ModelUnavailable) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": str(exc)})


# --------------------------------------------------------------------- helpers


def _f(d: Decimal) -> float:
    return float(d)


def summary_out(s: fin.LoanSummary) -> SummaryOut:
    return SummaryOut(**{k: _f(v) for k, v in s.__dict__.items()})


def params_out(loan: fin.LoanInput) -> LoanParams:
    return LoanParams(
        principal=_f(loan.principal),
        annual_rate=_f(loan.annual_rate),
        tenure_months=loan.tenure_months,
        fee_type=loan.fee_type,
        fee_value=_f(loan.fee_value),
    )


def yearly_out(result: fin.LoanResult) -> list[YearRowOut]:
    return [
        YearRowOut(year=y.year, principal=_f(y.principal), interest=_f(y.interest), payment=_f(y.payment), closing_balance=_f(y.closing_balance))
        for y in result.yearly
    ]


def record_input(row) -> fin.LoanInput:
    return fin.LoanInput.create(
        principal=row["principal"],
        annual_rate=row["annual_rate"],
        tenure_months=row["tenure_months"],
        fee_type=row["fee_type"],
        fee_value=row["fee_value"],
    )


def saved_out(row, result: fin.LoanResult | None = None) -> SavedOut:
    result = result or fin.calculate_loan(record_input(row))
    s = result.summary
    return SavedOut(
        id=row["id"],
        name=row["name"],
        loan=params_out(result.input),
        emi=_f(s.emi),
        total_interest=_f(s.total_interest),
        total_payment=_f(s.total_payment),
        fee_amount=_f(s.fee_amount),
        total_borrowing_cost=_f(s.total_borrowing_cost),
        interest_share_pct=_f(s.interest_share_pct),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def _safe_filename(text: str | None, fallback: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", text or "").strip("-").lower()
    return slug[:60] or fallback


# ---------------------------------------------------------------------- routes


@app.get("/api/health")
def health() -> dict:
    try:
        ml_service.load()
        model = "ready"
    except ml_service.ModelUnavailable:
        model = "missing"
    return {"status": "ok", "model": model}


@app.post("/api/loans/calculate", response_model=CalculationOut)
def calculate(params: LoanParams) -> CalculationOut:
    result = fin.calculate_loan(params.to_input())
    return CalculationOut(
        input=params_out(result.input),
        summary=summary_out(result.summary),
        schedule=[ScheduleRowOut(**{k: (v if k == "month" else _f(v)) for k, v in r.__dict__.items()}) for r in result.schedule],
        yearly=yearly_out(result),
    )


@app.post("/api/loans/compare", response_model=CompareOut)
def compare(req: CompareRequest) -> CompareOut:
    cmp = fin.compare_loans([s.to_input() for s in req.scenarios])
    return CompareOut(
        scenarios=[
            ScenarioOut(label=s.label, input=params_out(r.input), summary=summary_out(r.summary), yearly=yearly_out(r))
            for s, r in zip(req.scenarios, cmp.results)
        ],
        cheapest_index=cmp.cheapest_index,
        differences=[_f(d) for d in cmp.differences],
        same_principal=cmp.same_principal,
    )


@app.post("/api/loans/schedule.csv")
def schedule_csv(params: LoanParams) -> Response:
    result = fin.calculate_loan(params.to_input())
    return Response(
        content=reports.schedule_csv(result),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="creditwise-amortization-schedule.csv"'},
    )


@app.post("/api/loans/report.pdf")
def report_pdf(req: ReportRequest) -> Response:
    result = fin.calculate_loan(req.loan.to_input())
    pdf = reports.loan_report_pdf(result, title=req.title)
    name = _safe_filename(req.title, "loan-estimate")
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="creditwise-{name}.pdf"'},
    )


@app.get("/api/calculations", response_model=list[SavedOut])
def list_calculations() -> list[SavedOut]:
    return [saved_out(r) for r in db.list_records()]


@app.post("/api/calculations", response_model=SavedOut, status_code=201)
def create_calculation(body: SavedCreate) -> SavedOut:
    loan = body.loan.to_input()
    record_id = db.insert_record(
        body.name, str(loan.principal), str(loan.annual_rate), loan.tenure_months, loan.fee_type, str(loan.fee_value)
    )
    return saved_out(db.get_record(record_id))


def _get_or_404(record_id: int):
    row = db.get_record(record_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Saved calculation not found.")
    return row


@app.get("/api/calculations/{record_id}", response_model=SavedOut)
def get_calculation(record_id: int) -> SavedOut:
    return saved_out(_get_or_404(record_id))


@app.patch("/api/calculations/{record_id}", response_model=SavedOut)
def rename_calculation(record_id: int, body: SavedRename) -> SavedOut:
    _get_or_404(record_id)
    db.rename_record(record_id, body.name)
    return saved_out(_get_or_404(record_id))


@app.delete("/api/calculations/{record_id}", status_code=204)
def delete_calculation(record_id: int) -> Response:
    if not db.delete_record(record_id):
        raise HTTPException(status_code=404, detail="Saved calculation not found.")
    return Response(status_code=204)


@app.get("/api/dashboard", response_model=DashboardOut)
def dashboard() -> DashboardOut:
    rows = db.list_records()
    results = [fin.calculate_loan(record_input(r)) for r in rows]
    zero = Decimal(0)
    total_principal = sum((r.summary.principal for r in results), zero)
    total_interest = sum((r.summary.total_interest for r in results), zero)
    total_payment = sum((r.summary.total_payment for r in results), zero)
    saved = [saved_out(row, res) for row, res in zip(rows, results)]
    highest = max(saved, key=lambda s: s.interest_share_pct, default=None)
    return DashboardOut(
        count=len(results),
        total_principal=_f(total_principal),
        total_monthly_emi=_f(sum((r.summary.emi for r in results), zero)),
        total_interest=_f(total_interest),
        total_fees=_f(sum((r.summary.fee_amount for r in results), zero)),
        total_payment=_f(total_payment),
        interest_share_pct=_f((total_interest / total_payment * 100).quantize(fin.PAISE)) if total_payment else 0.0,
        longest_tenure_months=max((r.input.tenure_months for r in results), default=0),
        highest_interest_share=highest if len(saved) > 1 else None,
        series=[SeriesPoint(**{k: (v if k == "month" else _f(v)) for k, v in p.items()}) for p in fin.aggregate_schedules(results)],
        recent=saved[:4],
    )


@app.get("/api/model")
def model_info() -> dict:
    return ml_service.public_metadata()


@app.post("/api/model/predict", response_model=PredictionOut)
def model_predict(body: PredictionRequest) -> PredictionOut:
    return PredictionOut(**ml_service.predict(body.model_dump()))
