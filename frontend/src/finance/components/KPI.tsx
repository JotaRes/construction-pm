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
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <div className={cls(
        "kpi-value",
        tone === "positive" && "text-positive",
        tone === "negative" && "text-negative",
        tone === "warn" && "text-warn",
        tone === "accent" && "text-accent",
      )}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
