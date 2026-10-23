"use client";

import { Bookmark, Download, FileSpreadsheet, FileText, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BreakdownDonut } from "@/components/charts/breakdown-donut";
import { LegendItem, SERIES } from "@/components/charts/common";
import { BalanceChart } from "@/components/charts/repayment-chart";
import { YearlyChart } from "@/components/charts/yearly-chart";
import { AmortizationTable } from "@/components/loan/amortization-table";
import { LoanInputs } from "@/components/loan/loan-inputs";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Eyebrow } from "@/components/ui/card";
import { NameDialog } from "@/components/ui/dialog";
import { Money } from "@/components/ui/money";
import { ErrorNotice, Skeleton } from "@/components/ui/states";
import { useDebouncedRequest } from "@/hooks/use-calculation";
import { api, downloadBlob, errorMessage } from "@/lib/api";
import { formatINR, formatPercent, formatTenure } from "@/lib/format";
import { DEFAULT_FORM, formFromParams, validateLoanForm, type LoanFormState } from "@/lib/loan-form";

export function CalculatorView() {
  const params = useSearchParams();
  const router = useRouter();
  const savedId = params.get("id");
  const [form, setForm] = useState<LoanFormState>(DEFAULT_FORM);
  const [loadedFrom, setLoadedFrom] = useState<{ id: number; name: string } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  // Reopen a saved calculation: /calculator?id=12
  useEffect(() => {
    if (!savedId) return;
    const id = Number(savedId);
    if (!Number.isInteger(id)) return;
    let cancelled = false;
    api
      .getSaved(id)
      .then((rec) => {
        if (cancelled) return;
        setForm(formFromParams(rec.loan));
        setLoadedFrom({ id: rec.id, name: rec.name });
      })
      .catch((err) => !cancelled && toast.error("Could not open saved calculation", { description: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [savedId]);

  const { params: loan, errors } = useMemo(() => validateLoanForm(form), [form]);
  const { data, error, loading } = useDebouncedRequest(loan, api.calculate);
  const stale = !loan; // invalid input: keep showing nothing rather than an outdated result
  const result = stale ? null : data;
  const s = result?.summary;

  const balancePoints = useMemo(
    () => (result ? [{ month: 0, balance: result.summary.principal }, ...result.schedule.map((r) => ({ month: r.month, balance: r.closing_balance }))] : []),
    [result],
  );

  async function download(kind: "pdf" | "csv") {
    if (!loan) return;
    setBusy(kind);
    try {
      if (kind === "pdf") {
        const blob = await api.reportPdf(loan, loadedFrom?.name);
        downloadBlob(blob, `creditwise-${(loadedFrom?.name ?? "loan-estimate").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
        toast.success("PDF report downloaded");
      } else {
        downloadBlob(await api.scheduleCsv(loan), "creditwise-amortization-schedule.csv");
        toast.success("Schedule exported as CSV");
      }
    } catch (err) {
      toast.error(kind === "pdf" ? "Could not generate the PDF" : "Could not export CSV", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setForm(DEFAULT_FORM);
    setLoadedFrom(null);
    if (savedId) router.replace("/calculator");
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>EMI calculator</Eyebrow>
          <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-tight text-fg sm:text-6xl">
            What will it <span className="text-mint">really</span> cost?
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            Fixed-rate, monthly reducing balance. Every figure below is calculated from your inputs — nothing is
            pre-filled from a lender.
          </p>
        </div>
        {loadedFrom && (
          <p className="rounded-full border border-border bg-surface px-4 py-2 text-[13px] text-muted">
            Loaded from <span className="text-fg">{loadedFrom.name}</span> · edits aren&apos;t saved automatically
          </p>
        )}
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-12">
        {/* Inputs */}
        <Card className="p-6 sm:p-7 lg:col-span-5 lg:self-start">
          <CardHeader
            title="Loan details"
            action={
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw /> Reset
              </Button>
            }
          />
          <div className="mt-6">
            <LoanInputs state={form} errors={errors} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
          </div>
        </Card>

        {/* Results */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card className="relative overflow-hidden p-6 sm:p-8" aria-live="polite" aria-busy={loading}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-muted">Monthly EMI</p>
              {loading && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Updating" />}
            </div>
            {error && !stale ? (
              <div className="mt-4">
                <ErrorNotice message={error} />
              </div>
            ) : stale ? (
              <p className="mt-4 text-sm text-muted">Fix the highlighted inputs to see your EMI.</p>
            ) : s ? (
              <>
                <p className="mt-2 font-serif text-[52px] leading-none tracking-tight text-fg sm:text-[72px]">
                  <Money value={s.emi} decimalsClassName="text-subtle" />
                </p>
                <p className="mt-3 text-[13px] text-muted">
                  for {formatTenure(result!.input.tenure_months)} at {result!.input.annual_rate}% p.a.
                  {s.final_payment !== s.emi && <> · final instalment {formatINR(s.final_payment)} (rounding)</>}
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-6 sm:grid-cols-3">
                  <Metric label="Principal" value={formatINR(s.principal)} />
                  <Metric label="Total interest" value={formatINR(s.total_interest)} />
                  <Metric label="Total repayment" value={formatINR(s.total_payment)} note="Principal + interest" />
                  <Metric label="Processing fee" value={formatINR(s.fee_amount)} note="Upfront" />
                  <Metric label="Total borrowing cost" value={formatINR(s.total_borrowing_cost)} note="Interest + fee" />
                  <Metric
                    label="Effective monthly cost"
                    value={formatINR(s.effective_monthly_cost)}
                    note="(Instalments + fee) ÷ months"
                  />
                </dl>
              </>
            ) : (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-16 w-2/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card className="p-6">
              <CardHeader title="Where your money goes" description="Share of total outflow" />
              <div className="mt-6">
                {s ? (
                  <BreakdownDonut principal={s.principal} interest={s.total_interest} fee={s.fee_amount} size={150} />
                ) : (
                  <Skeleton className="h-40 w-full" />
                )}
              </div>
            </Card>
            <Card className="flex flex-col bg-lavender p-6 text-lavender-ink" id="report">
              <p className="text-[13px] font-medium opacity-70">Interest insight</p>
              {s ? (
                <>
                  <p className="mt-3 font-serif text-[28px] leading-[1.1]">
                    {s.total_interest > 0 ? (
                      <>
                        Interest is {formatPercent(s.interest_share_pct, 1)} of everything you repay.
                      </>
                    ) : (
                      <>This loan carries no interest.</>
                    )}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed opacity-75">
                    {s.total_interest > 0 && (
                      <>
                        Each ₹1 borrowed costs ₹{(s.total_interest / s.principal).toFixed(2)} in interest.{" "}
                      </>
                    )}
                    {s.fee_amount > 0 && (
                      <>With the upfront fee, the effective rate is {formatPercent(s.effective_annual_rate)} vs {result!.input.annual_rate}% quoted.</>
                    )}
                  </p>
                </>
              ) : (
                <Skeleton className="mt-3 h-20 w-full bg-lavender-ink/10" />
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-6">
                <Button variant="dark" size="sm" disabled={!s} onClick={() => setSaveOpen(true)}>
                  <Bookmark /> Save
                </Button>
                <Button variant="dark" size="sm" disabled={!s || busy !== null} onClick={() => download("pdf")}>
                  {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} PDF report
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <CardHeader
            title="Balance over time"
            description="Outstanding principal after each monthly payment"
          />
          <div className="mt-6">{result ? <BalanceChart data={balancePoints} height={260} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
        <Card className="p-6">
          <CardHeader
            title="Repayment timeline"
            description="Principal and interest repaid in each loan year"
            action={
              <div className="flex gap-4">
                <LegendItem color={SERIES.principal} label="Principal" />
                <LegendItem color={SERIES.interest} label="Interest" />
              </div>
            }
          />
          <div className="mt-6">{result ? <YearlyChart data={result.yearly} height={260} /> : <Skeleton className="h-[260px]" />}</div>
        </Card>
      </div>

      {/* Schedule */}
      <Card className="mt-5 p-6 sm:p-7">
        <CardHeader
          title="Amortization schedule"
          description={
            result
              ? `${result.schedule.length} payments. Interest is charged on the outstanding balance each month; the final instalment absorbs rounding so the balance ends at exactly ₹0.00.`
              : "Month-by-month breakdown"
          }
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!result || busy !== null} onClick={() => download("csv")}>
                {busy === "csv" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Export CSV
              </Button>
              <Button variant="outline" size="sm" disabled={!result || busy !== null} onClick={() => download("pdf")}>
                <Download /> PDF
              </Button>
            </div>
          }
        />
        <div className="mt-6">
          {result ? (
            <AmortizationTable key={result.schedule.length} schedule={result.schedule} yearly={result.yearly} />
          ) : (
            <Skeleton className="h-80" />
          )}
        </div>
      </Card>

      <p className="mt-6 text-xs leading-relaxed text-subtle">
        Estimates only — not a lender quote. Excludes GST on fees, insurance, prepayments and floating-rate resets.{" "}
        <Link href="/methodology" className="underline underline-offset-2 hover:text-fg">
          How we calculate
        </Link>
      </p>

      <NameDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save calculation"
        description="Saved calculations are stored in the CreditWise backend's local SQLite database (single-user, no login)."
        initialName={loadedFrom ? `${loadedFrom.name} (copy)` : ""}
        submitLabel="Save"
        onSubmit={async (name) => {
          if (!loan) return;
          const rec = await api.createSaved(name, loan);
          setLoadedFrom({ id: rec.id, name: rec.name });
          toast.success("Calculation saved", {
            description: rec.name,
            action: { label: "View all", onClick: () => router.push("/saved") },
          });
        }}
      />
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="tabular mt-1 truncate text-[15px] font-medium text-fg sm:text-base">{value}</dd>
      {note && <dd className="mt-0.5 text-[11px] text-subtle">{note}</dd>}
    </div>
  );
}
