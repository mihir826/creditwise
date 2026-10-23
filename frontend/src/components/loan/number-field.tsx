"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SliderSpec {
  min: number;
  max: number;
  step: number;
  /** Map between the field's value and slider position (e.g. log scale). */
  toSlider?: (v: number) => number;
  fromSlider?: (s: number) => number;
}

export function NumberField({
  label,
  value,
  onChange,
  parsed,
  prefix,
  suffix,
  hint,
  error,
  slider,
  inputMode = "decimal",
  compact,
  sliderLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  parsed: number | null;
  prefix?: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  error?: string;
  slider?: SliderSpec;
  inputMode?: "decimal" | "numeric";
  compact?: boolean;
  sliderLabels?: [string, string];
}) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  const toS = slider?.toSlider ?? ((v: number) => v);
  const fromS = slider?.fromSlider ?? ((s: number) => s);
  const sliderValue =
    slider && parsed !== null ? Math.min(slider.max, Math.max(slider.min, toS(parsed))) : (slider?.min ?? 0);
  const fill = slider ? ((sliderValue - slider.min) / (slider.max - slider.min)) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] text-muted">
          {label}
        </label>
        {hint && !error && (
          <span id={`${id}-hint`} className="tabular truncate text-xs text-subtle">
            {hint}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-2 flex items-center rounded-xl border bg-bg transition-colors focus-within:border-lavender",
          error ? "border-danger/60" : "border-border hover:border-border-strong",
          compact ? "h-10" : "h-12",
        )}
      >
        {prefix && <span className="pl-3.5 text-muted">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            "tabular h-full w-full min-w-0 bg-transparent px-3.5 text-fg outline-none",
            prefix && "pl-1.5",
            compact ? "text-[15px]" : "text-[17px]",
          )}
        />
        {suffix && <span className="flex shrink-0 items-center pr-1.5 text-sm text-muted">{suffix}</span>}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
      {slider && (
        <div className="mt-3">
          <input
            type="range"
            className="cw-range"
            aria-label={`${label} slider`}
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={sliderValue}
            style={{ ["--fill" as string]: `${fill}%` }}
            onChange={(e) => onChange(String(fromS(Number(e.target.value))))}
          />
          {sliderLabels && (
            <div className="mt-1 flex justify-between text-[11px] text-subtle">
              <span>{sliderLabels[0]}</span>
              <span>{sliderLabels[1]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
