import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/states";
import { CalculatorView } from "./calculator-view";

export const metadata: Metadata = { title: "EMI calculator" };

export default function CalculatorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-[var(--radius-card)]" />}>
      <CalculatorView />
    </Suspense>
  );
}
