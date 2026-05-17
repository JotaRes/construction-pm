export const usd = (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
  if (n == null || isNaN(n)) return "$0";
  const sign = opts.sign && n > 0 ? "+" : "";
  if (opts.compact && Math.abs(n) >= 1000) {
    const m = Math.abs(n);
    if (m >= 1e6) return `${sign}$${(n / 1e6).toFixed(2)}M`;
    if (m >= 1e3) return `${sign}$${(n / 1e3).toFixed(1)}K`;
  }
  return sign + n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
};

export const usdPrecise = (n: number) =>
  (n == null ? 0 : n).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const pct = (n: number, digits = 1) => `${((n || 0) * 100).toFixed(digits)}%`;

export const date = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

export const dateShort = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("es-CO", { month: "2-digit", day: "2-digit", year: "2-digit" });
};

export const cls = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");
