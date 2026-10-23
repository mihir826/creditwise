"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-24 text-center">
      <h1 className="font-serif text-5xl text-fg">Something went wrong.</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        This page hit an unexpected error. Your saved calculations are unaffected.
        {error.digest && <span className="mt-2 block text-xs text-subtle">Reference: {error.digest}</span>}
      </p>
      <Button variant="lavender" className="mt-8" onClick={reset}>
        <RotateCcw /> Try again
      </Button>
    </div>
  );
}
