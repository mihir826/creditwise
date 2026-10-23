import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-[var(--radius-card)] border border-border bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading className="text-[15px] font-medium text-fg">{title}</Heading>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-[11px] font-medium tracking-[0.18em] text-subtle uppercase", className)} {...props} />;
}
