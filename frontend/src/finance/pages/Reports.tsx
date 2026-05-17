import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import { usd } from "../lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, LineChart, Line,
} from "recharts";

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: sources } = useQuery({ queryKey: ["sources-uses"], queryFn: API.getSourcesUses });
  const { data: cashflow } = useQuery({ queryKey: ["cashflow", year], queryFn: () => API.getCashflow(year) });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Reportes & Trazabilidad</h1>
        <p className="text-sm text-slate-400">Fuentes y usos del capital · Flujo mensual · Análisis consolidado</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Fuentes (de dónde viene el dinero)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={sources?.sources?.slice(0, 8) || []} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2230" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "#cbd5e1" }} width={150} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
                <Bar dataKey="amount" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Usos (a dónde va el dinero)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={sources?.uses?.slice(0, 8) || []} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2230" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "#cbd5e1" }} width={150} />
                <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
                <Bar dataKey="amount" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Flujo de caja mensual {year}</h2>
          <select className="select" value={year} onChange={(e) => setYear(+e.target.value)}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={cashflow?.months || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2230" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#cbd5e1" }} tickFormatter={(m) => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1]} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => usd(v, { compact: true })} />
              <Tooltip contentStyle={{ background: "#161b24", border: "1px solid #222a37", borderRadius: 8 }} formatter={(v: any) => usd(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ingresos" stroke="#22c55e" strokeWidth={2} />
              <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="neto" stroke="#5eead4" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
