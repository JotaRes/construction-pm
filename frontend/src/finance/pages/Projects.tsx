import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { API } from "../lib/api";
import { usd } from "../lib/format";
import { Modal } from "../components/Modal";
import { Plus, Trash2, Briefcase, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

export default function Projects() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["projects"], queryFn: API.getProjects });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => API.deleteProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Proyecto eliminado"); },
  });

  if (!data) return <div className="text-slate-400">Cargando…</div>;

  const projects = data;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="text-sm text-slate-400">{projects.length} proyectos en el portafolio</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> Nuevo proyecto</button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p: any) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card p-4 hover:bg-bg-hover transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Briefcase size={16} className="text-accent" />
                <span className="font-mono text-xs text-slate-400">{p.code}</span>
              </div>
              <span className="badge bg-bg-hover text-slate-300">{p.status}</span>
            </div>
            <h3 className="font-semibold mb-1">{p.name}</h3>
            <div className="text-xs text-slate-500 mb-3">{p.spv?.name || "Sin SPV"} · {p.line || "Sin línea"} · {p.model || "Sin modelo"}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-slate-500">ARV</span><div className="font-mono">{usd(p.arv, { compact: true })}</div></div>
              <div><span className="text-slate-500">Costo esperado</span><div className="font-mono">{usd(p.expectedCost, { compact: true })}</div></div>
              <div><span className="text-slate-500">Movimientos</span><div className="font-mono">{p._count?.movements || 0}</div></div>
              <div><span className="text-slate-500">Préstamos</span><div className="font-mono">{p._count?.loans || 0}</div></div>
            </div>
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-line">
              <button onClick={(e) => { e.preventDefault(); if (confirm("¿Eliminar proyecto?")) del.mutate(p.id); }} className="btn-ghost text-negative p-1"><Trash2 size={14} /></button>
              <ChevronRight size={14} className="text-slate-500" />
            </div>
          </Link>
        ))}
      </div>

      <ProjectModal open={open} onClose={() => setOpen(false)} catalogs={catalogs} />
    </div>
  );
}

function ProjectModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", line: "", model: "", status: "Enlistado", spvId: "", address: "", purchasePrice: 0, arv: 0, expectedCost: 0 });
  const mut = useMutation({
    mutationFn: (data: any) => API.createProject(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Proyecto creado"); onClose(); },
  });

  return (
    <Modal open={open} onClose={onClose} title="Nuevo proyecto" size="lg">
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate({ ...form, spvId: form.spvId ? +form.spvId : null, purchasePrice: +form.purchasePrice, arv: +form.arv, expectedCost: +form.expectedCost }); }} className="grid md:grid-cols-2 gap-3">
        <div><label className="label">Código</label><input className="input w-full" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
        <div><label className="label">Nombre</label><input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
        <div><label className="label">Línea</label>
          <select className="select w-full" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
            <option value="">—</option><option>Carolina del Sur</option><option>Florida</option><option>Detroit</option><option>Otro</option>
          </select>
        </div>
        <div><label className="label">Modelo</label>
          <select className="select w-full" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            <option value="">—</option><option>Fix & Flip</option><option>Land Sell</option><option>New Construction</option><option>Buy & Hold</option>
          </select>
        </div>
        <div><label className="label">Estado</label>
          <select className="select w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Enlistado</option><option>En Construcción</option><option>Vendido</option><option>Pausado</option><option>Cerrado</option>
          </select>
        </div>
        <div><label className="label">SPV</label>
          <select className="select w-full" value={form.spvId} onChange={(e) => setForm({ ...form, spvId: e.target.value })}>
            <option value="">—</option>
            {catalogs?.spvs?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2"><label className="label">Dirección</label><input className="input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div><label className="label">Precio compra</label><input type="number" className="input w-full" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })} /></div>
        <div><label className="label">ARV</label><input type="number" className="input w-full" value={form.arv} onChange={(e) => setForm({ ...form, arv: +e.target.value })} /></div>
        <div><label className="label">Costo esperado</label><input type="number" className="input w-full" value={form.expectedCost} onChange={(e) => setForm({ ...form, expectedCost: +e.target.value })} /></div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary">Crear</button>
        </div>
      </form>
    </Modal>
  );
}
