const inr2 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inr0 = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const plain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** ₹12,50,000.00 — amounts arrive from the API already rounded to paise. */
export function formatINR(value: number, decimals: 0 | 2 = 2): string {
  return (decimals === 2 ? inr2 : inr0).format(value);
}

/** Splits ₹12,50,000.00 into ["₹12,50,000", ".00"] for typographic emphasis. */
export function splitINR(value: number): [string, string] {
  const text = formatINR(value);
  const dot = text.lastIndexOf(".");
  return dot === -1 ? [text, ""] : [text.slice(0, dot), text.slice(dot)];
}

export function formatNumber(value: number): string {
  return plain.format(value);
}

/** Short Indian notation for axes and hints: ₹45K, ₹12.5L, ₹1.25Cr. */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${trim(abs)}`;
}

/** Spoken-style hint under an amount input: "12.5 lakh", "1.2 crore". */
export function amountInWords(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const trim = (n: number) => n.toFixed(2).replace(/\.?0+$/, "");
  if (value >= 1e7) return `${trim(value / 1e7)} crore`;
  if (value >= 1e5) return `${trim(value / 1e5)} lakh`;
  if (value >= 1e3) return `${trim(value / 1e3)} thousand`;
  return "";
}

export function formatPercent(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatTenure(months: number): string {
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (rem) parts.push(`${rem} mo`);
  return parts.join(" ") || "0 mo";
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
