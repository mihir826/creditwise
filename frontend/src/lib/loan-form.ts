import type { FeeType, LoanParams } from "./types";

/** Mirrors backend limits (backend/app/finance.py) for instant, friendly feedback.
 * The backend remains the authority and re-validates every request. */
export const LIMITS = {
  principal: { min: 1_000, max: 1_000_000_000 },
  rate: { min: 0, max: 50 },
  tenureMonths: { min: 1, max: 480 },
  feePercent: { max: 10 },
} as const;

export type TenureUnit = "years" | "months";

export interface LoanFormState {
  principal: string;
  rate: string;
  tenure: string;
  tenureUnit: TenureUnit;
  feeType: FeeType;
  feeValue: string;
}

export type LoanFormErrors = Partial<Record<"principal" | "rate" | "tenure" | "feeValue", string>>;

export const DEFAULT_FORM: LoanFormState = {
  principal: "2500000",
  rate: "8.75",
  tenure: "20",
  tenureUnit: "years",
  feeType: "percent",
  feeValue: "0",
};

/** Accepts "12,50,000", "₹ 1250000", " 8.5 " — rejects anything else. */
export function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function decimals(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? 0 : cleaned.length - dot - 1;
}

export function tenureToMonths(value: number, unit: TenureUnit): number {
  return unit === "years" ? Math.round(value * 12 * 1e6) / 1e6 : value;
}

export function validateLoanForm(state: LoanFormState): { params: LoanParams | null; errors: LoanFormErrors } {
  const errors: LoanFormErrors = {};

  const principal = parseNumber(state.principal);
  if (state.principal.trim() === "") errors.principal = "Enter a loan amount.";
  else if (principal === null) errors.principal = "Enter a valid number.";
  else if (principal < LIMITS.principal.min) errors.principal = "Minimum loan amount is ₹1,000.";
  else if (principal > LIMITS.principal.max) errors.principal = "Maximum loan amount is ₹100 crore.";
  else if (decimals(state.principal) > 2) errors.principal = "Use at most two decimal places.";

  const rate = parseNumber(state.rate);
  if (state.rate.trim() === "") errors.rate = "Enter an interest rate.";
  else if (rate === null) errors.rate = "Enter a valid number.";
  else if (rate < LIMITS.rate.min) errors.rate = "Interest rate cannot be negative.";
  else if (rate > LIMITS.rate.max) errors.rate = "Maximum supported rate is 50% p.a.";

  const tenureRaw = parseNumber(state.tenure);
  let months: number | null = null;
  if (state.tenure.trim() === "") errors.tenure = "Enter a tenure.";
  else if (tenureRaw === null) errors.tenure = "Enter a valid number.";
  else {
    months = tenureToMonths(tenureRaw, state.tenureUnit);
    if (!Number.isInteger(months))
      errors.tenure = state.tenureUnit === "years" ? "Tenure must be a whole number of months." : "Use whole months.";
    else if (months < LIMITS.tenureMonths.min) errors.tenure = "Tenure must be at least 1 month.";
    else if (months > LIMITS.tenureMonths.max) errors.tenure = "Maximum tenure is 40 years (480 months).";
  }

  const feeRaw = state.feeValue.trim() === "" ? 0 : parseNumber(state.feeValue);
  if (feeRaw === null) errors.feeValue = "Enter a valid number.";
  else if (feeRaw < 0) errors.feeValue = "Fee cannot be negative.";
  else if (state.feeType === "percent" && feeRaw > LIMITS.feePercent.max) errors.feeValue = "Maximum fee is 10% of the loan.";
  else if (state.feeType === "flat" && principal !== null && feeRaw >= principal)
    errors.feeValue = "Fee must be smaller than the loan amount.";

  if (Object.keys(errors).length) return { params: null, errors };
  return {
    params: {
      principal: principal!,
      annual_rate: rate!,
      tenure_months: months!,
      fee_type: state.feeType,
      fee_value: feeRaw!,
    },
    errors,
  };
}

export function formFromParams(p: LoanParams): LoanFormState {
  const useYears = p.tenure_months % 12 === 0;
  return {
    principal: String(p.principal),
    rate: String(p.annual_rate),
    tenure: String(useYears ? p.tenure_months / 12 : p.tenure_months),
    tenureUnit: useYears ? "years" : "months",
    feeType: p.fee_type,
    feeValue: String(p.fee_value),
  };
}
