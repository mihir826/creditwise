import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/states";
import { CompareView } from "./compare-view";

export const metadata: Metadata = { title: "Compare loans" };

export default function ComparePage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] w-full rounded-[var(--radius-card)]" />}>
      <CompareView />
    </Suspense>
  );
}
