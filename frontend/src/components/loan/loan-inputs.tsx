"use client";

import { Segmented } from "@/components/ui/segmented";
import { amountInWords, formatTenure } from "@/lib/format";
import { LIMITS, parseNumber, tenureToMonths, type LoanFormErrors, type LoanFormState } from "@/lib/loan-form";
import { NumberField } from "./number-field";

// Log-scale slider for the amount: ₹50K → ₹5Cr feels even across the range.
const AMOUNT_MIN = 50_000;
const AMOUNT_MAX = 50_000_000;
const toLog = (v: number) => Math.log10(Math.max(v, 1));
function fromLog(s: number) {
  const raw = 10 ** s;
  const step = raw >= 1e7 ? 100_000 : raw >= 1e6 ? 50_000 : raw >= 1e5 ? 5_000 : 1_000;
  return Math.round(raw / step) * step;
}

export function LoanInputs({
  state,
  errors,
  onChange,
  compact = false,
}: {
  state: LoanFormState;
  errors: LoanFormErrors;
  onChange: (patch: Partial<LoanFormState>) => void;
  compact?: boolean;
}) {
  const principal = parseNumber(state.principal);
  const rate = parseNumber(state.rate);
  const tenure = parseNumber(state.tenure);
  const months = tenure !== null ? tenureToMonths(tenure, state.tenureUnit) : null;
  const fee = parseNumber(state.feeValue);
  const years = state.tenureUnit === "years";

  function switchUnit(unit: "years" | "months") {
    if (unit === state.tenureUnit) return;
    if (tenure === null) return onChange({ tenureUnit: unit });
    const next = unit === "months" ? Math.round(tenure * 12) : Math.round((tenure / 12) * 100) / 100;
    onChange({ tenureUnit: unit, tenure: String(next) });
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-7"}>
      <NumberField
        label="Loan amount"
        value={state.principal}
        onChange={(v) => onChange({ principal: v })}
        parsed={principal}
        prefix="₹"
        hint={principal ? amountInWords(principal) : undefined}
        error={errors.principal}
        compact={compact}
        slider={compact ? undefined : { min: toLog(AMOUNT_MIN), max: toLog(AMOUNT_MAX), step: 0.001, toSlider: toLog, fromSlider: fromLog }}
        sliderLabels={["₹50K", "₹5Cr"]}
      />
      <NumberField
        label="Interest rate"
        value={state.rate}
        onChange={(v) => onChange({ rate: v })}
        parsed={rate}
        suffix={<span className="pr-2">% p.a.</span>}
        error={errors.rate}
        compact={compact}
        slider={compact ? undefined : { min: 0, max: 24, step: 0.05, fromSlider: (s) => Math.round(s * 100) / 100 }}
        sliderLabels={["0%", "24%"]}
      />
      <NumberField
        label="Tenure"
        value={state.tenure}
        onChange={(v) => onChange({ tenure: v })}
        parsed={tenure}
        inputMode={years ? "decimal" : "numeric"}
        hint={months && Number.isInteger(months) ? `${months} monthly payments · ${formatTenure(months)}` : undefined}
        error={errors.tenure}
        compact={compact}
        suffix={
          <Segmented
            size="sm"
            label="Tenure unit"
            value={state.tenureUnit}
            onChange={switchUnit}
            className="border-0 bg-surface-2"
            options={[
              { value: "years", label: "Yrs" },
              { value: "months", label: "Mos" },
            ]}
          />
        }
        slider={
          compact
            ? undefined
            : years
              ? { min: 1, max: LIMITS.tenureMonths.max / 12, step: 1 }
              : { min: 1, max: LIMITS.tenureMonths.max, step: 1 }
        }
        sliderLabels={years ? ["1 yr", "40 yrs"] : ["1 mo", "480 mo"]}
      />
      <NumberField
        label="Processing fee (optional)"
        value={state.feeValue}
        onChange={(v) => onChange({ feeValue: v })}
        parsed={fee}
        prefix={state.feeType === "flat" ? "₹" : undefined}
        hint={state.feeType === "percent" ? "% of loan, paid upfront" : "Paid upfront, not in the EMI"}
        error={errors.feeValue}
        compact={compact}
        suffix={
          <Segmented
            size="sm"
            label="Fee type"
            value={state.feeType}
            onChange={(t) => onChange({ feeType: t, feeValue: "0" })}
            className="border-0 bg-surface-2"
            options={[
              { value: "percent", label: "%" },
              { value: "flat", label: "₹" },
            ]}
          />
        }
        slider={compact || state.feeType === "flat" ? undefined : { min: 0, max: 5, step: 0.05, fromSlider: (s) => Math.round(s * 100) / 100 }}
        sliderLabels={["0%", "5%"]}
      />
    </div>
  );
}
