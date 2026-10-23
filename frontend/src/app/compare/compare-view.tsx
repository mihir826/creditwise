"use client";

import { Award, Loader2, Plus, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CostComparisonChart, BalanceComparisonChart } from "@/components/charts/compare-charts";
import { LegendItem, SCENARIO_COLORS } from "@/components/charts/common";
import { LoanInputs } from "@/components/loan/loan-inputs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { ErrorNotice, Skeleton } from "@/components/ui/states";
import { useDebouncedRequest } from "@/hooks/use-calculation";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatINR, formatPercent, formatTenure } from "@/lib/format";
import { DEFAULT_FORM, formFromParams, validateLoanForm, type LoanFormState } from "@/lib/loan-form";
import type { LoanParams, SavedCalculation } from "@/lib/types";

interface ScenarioState {
  label: string;
  form: LoanFormState;
}

const INITIAL: ScenarioState[] = [
  { label: "Offer A", form: { ...DEFAULT_FORM, rate: "8.75", feeValue: "0.5" } },
  { label: "Offer B", form: { ...DEFAULT_FORM, rate: "8.4", feeValue: "1" } },
];

export function CompareView() {
  const search = useSearchParams();
  const [scenarios, setScenarios] = useState<ScenarioState[]>(INITIAL);
  const [saved, setSaved] = useState<SavedCalculation[]>([]);

  useEffect(() => {
    api.listSaved().then(setSaved).catch(() => setSaved([]));
  }, []);

  // /compare?ids=1,2,3 — prefill from saved calculations.
  const ids = search.get("ids");
  useEffect(() => {
    if (!ids) return;
    const list = ids.split(",").map(Number).filter(Number.isInteger).slice(0, 3);
    if (list.length < 2) return;
    Promise.all(list.map((id) => api.getSaved(id)))
      .then((recs) => setScenarios(recs.map((r) => ({ label: r.name.slice(0, 40), form: formFromParams(r.loan) }))))
      .catch((err) => toast.error("Could not load saved calculations", { description: errorMessage(err) }));
  }, [ids]);

  const validated = useMemo(() => scenarios.map((s) => validateLoanForm(s.form)), [scenarios]);
  const labelErrors = scenarios.map((s) => (s.label.trim() ? undefined : "Give this scenario a name."));
  const allValid = validated.every((v) => v.params) && labelErrors.every((e) => !e);
  const request = allValid ? scenarios.map((sc, i) => ({ label: sc.label.trim(), ...(validated[i].params as LoanParams) })) : null;
  const { data: result, error, loading } = useDebouncedRequest(request, api.compare, 220);

  const update = (i: number, patch: Partial<ScenarioState>) =>
    setScenarios((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const updateForm = (i: number, patch: Partial<LoanFormState>) =>
    setScenarios((prev) => prev.map((s, j) => (j === i ? { ...s, form: { ...s.form, ...patch } } : s)));

  const shown = request ? result : null;
  const cheapest = shown ? shown.cheapest_index : -1;

  return (
    <div>
      <header>
        <Eyebrow>Loan comparison</Eyebrow>
        <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-tight text-fg sm:text-6xl">
          Same money, <span className="text-lavender">different price.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          Enter up to three offers. We rank them by total borrowing cost — interest plus upfront fees — using only the
          numbers you enter. Real lender terms may differ.
        </p>
      </header>

      <div className={cn("mt-10 grid gap-5", scenarios.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3")}>
        {scenarios.map((s, i) => (
          <Card
            key={i}
            className={cn("p-5 transition-colors sm:p-6", cheapest === i && "border-mint/50")}
            aria-label={`Scenario ${i + 1}`}
          >
            <div className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ background: SCENARIO_COLORS[i] }} aria-hidden />
              <label className="sr-only" htmlFor={`label-${i}`}>
                Scenario name
              </label>
              <input
                id={`label-${i}`}
                value={s.label}
                maxLength={40}
                onChange={(e) => update(i, { label: e.target.value })}
                aria-invalid={!!labelErrors[i]}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 font-serif text-2xl text-fg outline-none hover:bg-surface-2 focus:bg-surface-2"
              />
              {cheapest === i && (
                <span className="flex items-center gap-1 rounded-full bg-mint/15 px-2.5 py-1 text-[11px] font-medium text-mint">
                  <Award className="size-3.5" aria-hidden /> Lowest cost
                </span>
              )}
              {scenarios.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${s.label || "scenario"}`}
                  onClick={() => setScenarios((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X />
                </Button>
              )}
            </div>
            {labelErrors[i] && <p className="mt-1 text-xs text-danger">{labelErrors[i]}</p>}
            {saved.length > 0 && (
              <div className="mt-3">
                <label className="sr-only" htmlFor={`load-${i}`}>
                  Load a saved calculation into this scenario
                </label>
                <select
                  id={`load-${i}`}
                  value=""
                  onChange={(e) => {
                    const rec = saved.find((r) => r.id === Number(e.target.value));
                    if (rec) update(i, { label: rec.name.slice(0, 40), form: formFromParams(rec.loan) });
                  }}
                  className="h-9 w-full rounded-full border border-border bg-bg px-3 text-[13px] text-muted"
                >
                  <option value="">Load from saved…</option>
                  {saved.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-5">
              <LoanInputs compact state={s.form} errors={validated[i].errors} onChange={(p) => updateForm(i, p)} />
            </div>
          </Card>
        ))}
        {scenarios.length < 3 && (
          <button
            type="button"
            onClick={() =>
              setScenarios((prev) => [...prev, { label: "Offer C", form: { ...prev[prev.length - 1].form } }])
            }
            className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong text-muted transition-colors hover:border-lavender hover:text-fg md:col-span-2 lg:col-span-1"
          >
            <span className="grid size-11 place-items-center rounded-full bg-surface-2">
              <Plus className="size-5" aria-hidden />
            </span>
            Add a third offer
          </button>
        )}
      </div>

      <Card className="mt-5 p-5 sm:p-7" aria-live="polite" aria-busy={loading}>
        <CardHeader
          title="Side-by-side"
          description={!allValid ? "Fix the highlighted inputs to compare." : "All amounts in INR, rounded to the paisa."}
          action={loading ? <Loader2 className="size-4 animate-spin text-subtle" aria-label="Updating" /> : undefined}
        />
        {error && allValid && (
          <div className="mt-4">
            <ErrorNotice message={error} />
          </div>
        )}
        {shown ? (
          <>
            {!shown.same_principal && (
              <p className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3 text-[13px] text-muted">
                These scenarios borrow different amounts, so total cost is not a like-for-like comparison. Compare the
                effective annual rate as well.
              </p>
            )}
            <div className="mt-6 overflow-x-auto">
              <table className="tabular w-full min-w-[560px] text-[14px]">
                <caption className="sr-only">Comparison of loan scenarios</caption>
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="w-[30%] pb-3 text-xs font-medium text-subtle">
                      Metric
                    </th>
                    {shown.scenarios.map((s, i) => (
                      <th key={i} scope="col" className="pb-3 text-right font-medium text-fg">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: SCENARIO_COLORS[i] }} aria-hidden />
                          {s.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="Loan amount" values={shown.scenarios.map((s) => formatINR(s.summary.principal))} />
                  <Row label="Rate · tenure" values={shown.scenarios.map((s) => `${s.input.annual_rate}% · ${formatTenure(s.input.tenure_months)}`)} />
                  <Row label="Monthly EMI" values={shown.scenarios.map((s) => formatINR(s.summary.emi))} strong />
                  <Row label="Total interest" values={shown.scenarios.map((s) => formatINR(s.summary.total_interest))} />
                  <Row label="Total repayment" values={shown.scenarios.map((s) => formatINR(s.summary.total_payment))} />
                  <Row label="Upfront fees" values={shown.scenarios.map((s) => formatINR(s.summary.fee_amount))} />
                  <Row
                    label="Total borrowing cost"
                    hint="Interest + fees"
                    values={shown.scenarios.map((s) => formatINR(s.summary.total_borrowing_cost))}
                    strong
                    highlight={cheapest}
                  />
                  <Row
                    label="Effective annual rate"
                    hint="Including fees"
                    values={shown.scenarios.map((s) => formatPercent(s.summary.effective_annual_rate))}
                  />
                  <Row
                    label="Difference vs lowest"
                    values={shown.differences.map((d, i) => (i === cheapest ? "Lowest" : `+ ${formatINR(d)}`))}
                    highlight={cheapest}
                  />
                </tbody>
              </table>
            </div>
          </>
        ) : allValid ? (
          <Skeleton className="mt-6 h-72" />
        ) : null}
      </Card>

      {shown && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <CardHeader
              title="Cost of borrowing"
              description="Interest, fees and their total for each offer"
              action={<ScenarioLegend labels={shown.scenarios.map((s) => s.label)} />}
            />
            <div className="mt-6">
              <CostComparisonChart scenarios={shown.scenarios} />
            </div>
          </Card>
          <Card className="p-6">
            <CardHeader
              title="Balance over time"
              description="Outstanding principal at each year end"
              action={<ScenarioLegend labels={shown.scenarios.map((s) => s.label)} />}
            />
            <div className="mt-6">
              <BalanceComparisonChart scenarios={shown.scenarios} />
            </div>
          </Card>
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-subtle">
        “Lowest cost” is based strictly on the assumptions entered here. Lenders may add GST, insurance, or other
        charges, and floating rates can change over the loan term.
      </p>
    </div>
  );
}

function ScenarioLegend({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {labels.map((l, i) => (
        <LegendItem key={i} color={SCENARIO_COLORS[i]} label={l} />
      ))}
    </div>
  );
}

function Row({
  label,
  hint,
  values,
  strong,
  highlight = -1,
}: {
  label: string;
  hint?: string;
  values: string[];
  strong?: boolean;
  highlight?: number;
}) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-3 pr-4 text-left font-normal text-muted">
        {label}
        {hint && <span className="block text-[11px] text-subtle">{hint}</span>}
      </th>
      {values.map((v, i) => (
        <td
          key={i}
          className={cn("py-3 pl-4 text-right", strong ? "font-medium text-fg" : "text-fg/90", i === highlight && "text-mint")}
        >
          {v}
        </td>
      ))}
    </tr>
  );
}
