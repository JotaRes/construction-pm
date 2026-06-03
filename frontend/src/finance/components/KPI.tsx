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
  // Mapea tone → clase delta semántica (se aplica al hint cuando es direccional)
  const deltaClass =
    tone === "positive" ? "fin-delta fin-delta-up" :
    tone === "negative" ? "fin-delta fin-delta-down" :
    undefined;

  const iconColor =
    tone === "positive" ? "var(--ok)" :
    tone === "negative" ? "var(--err)" :
    tone === "warn"     ? "var(--warn)" :
    "var(--accent)";

  return (
    <div className="fin-kpi-v2">
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <div className="fin-kpi-lbl">{label}</div>
        {icon && <span style={{ color: iconColor, opacity: 0.85 }}>{icon}</span>}
      </div>
      <div className="fin-kpi-val">{value}</div>
      {hint && (
        <div className="fin-kpi-row">
          {deltaClass
            ? <span className={cls(deltaClass)}>{hint}</span>
            : <span className="fin-kpi-hint">{hint}</span>
          }
        </div>
      )}
    </div>
  );
}
