import { cn } from "@/lib/cn";
import { splitINR } from "@/lib/format";

/** Amount with de-emphasised paise, like "₹43,391.16". */
export function Money({ value, className, decimalsClassName }: { value: number; className?: string; decimalsClassName?: string }) {
  const [whole, frac] = splitINR(value);
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {whole}
      <span className={cn("text-muted", decimalsClassName)}>{frac}</span>
    </span>
  );
}
