import { ReactNode } from "react";
import { cls } from "../lib/format";

export function KPI({
  label, value, hint, tone = "default", icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "warn" | "accent";
  icon?: ReactNode;
}) {
  return (
    <div className={cls(
      "kpi-card",
      tone === "positive" && "kpi-card-green",
      tone === "negative" && "kpi-card-red",
      tone === "warn" && "kpi-card-amber",
      tone === "accent" && "kpi-card-gold",
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>{label}</span>
        {icon && <span style={{ color: 'var(--brand-gold)' }}>{icon}</span>}
      </div>
      <div className={cls(
        "text-2xl font-bold font-mono",
        tone === "positive" && "text-emerald-600",
        tone === "negative" && "text-red-600",
        tone === "warn" && "text-amber-600",
        tone === "default" && "text-stone-800",
        tone === "accent" && "text-stone-800",
      )} style={tone === "default" || tone === "accent" ? { color: 'var(--brand-teal)' } : {}}>{value}</div>
      {hint && <div className="text-[11px] mt-1" style={{ color: 'var(--brand-teal2)', opacity: 0.7 }}>{hint}</div>}
    </div>
  );
}
