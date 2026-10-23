"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  ChevronRight,
  FileText,
  GitCompareArrows,
  Info,
  Landmark,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LegendItem, SERIES } from "@/components/charts/common";
import { BalanceChart, PaymentSplitChart } from "@/components/charts/repayment-chart";
import { LogoMark } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/states";
import { api, errorMessage } from "@/lib/api";
import { formatINR, formatPercent, formatTenure } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

type Range = "12" | "60" | "120" | "all";
type Mode = "balance" | "payments";

export function DashboardView() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [mode, setMode] = useState<Mode>("balance");

  // Re-runs whenever the page becomes visible again (Activity), so saved
  // changes made elsewhere are reflected.
  useEffect(() => {
    let cancelled = false;
    api
      .dashboard()
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const longest = data?.longest_tenure_months ?? 0;
  const points = useMemo(() => {
    if (!data?.series.length) return [];
    const limit = range === "all" ? Infinity : Number(range);
    const start = { month: 0, balance: data.total_principal, principal: 0, interest: 0 };
    return [start, ...data.series].filter((p) => p.month <= limit);
  }, [data, range]);

  const empty = data?.count === 0;

  return (
    <div>
      <Hero />

      {error && (
        <div className="mt-8">
          <ErrorNotice message={error} />
        </div>
      )}

      <div className="mt-10 grid gap-5 lg:grid-cols-12">
        {/* Overview chart */}
        <Card className="p-5 sm:p-7 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[15px] text-muted">
                Total principal
                <span className="text-subtle">·</span>
                <span className="text-subtle">{data ? `${data.count} saved loan${data.count === 1 ? "" : "s"}` : "…"}</span>
              </p>
              {data ? (
                <p className="mt-2 font-serif text-5xl leading-none tracking-tight text-fg sm:text-[64px]">
                  <Money value={data.total_principal} decimalsClassName="text-subtle" />
                </p>
              ) : (
                <Skeleton className="mt-3 h-14 w-64" />
              )}
              {data && data.count > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 text-mint">
                    + {formatINR(data.total_interest)} interest
                  </span>
                  over the life of these loans
                </p>
              )}
            </div>
            {!empty && (
              <div className="flex flex-col items-end gap-2">
                <Segmented
                  label="Chart"
                  value={mode}
                  onChange={setMode}
                  size="sm"
                  options={[
                    { value: "balance", label: "Balance" },
                    { value: "payments", label: "Payments" },
                  ]}
                />
                <Segmented
                  label="Time range"
                  value={range}
                  onChange={setRange}
                  size="sm"
                  options={[
                    { value: "12", label: "1Y", disabled: longest <= 12 },
                    { value: "60", label: "5Y", disabled: longest <= 60 },
                    { value: "120", label: "10Y", disabled: longest <= 120 },
                    { value: "all", label: "All" },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            {!data ? (
              <Skeleton className="h-[300px]" />
            ) : empty ? (
              <EmptyState
                icon={Wallet}
                title="No saved loans yet"
                action={
                  <ButtonLink href="/calculator" variant="lavender">
                    Calculate your first EMI <ArrowRight />
                  </ButtonLink>
                }
              >
                Your overview is built only from calculations you save. Run the EMI calculator and save a scenario to
                see your combined balance and repayments here.
              </EmptyState>
            ) : (
              <>
                {mode === "balance" ? <BalanceChart data={points} height={300} /> : <PaymentSplitChart data={points.slice(1)} height={300} />}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-4">
                    {mode === "balance" ? (
                      <LegendItem color={SERIES.line} label="Combined outstanding balance" />
                    ) : (
                      <>
                        <LegendItem color={SERIES.principal} label="Principal" />
                        <LegendItem color={SERIES.interest} label="Interest" />
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-subtle">Assumes every saved loan starts in month 1.</p>
                </div>
              </>
            )}
          </div>

          {!empty && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <StatTile
                icon={Calculator}
                label="Combined monthly EMI"
                value={data ? formatINR(data.total_monthly_emi) : null}
                hint="Sum of regular EMIs across saved loans"
              />
              <StatTile
                icon={Landmark}
                label="Total interest + fees"
                value={data ? formatINR(data.total_interest + data.total_fees) : null}
                hint={data ? `Fees ${formatINR(data.total_fees)}` : undefined}
                tone="lavender"
              />
            </div>
          )}
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <InsightCard data={data} />
          <SavedList data={data} />
        </div>
      </div>

      {/* Compare banner */}
      <section className="relative mt-5 overflow-hidden rounded-[var(--radius-card)] bg-mint p-6 text-mint-ink sm:p-8">
        <svg aria-hidden className="pointer-events-none absolute -right-16 -bottom-24 h-80 w-80 text-mint-ink/10" viewBox="0 0 200 200" fill="none" stroke="currentColor">
          <circle cx="100" cy="100" r="99" />
          <circle cx="100" cy="100" r="70" />
          <circle cx="100" cy="100" r="40" />
        </svg>
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-mint-ink/10">
            <GitCompareArrows className="size-6" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-medium opacity-70">Big questions, clearer answers</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight sm:text-[38px]">Which loan offer actually costs less?</h2>
            <p className="mt-1 text-sm opacity-75">Put up to three offers side by side — rate, tenure and fees included.</p>
          </div>
          <ButtonLink href="/compare" variant="primary" size="lg" className="self-start sm:self-center">
            Compare offers <ArrowRight />
          </ButtonLink>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="quick-actions" className="mt-12">
        <h2 id="quick-actions" className="font-serif text-3xl text-fg">
          Quick actions
        </h2>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/calculator" icon={Calculator} title="Calculate EMI" body="Instant EMI, total interest and a full schedule." />
          <QuickAction href="/compare" icon={GitCompareArrows} title="Compare loans" body="Find the lowest total borrowing cost." />
          <QuickAction href="/calculator#report" icon={FileText} title="Generate a report" body="Download a printable PDF with the full schedule." />
          <QuickAction href="/predict" icon={Sparkles} title="Explore predictions" body="See what our trained model learned from loan data." />
        </ul>
      </section>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative">
      <div aria-hidden className="pointer-events-none absolute -top-10 right-0 hidden h-[300px] w-[460px] [mask-image:linear-gradient(to_bottom,black_55%,transparent)] lg:block">
        <svg viewBox="0 0 460 300" className="h-full w-full text-border-strong" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="330" cy="200" r="190" />
          <circle cx="250" cy="250" r="150" opacity="0.6" />
        </svg>
        <LogoMark className="absolute top-[70px] left-[236px] size-8 text-mint" />
        <p className="absolute top-[86px] right-2 text-[11px] leading-[1.9] tracking-[0.2em] text-subtle uppercase">
          Borrow
          <br />
          with
          <br />
          clear
          <br />
          eyes
          <span className="mt-3 block h-px w-6 bg-subtle" />
        </p>
      </div>
      <h1 className="relative font-serif text-[52px] leading-[0.98] tracking-tight text-fg sm:text-7xl lg:text-[88px]">
        Your loans,
        <br />
        <span className="text-mint">under control.</span>
      </h1>
      <p className="relative mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
        Understand your EMIs, compare borrowing options, and plan your financial future with clarity.
      </p>
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "mint",
}: {
  icon: typeof Calculator;
  label: string;
  value: string | null;
  hint?: string;
  tone?: "mint" | "lavender";
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-2/60 p-4 sm:p-5">
      <span
        className={`grid size-12 shrink-0 place-items-center rounded-full ${tone === "mint" ? "bg-mint/10 text-mint" : "bg-lavender/10 text-lavender"}`}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted">{label}</p>
        {value ? <p className="tabular mt-0.5 truncate font-serif text-[26px] leading-tight text-fg">{value}</p> : <Skeleton className="mt-1 h-7 w-36" />}
        {hint && <p className="mt-0.5 truncate text-[11px] text-subtle">{hint}</p>}
      </div>
    </div>
  );
}

function InsightCard({ data }: { data: Dashboard | null }) {
  const has = data && data.count > 0;
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] bg-lavender p-6 text-lavender-ink sm:p-7">
      <svg aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 text-lavender-ink/10" viewBox="0 0 200 200" fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="99" />
        <circle cx="100" cy="100" r="66" />
      </svg>
      <p className="relative flex items-center gap-2 text-[15px] font-medium">
        <LogoMark className="size-4" /> CreditWise insight
      </p>
      {!data ? (
        <Skeleton className="mt-4 h-24 bg-lavender-ink/10" />
      ) : has ? (
        <>
          <h2 className="relative mt-4 font-serif text-[30px] leading-[1.08]">
            {formatPercent(data.interest_share_pct, 1)} of what you&apos;ll repay is interest.
          </h2>
          <p className="relative mt-3 text-[13px] leading-relaxed opacity-75">
            Across {data.count} saved loan{data.count === 1 ? "" : "s"}, you&apos;d repay {formatINR(data.total_payment)} for{" "}
            {formatINR(data.total_principal)} borrowed.
            {data.highest_interest_share && (
              <>
                {" "}
                Highest interest share: <strong className="font-semibold">{data.highest_interest_share.name}</strong> (
                {formatPercent(data.highest_interest_share.interest_share_pct, 1)}).
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <h2 className="relative mt-4 font-serif text-[30px] leading-[1.08]">See how much of each loan is interest.</h2>
          <p className="relative mt-3 text-[13px] leading-relaxed opacity-75">
            Insights appear here once you save a calculation. They&apos;re derived only from your own numbers.
          </p>
        </>
      )}
      <ButtonLink href="/calculator" variant="dark" className="relative mt-6">
        {has ? "New calculation" : "Open calculator"} <ArrowRight />
      </ButtonLink>
    </section>
  );
}

function SavedList({ data }: { data: Dashboard | null }) {
  return (
    <Card className="flex-1 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-3 font-serif text-2xl text-fg">
          Saved loans
          {data && (
            <span className="tabular grid size-7 place-items-center rounded-full border border-border-strong font-sans text-xs text-muted">
              {data.count}
            </span>
          )}
        </h2>
        <Link href="/saved" className="flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {!data ? (
          <>
            <Skeleton className="h-[84px]" />
            <Skeleton className="h-[84px]" />
          </>
        ) : data.recent.length === 0 ? (
          <p className="flex items-start gap-2 rounded-2xl border border-dashed border-border p-4 text-[13px] leading-relaxed text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            Nothing saved yet. Use “Save” in the calculator to keep a scenario.
          </p>
        ) : (
          data.recent.map((r) => {
            const principalShare = 100 - r.interest_share_pct;
            return (
              <Link
                key={r.id}
                href={`/calculator?id=${r.id}`}
                className="group block rounded-2xl border border-border bg-surface-2/50 p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-xl leading-tight text-fg">{r.name}</p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {r.loan.annual_rate}% · {formatTenure(r.loan.tenure_months)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="tabular text-sm text-fg">{formatINR(r.emi)}</p>
                      <p className="text-[11px] text-subtle">per month</p>
                    </div>
                    <ChevronRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </div>
                <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Principal ${formatPercent(principalShare, 1)}, interest ${formatPercent(r.interest_share_pct, 1)} of repayment`}>
                  <span className="rounded-l-full" style={{ width: `${principalShare}%`, background: SERIES.principal }} />
                  <span className="rounded-r-full" style={{ width: `${r.interest_share_pct}%`, background: SERIES.interest }} />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

function QuickAction({ href, icon: Icon, title, body }: { href: string; icon: typeof Calculator; title: string; body: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex h-full flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <div className="flex items-center justify-between">
          <span className="grid size-10 place-items-center rounded-full bg-surface-3 text-lavender">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <ArrowUpRight className="size-4 text-subtle transition-colors group-hover:text-fg" aria-hidden />
        </div>
        <p className="mt-5 text-[15px] font-medium text-fg">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
      </Link>
    </li>
  );
}
