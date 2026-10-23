"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "./button";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-2xl shadow-black/50 focus:outline-none">
          <div className="flex items-start justify-between gap-4">
            <RadixDialog.Title className="font-serif text-[28px] leading-tight text-fg">{title}</RadixDialog.Title>
            <RadixDialog.Close className="-mt-1 -mr-2 rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          {description ? (
            <RadixDialog.Description className="mt-2 text-sm leading-relaxed text-muted">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          <div className="mt-6">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onOpenChange(false);
            } catch {
              // The caller reports the error; keep the dialog open so the user can retry.
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/** Single text-field dialog used for saving and renaming. */
export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {/* Keyed so the field resets each time the dialog opens. */}
      {open && <NameForm key={initialName} initialName={initialName} submitLabel={submitLabel} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function NameForm({
  initialName,
  submitLabel,
  onSubmit,
  onCancel,
  onDone,
}: {
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Give this calculation a name.");
    if (trimmed.length > 80) return setError("Keep the name under 80 characters.");
    setBusy(true);
    try {
      await onSubmit(trimmed);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="calc-name" className="text-[13px] text-muted">
        Name
      </label>
      <input
        id="calc-name"
        autoFocus
        value={name}
        maxLength={80}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        aria-invalid={!!error}
        aria-describedby={error ? "calc-name-error" : undefined}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-bg px-3.5 text-[15px] text-fg outline-none placeholder:text-subtle focus:border-lavender"
        placeholder="e.g. Home loan — HDFC quote"
      />
      {error && (
        <p id="calc-name-error" role="alert" className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="lavender" disabled={busy}>
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
