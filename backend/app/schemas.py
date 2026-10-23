"""Typed request/response schemas for the CreditWise API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import finance as fin


class LoanParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    principal: float = Field(ge=float(fin.MIN_PRINCIPAL), le=float(fin.MAX_PRINCIPAL), description="Loan amount in INR")
    annual_rate: float = Field(ge=0, le=float(fin.MAX_ANNUAL_RATE), description="Nominal annual interest rate, %")
    tenure_months: int = Field(ge=1, le=fin.MAX_TENURE_MONTHS)
    fee_type: Literal["percent", "flat"] = "percent"
    fee_value: float = Field(default=0, ge=0, description="Percent of principal, or flat INR amount")

    def to_input(self) -> fin.LoanInput:
        return fin.LoanInput.create(
            principal=self.principal,
            annual_rate=self.annual_rate,
            tenure_months=self.tenure_months,
            fee_type=self.fee_type,
            fee_value=self.fee_value,
        )


class SummaryOut(BaseModel):
    emi: float
    final_payment: float
    principal: float
    total_interest: float
    total_payment: float
    fee_amount: float
    total_borrowing_cost: float
    total_outflow: float
    effective_monthly_cost: float
    interest_share_pct: float
    effective_annual_rate: float


class ScheduleRowOut(BaseModel):
    month: int
    opening_balance: float
    payment: float
    principal: float
    interest: float
    closing_balance: float


class YearRowOut(BaseModel):
    year: int
    principal: float
    interest: float
    payment: float
    closing_balance: float


class CalculationOut(BaseModel):
    input: LoanParams
    summary: SummaryOut
    schedule: list[ScheduleRowOut]
    yearly: list[YearRowOut]


class Scenario(LoanParams):
    label: str = Field(min_length=1, max_length=40)

    @field_validator("label")
    @classmethod
    def strip_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be blank.")
        return v


class CompareRequest(BaseModel):
    scenarios: list[Scenario] = Field(min_length=2, max_length=3)


class ScenarioOut(BaseModel):
    label: str
    input: LoanParams
    summary: SummaryOut
    yearly: list[YearRowOut]


class CompareOut(BaseModel):
    scenarios: list[ScenarioOut]
    cheapest_index: int
    differences: list[float]
    same_principal: bool


class ReportRequest(BaseModel):
    loan: LoanParams
    title: str | None = Field(default=None, max_length=80)


class SavedCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    loan: LoanParams

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank.")
        return v


class SavedRename(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name cannot be blank.")
        return v


class SavedOut(BaseModel):
    id: int
    name: str
    loan: LoanParams
    emi: float
    total_interest: float
    total_payment: float
    fee_amount: float
    total_borrowing_cost: float
    interest_share_pct: float
    created_at: str
    updated_at: str


class SeriesPoint(BaseModel):
    month: int
    principal: float
    interest: float
    balance: float


class DashboardOut(BaseModel):
    count: int
    total_principal: float
    total_monthly_emi: float
    total_interest: float
    total_fees: float
    total_payment: float
    interest_share_pct: float
    longest_tenure_months: int
    highest_interest_share: SavedOut | None
    series: list[SeriesPoint]
    recent: list[SavedOut]


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Applicant_Income: float = Field(ge=0)
    Coapplicant_Income: float = Field(ge=0)
    Age: int = Field(ge=18, le=100)
    Dependents: int = Field(ge=0, le=20)
    Credit_Score: int = Field(ge=300, le=900)
    Existing_Loans: int = Field(ge=0, le=50)
    DTI_Ratio: float = Field(ge=0, le=5)
    Savings: float = Field(ge=0)
    Collateral_Value: float = Field(ge=0)
    Loan_Amount: float = Field(gt=0)
    Loan_Term: int = Field(ge=1, le=600)
    Employment_Status: str
    Marital_Status: str
    Loan_Purpose: str
    Property_Area: str
    Education_Level: str
    Employer_Category: str


class Contribution(BaseModel):
    feature: str
    value: float | str
    log_odds: float


class PredictionOut(BaseModel):
    approved: bool
    probability: float
    threshold: float
    baseline_probability: float
    contributions: list[Contribution]
    out_of_range: list[str]
    model_label: str
