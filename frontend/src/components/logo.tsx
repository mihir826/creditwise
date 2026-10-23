import { cn } from "@/lib/cn";

/** Four-petal mark: a quiet nod to "clarity" — two axes meeting at a point. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)} fill="currentColor">
      <rect x="10.6" y="1.5" width="2.8" height="7.5" rx="1.4" />
      <rect x="10.6" y="15" width="2.8" height="7.5" rx="1.4" />
      <rect x="1.5" y="10.6" width="7.5" height="2.8" rx="1.4" />
      <rect x="15" y="10.6" width="7.5" height="2.8" rx="1.4" />
    </svg>
  );
}
