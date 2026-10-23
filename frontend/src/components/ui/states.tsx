import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full border border-border bg-surface-2 text-lavender">
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-5 font-serif text-2xl text-fg">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {action}
    </div>
  );
}
