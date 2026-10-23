"use client";

import { ArrowRight, Bookmark, Database, FileText, GitCompareArrows, Loader2, Pencil, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SERIES } from "@/components/charts/common";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Eyebrow } from "@/components/ui/card";
import { ConfirmDialog, NameDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorNotice, Skeleton } from "@/components/ui/states";
import { api, downloadBlob, errorMessage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatINR, formatPercent, formatTenure } from "@/lib/format";
import type { SavedCalculation } from "@/lib/types";

export function SavedView() {
  const router = useRouter();
  const [items, setItems] = useState<SavedCalculation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [renaming, setRenaming] = useState<SavedCalculation | null>(null);
  const [deleting, setDeleting] = useState<SavedCalculation | null>(null);
  const [pdfFor, setPdfFor] = useState<number | null>(null);

  const load = useCallback(() => {
    api
      .listSaved()
      .then((list) => {
        setItems(list);
        setError(null);
        setSelected((sel) => sel.filter((id) => list.some((r) => r.id === id)));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(load, [load]);

  function toggle(id: number) {
    setSelected((sel) => {
      if (sel.includes(id)) return sel.filter((x) => x !== id);
      if (sel.length >= 3) {
        toast("You can compare up to three calculations.");
        return sel;
      }
      return [...sel, id];
    });
  }

  async function pdf(r: SavedCalculation) {
    setPdfFor(r.id);
    try {
      const blob = await api.reportPdf(r.loan, r.name);
      downloadBlob(blob, `creditwise-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
      toast.success("PDF report downloaded", { description: r.name });
    } catch (err) {
      toast.error("Could not generate the PDF", { description: errorMessage(err) });
    } finally {
      setPdfFor(null);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Saved calculations</Eyebrow>
          <h1 className="mt-3 font-serif text-[44px] leading-[1.02] tracking-tight text-fg sm:text-6xl">
            Your <span className="text-mint">scenarios</span>, kept.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="lavender"
            disabled={selected.length < 2}
            onClick={() => router.push(`/compare?ids=${selected.join(",")}`)}
          >
            <GitCompareArrows /> Compare selected{selected.length ? ` (${selected.length})` : ""}
          </Button>
          <ButtonLink href="/calculator" variant="outline">
            New calculation
          </ButtonLink>
        </div>
      </header>

      <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-[13px] leading-relaxed text-muted">
        <Database className="mt-0.5 size-4 shrink-0 text-lavender" aria-hidden />
        <span>
          Stored in a SQLite file on the machine running the CreditWise backend. There is no login: this is a
          single-user setup, and anyone with access to that backend can see these records.{" "}
          <Link href="/methodology#storage" className="text-fg underline underline-offset-2">
            Details
          </Link>
        </span>
      </p>

      {error && (
        <div className="mt-6">
          <ErrorNotice
            message={error}
            action={
              <Button size="sm" variant="outline" onClick={load}>
                Retry
              </Button>
            }
          />
        </div>
      )}

      <div className="mt-6">
        {!items && !error ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52 rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : items && items.length === 0 ? (
          <Card>
            <EmptyState
              icon={Bookmark}
              title="Nothing saved yet"
              action={
                <ButtonLink href="/calculator" variant="lavender">
                  Open the calculator <ArrowRight />
                </ButtonLink>
              }
            >
              Save a scenario from the EMI calculator to revisit it, rename it, download its report or compare it with
              others.
            </EmptyState>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {items?.map((r) => {
              const isSelected = selected.includes(r.id);
              return (
                <li key={r.id}>
                  <Card className={cn("flex h-full flex-col p-5 transition-colors sm:p-6", isSelected && "border-lavender/60")}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(r.id)}
                        aria-label={`Select ${r.name} for comparison`}
                        className="mt-2 size-4 shrink-0 accent-[#c5acff]"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate font-serif text-[26px] leading-tight text-fg">{r.name}</h2>
                        <p className="mt-0.5 text-xs text-subtle">
                          Saved {formatDate(r.created_at)}
                          {r.updated_at !== r.created_at && ` · renamed ${formatDate(r.updated_at)}`}
                        </p>
                      </div>
                    </div>

                    <dl className="tabular mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                      <Item label="Loan amount" value={formatINR(r.loan.principal)} />
                      <Item label="Rate" value={`${r.loan.annual_rate}% p.a.`} />
                      <Item label="Tenure" value={formatTenure(r.loan.tenure_months)} />
                      <Item label="EMI" value={formatINR(r.emi)} strong />
                      <Item label="Total interest" value={formatINR(r.total_interest)} />
                      <Item label="Total repayment" value={formatINR(r.total_payment)} />
                    </dl>

                    <div className="mt-4">
                      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                        <span className="rounded-l-full" style={{ width: `${100 - r.interest_share_pct}%`, background: SERIES.principal }} />
                        <span className="rounded-r-full" style={{ width: `${r.interest_share_pct}%`, background: SERIES.interest }} />
                      </div>
                      <p className="mt-1.5 text-[11px] text-subtle">
                        Interest is {formatPercent(r.interest_share_pct, 1)} of total repayment
                        {r.fee_amount > 0 && ` · fee ${formatINR(r.fee_amount)}`}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                      <ButtonLink href={`/calculator?id=${r.id}`} variant="outline" size="sm">
                        <SquareArrowOutUpRight /> Open
                      </ButtonLink>
                      <Button variant="ghost" size="sm" onClick={() => pdf(r)} disabled={pdfFor === r.id}>
                        {pdfFor === r.id ? <Loader2 className="animate-spin" /> : <FileText />} PDF
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenaming(r)}>
                        <Pencil /> Rename
                      </Button>
                      <Button variant="ghost" size="sm" className="hover:text-danger" onClick={() => setDeleting(r)}>
                        <Trash2 /> Delete
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <NameDialog
        open={!!renaming}
        onOpenChange={(o) => !o && setRenaming(null)}
        title="Rename calculation"
        initialName={renaming?.name ?? ""}
        submitLabel="Rename"
        onSubmit={async (name) => {
          if (!renaming) return;
          const updated = await api.renameSaved(renaming.id, name);
          setItems((list) => list?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
          toast.success("Renamed", { description: updated.name });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete calculation?"
        description={
          <>
            “{deleting?.name}” will be permanently removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.deleteSaved(deleting.id);
            setItems((list) => list?.filter((r) => r.id !== deleting.id) ?? null);
            setSelected((sel) => sel.filter((id) => id !== deleting.id));
            toast.success("Calculation deleted");
          } catch (err) {
            toast.error("Could not delete", { description: errorMessage(err) });
            throw err;
          }
        }}
      />
    </div>
  );
}

function Item({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-subtle">{label}</dt>
      <dd className={cn("mt-0.5 truncate", strong ? "font-medium text-fg" : "text-fg/90")}>{value}</dd>
    </div>
  );
}
