"use client";

import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { ModelInfo, Prediction } from "@/lib/types";

const LABELS: Record<string, string> = {
  Applicant_Income: "Applicant income",
  Coapplicant_Income: "Co-applicant income",
  Age: "Age",
  Dependents: "Dependents",
  Credit_Score: "Credit score",
  Existing_Loans: "Existing loans",
  DTI_Ratio: "Debt-to-income ratio",
  Savings: "Savings",
  Collateral_Value: "Collateral value",
  Loan_Amount: "Loan amount",
  Loan_Term: "Loan term (months)",
  Employment_Status: "Employment status",
  Marital_Status: "Marital status",
  Loan_Purpose: "Loan purpose",
  Property_Area: "Property area",
  Education_Level: "Education",
  Employer_Category: "Employer category",
};

const GROUPS: { title: string; fields: string[] }[] = [
  { title: "Applicant", fields: ["Age", "Marital_Status", "Dependents", "Education_Level"] },
  { title: "Income & employment", fields: ["Applicant_Income", "Coapplicant_Income", "Employment_Status", "Employer_Category"] },
  { title: "Credit profile", fields: ["Credit_Score", "Existing_Loans", "DTI_Ratio", "Savings", "Collateral_Value"] },
  { title: "Loan request", fields: ["Loan_Amount", "Loan_Term", "Loan_Purpose", "Property_Area"] },
];

const MONEY_FIELDS = new Set(["Applicant_Income", "Coapplicant_Income", "Savings", "Collateral_Value", "Loan_Amount"]);

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export function PredictView() {
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .modelInfo()
      .then((m) => {
        setInfo(m);
        const init: Record<string, string> = {};
        m.schema.numeric.forEach((n) => (init[n.name] = String(n.integer ? Math.round(n.median) : n.median)));
        m.schema.categorical.forEach((c) => (init[c.name] = c.options[0]));
        setValues(init);
      })
      .catch((err) => setInfoError(errorMessage(err)));
  }, []);

  const numeric = useMemo(() => new Map(info?.schema.numeric.map((n) => [n.name, n])), [info]);
  const categorical = useMemo(() => new Map(info?.schema.categorical.map((c) => [c.name, c.options])), [info]);

  const fieldErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    numeric.forEach((spec, name) => {
      const raw = (values[name] ?? "").trim();
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) errs[name] = "Enter a number.";
      else if (n < 0) errs[name] = "Cannot be negative.";
      else if (spec.integer && !Number.isInteger(n)) errs[name] = "Use a whole number.";
    });
    return errs;
  }, [numeric, values]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!info || Object.keys(fieldErrors).length) return;
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, number | string> = {};
      info.schema.numeric.forEach((n) => (payload[n.name] = Number(values[n.name])));
      info.schema.categorical.forEach((c) => (payload[c.name] = values[c.name]));
      setResult(await api.predict(payload));
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header>
        <Eyebrow>Approval prediction · machine learning</Eyebrow>
        <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-tight text-fg sm:text-6xl">
          What the data <span className="text-lavender">suggests.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
          A logistic-regression model trained on the project&apos;s historical loan-approval dataset. It estimates
          whether an application <em>resembling</em> yours was approved in that data. It does not predict default, and
          it is separate from the EMI calculator.
        </p>
      </header>

      <div role="note" className="mt-6 flex items-start gap-3 rounded-2xl border border-[#e8c47a]/30 bg-[#e8c47a]/5 px-4 py-3 text-[13px] leading-relaxed text-[#ecd3a0]">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Not a bank decision. Real lenders use their own criteria, verified documents and credit-bureau data. Monetary
          fields use the dataset&apos;s own units (currency not specified in the source data), so treat results as
          illustrative.
        </p>
      </div>

      {infoError ? (
        <div className="mt-8">
          <ErrorNotice message={infoError} />
        </div>
      ) : !info ? (
        <Skeleton className="mt-8 h-[600px] rounded-[var(--radius-card)]" />
      ) : (
        <>
          <div className="mt-8 grid gap-5 lg:grid-cols-12">
            <Card className="p-5 sm:p-7 lg:col-span-7">
              <form onSubmit={submit} noValidate>
                <CardHeader title="Applicant profile" description="Prefilled with training-set medians and the first option of each category. Hints show the range seen in training." />
                <div className="mt-6 space-y-8">
                  {GROUPS.map((g) => (
                    <fieldset key={g.title}>
                      <legend className="text-[11px] font-medium tracking-[0.18em] text-subtle uppercase">{g.title}</legend>
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        {g.fields.map((name) => {
                          const spec = numeric.get(name);
                          const opts = categorical.get(name);
                          const id = `f-${name}`;
                          const out = spec && values[name] !== "" && (Number(values[name]) < spec.min || Number(values[name]) > spec.max);
                          return (
                            <div key={name}>
                              <label htmlFor={id} className="text-[13px] text-muted">
                                {LABELS[name] ?? name}
                              </label>
                              {opts ? (
                                <select
                                  id={id}
                                  value={values[name] ?? ""}
                                  onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-bg px-3 text-[15px] text-fg focus:border-lavender"
                                >
                                  {opts.map((o) => (
                                    <option key={o}>{o}</option>
                                  ))}
                                </select>
                              ) : spec ? (
                                <>
                                  <input
                                    id={id}
                                    type="number"
                                    inputMode="decimal"
                                    step={spec.integer ? 1 : "any"}
                                    value={values[name] ?? ""}
                                    onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
                                    aria-invalid={!!fieldErrors[name]}
                                    aria-describedby={`${id}-hint`}
                                    className={cn(
                                      "tabular mt-1.5 h-11 w-full rounded-xl border bg-bg px-3 text-[15px] text-fg outline-none focus:border-lavender",
                                      fieldErrors[name] ? "border-danger/60" : "border-border",
                                    )}
                                  />
                                  <p id={`${id}-hint`} className={cn("mt-1 text-[11px]", fieldErrors[name] ? "text-danger" : out ? "text-[#ecd3a0]" : "text-subtle")}>
                                    {fieldErrors[name] ??
                                      `${out ? "Outside training range: " : "Training range "}${formatNumber(spec.min)} – ${formatNumber(spec.max)}${MONEY_FIELDS.has(name) ? " (dataset units)" : ""}`}
                                  </p>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button type="submit" variant="lavender" size="lg" disabled={busy || Object.keys(fieldErrors).length > 0}>
                    {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Run prediction
                  </Button>
                  {Object.keys(fieldErrors).length > 0 && <p className="text-[13px] text-danger">Fix the highlighted fields.</p>}
                </div>
              </form>
            </Card>

            <div className="flex flex-col gap-5 lg:col-span-5">
              <ResultCard result={result} error={error} busy={busy} />
              {result && result.contributions.length > 0 && <Explanation result={result} />}
            </div>
          </div>

          <ModelCard info={info} />
        </>
      )}
    </div>
  );
}

function ResultCard({ result, error, busy }: { result: Prediction | null; error: string | null; busy: boolean }) {
  if (error) return <ErrorNotice message={error} />;
  if (!result)
    return (
      <Card aria-live="polite">
        <EmptyState icon={Sparkles} title={busy ? "Running the model…" : "No prediction yet"}>
          Fill in the profile and run the prediction. Results appear here with an explanation of what drove them.
        </EmptyState>
      </Card>
    );
  const approved = result.approved;
  return (
    <section
      aria-live="polite"
      className={cn("rounded-[var(--radius-card)] p-6 sm:p-7", approved ? "bg-mint text-mint-ink" : "border border-border bg-surface text-fg")}
    >
      <p className="flex items-center gap-2 text-[13px] font-medium opacity-80">
        {approved ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4 text-chart-3" aria-hidden />}
        Model output · {result.model_label}
      </p>
      <h2 className="mt-3 font-serif text-[40px] leading-none">{approved ? "Likely approved" : "Likely not approved"}</h2>
      <p className={cn("mt-4 text-sm", approved ? "opacity-80" : "text-muted")}>
        Estimated approval probability <strong className="tabular text-lg">{pct(result.probability)}</strong> (decision
        threshold {pct(result.threshold)}). A hypothetical applicant with average values for every feature scores {pct(result.baseline_probability)}.
      </p>
      <div className={cn("mt-4 h-2 overflow-hidden rounded-full", approved ? "bg-mint-ink/15" : "bg-surface-3")} role="img" aria-label={`Probability ${pct(result.probability)}`}>
        <div className={cn("h-full rounded-full", approved ? "bg-mint-ink" : "bg-chart-3")} style={{ width: `${result.probability * 100}%` }} />
      </div>
      {result.out_of_range.length > 0 && (
        <p className={cn("mt-4 flex items-start gap-2 text-[13px]", approved ? "opacity-80" : "text-[#ecd3a0]")}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Outside the training data range: {result.out_of_range.map((f) => LABELS[f] ?? f).join(", ")}. The model is
          extrapolating, so treat this result with extra caution.
        </p>
      )}
    </section>
  );
}

function Explanation({ result }: { result: Prediction }) {
  const [all, setAll] = useState(false);
  const rows = all ? result.contributions : result.contributions.slice(0, 7);
  const max = Math.max(...result.contributions.map((c) => Math.abs(c.log_odds)), 1e-9);
  return (
    <Card className="p-6">
      <CardHeader
        title="Why the model said this"
        description="Each feature's exact contribution to the model's log-odds, relative to the average training applicant. Linear model, so these add up to the final score."
      />
      <ul className="mt-5 space-y-3">
        {rows.map((c) => {
          const up = c.log_odds >= 0;
          return (
            <li key={c.feature}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-fg">
                  {LABELS[c.feature] ?? c.feature}{" "}
                  <span className="text-subtle">= {typeof c.value === "number" ? formatNumber(c.value) : c.value}</span>
                </span>
                <span className={cn("tabular shrink-0", up ? "text-mint" : "text-[#e7a3bf]")}>
                  {up ? "▲ +" : "▼ −"}
                  {Math.abs(c.log_odds).toFixed(2)}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-0.5" aria-hidden>
                <div className="flex justify-end">
                  {!up && <span className="h-1.5 rounded-l-full bg-chart-3" style={{ width: `${(Math.abs(c.log_odds) / max) * 100}%` }} />}
                </div>
                <div>{up && <span className="block h-1.5 rounded-r-full bg-chart-2" style={{ width: `${(c.log_odds / max) * 100}%` }} />}</div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between text-[11px] text-subtle">
        <span>▼ lowers approval odds</span>
        <span>raises approval odds ▲</span>
      </div>
      {result.contributions.length > 7 && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setAll((a) => !a)}>
          {all ? "Show fewer" : `Show all ${result.contributions.length} features`}
        </Button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-subtle">
        Contributions show association in this dataset, not causation. Credit score and DTI enter the model squared,
        as in the original notebook.
      </p>
    </Card>
  );
}

function ModelCard({ info }: { info: ModelInfo }) {
  const t = info.test_metrics;
  const cm = t.confusion_matrix;
  const metrics: [string, string, string][] = [
    ["Accuracy", pct(t.accuracy), "Share of test applications classified correctly"],
    ["Precision", pct(t.precision), "Of predicted approvals, how many were approved"],
    ["Recall", pct(t.recall), "Of actual approvals, how many were found"],
    ["F1", t.f1.toFixed(3), "Balance of precision and recall"],
    ["ROC-AUC", t.roc_auc.toFixed(3), "Ranking quality across thresholds"],
    ["Brier score", t.brier.toFixed(3), "Probability accuracy (lower is better)"],
  ];
  return (
    <section aria-labelledby="model-card" className="mt-12">
      <h2 id="model-card" className="font-serif text-4xl text-fg">
        Model card
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        Evaluated once on a held-out, stratified test set of {info.split.test_rows} applications that were never used
        for training or model selection. Trained {new Date(info.trained_at).toLocaleDateString("en-IN")} with
        scikit-learn {info.sklearn_version}.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-8">
          <CardHeader title={`Selected: ${info.selected.label}${info.selected.engineered_features ? " + squared features" : ""}`} description={info.selection_rule} />
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {metrics.map(([k, v, d]) => (
              <div key={k} className="rounded-2xl border border-border bg-surface-2/50 p-4">
                <dt className="text-xs text-subtle">{k}</dt>
                <dd className="tabular mt-1 font-serif text-3xl text-fg">{v}</dd>
                <dd className="mt-1 text-[11px] leading-snug text-subtle">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6 lg:col-span-4">
          <CardHeader title="Confusion matrix" description="Held-out test set" />
          <table className="tabular mt-5 w-full text-center text-sm">
            <caption className="sr-only">Confusion matrix</caption>
            <thead>
              <tr className="text-[11px] text-subtle">
                <th />
                <th scope="col" className="pb-2 font-medium">Pred. not approved</th>
                <th scope="col" className="pb-2 font-medium">Pred. approved</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="pr-2 text-right text-[11px] font-medium text-subtle">Actually not</th>
                <td className="rounded-tl-xl bg-surface-3 p-4 text-lg text-fg">{cm.tn}</td>
                <td className="rounded-tr-xl bg-surface-2 p-4 text-lg text-muted">{cm.fp}</td>
              </tr>
              <tr>
                <th scope="row" className="pr-2 text-right text-[11px] font-medium text-subtle">Actually approved</th>
                <td className="rounded-bl-xl bg-surface-2 p-4 text-lg text-muted">{cm.fn}</td>
                <td className="rounded-br-xl bg-surface-3 p-4 text-lg text-fg">{cm.tp}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card className="mt-5 p-6">
        <CardHeader
          title="All candidates (5-fold cross-validation on the training set)"
          description="The three algorithms from the original notebook, each with and without its engineered features. Mean ± standard deviation across folds."
        />
        <div className="mt-5 overflow-x-auto">
          <table className="tabular w-full min-w-[620px] text-right text-[13px]">
            <thead className="text-[11px] tracking-wide text-subtle uppercase">
              <tr>
                <th scope="col" className="pb-3 text-left font-medium">Model</th>
                <th scope="col" className="pb-3 font-medium">Accuracy</th>
                <th scope="col" className="pb-3 font-medium">Precision</th>
                <th scope="col" className="pb-3 font-medium">Recall</th>
                <th scope="col" className="pb-3 font-medium">F1</th>
                <th scope="col" className="pb-3 font-medium">ROC-AUC</th>
              </tr>
            </thead>
            <tbody>
              {info.cv_results.map((r) => {
                const chosen = r.key === info.selected.key && r.engineered_features === info.selected.engineered_features;
                return (
                  <tr key={`${r.key}-${r.engineered_features}`} className={cn("border-t border-border", chosen && "text-mint")}>
                    <th scope="row" className={cn("py-2.5 text-left font-normal", chosen ? "text-mint" : "text-fg")}>
                      {r.label}
                      {r.engineered_features && <span className="text-subtle"> + squared</span>}
                      {chosen && <span className="ml-2 rounded-full bg-mint/15 px-2 py-0.5 text-[10px]">selected</span>}
                    </th>
                    <td>{r.accuracy.toFixed(3)}</td>
                    <td>{r.precision.toFixed(3)}</td>
                    <td>{r.recall.toFixed(3)}</td>
                    <td>
                      {r.f1.toFixed(3)} <span className="text-subtle">±{r.f1_std.toFixed(3)}</span>
                    </td>
                    <td>{r.roc_auc.toFixed(3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <CardHeader title="Data" as="h3" />
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-muted">
            <li>
              {info.dataset.rows_total} rows in <code className="text-fg">loan_approval_data.csv</code>;{" "}
              {info.dataset.rows_missing_target_dropped} had no approval label and were dropped (the notebook had imputed them).
            </li>
            <li>
              {info.dataset.rows_used} labelled rows: {info.dataset.approved} approved, {info.dataset.not_approved} not approved.
            </li>
            <li>
              Split {info.split.train_rows} train / {info.split.test_rows} test, stratified, seed {info.split.random_state}.
            </li>
            <li>Target is approval, not repayment — the dataset has no default outcome.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <CardHeader title="Changes from the notebook" as="h3" />
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-muted">
            <li>Imputers, scaler and one-hot encoder are now fitted on training rows only, inside one pipeline.</li>
            <li>Model selection uses cross-validation; the test set is used once.</li>
            <li>
              {info.excluded_features.join(", ")} is excluded as a protected attribute. Including it gave CV F1{" "}
              {info.excluded_feature_sensitivity.f1.toFixed(3)} vs{" "}
              {info.cv_results.find((r) => r.key === info.selected.key && r.engineered_features === info.selected.engineered_features)?.f1.toFixed(3)}{" "}
              without — within fold-to-fold noise.
            </li>
          </ul>
        </Card>
      </div>
    </section>
  );
}
