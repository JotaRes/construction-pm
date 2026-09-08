import { FolderKanban } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { API } from "../lib/api";
import { usd, pct, cls } from "../lib/format";
import { Modal } from "../components/Modal";
import { Plus, Trash2, Briefcase, ChevronRight, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { useConfirm } from "../../components/ConfirmDialog";
import { useI18n } from '../../i18n'
import { dataLabel, FIN_PROJECT_STATUS_LABELS } from '../../i18n/dataLabels'

export default function Projects() {
  const { t } = useI18n()
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data } = useQuery({ queryKey: ["projects"], queryFn: API.getProjects });
  const { data: catalogs } = useQuery({ queryKey: ["catalogs"], queryFn: API.getCatalogs });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: number) => API.deleteProject(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success(t('fin.projs.proyectoEliminado')); },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.accts.errorAlEliminar')),
  });

  if (!data) return <div style={{ color: 'var(--brand-teal)' }}>{t('common.cargando')}</div>;

  const projects = data;

  return (
    <div className="space-y-5 page-content">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><FolderKanban className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('common.proyectos')}</span></h1>
          <p className="text-sm" style={{ color: 'var(--brand-teal2)' }}>{projects.length} {t('fin.projs.proyectosEnElPortafolio')}</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> {t('fin.projs.nuevoProyecto')}</button>
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <Briefcase size={48} className="mx-auto mb-3" style={{ color: 'rgba(29,29,31,0.3)' }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--brand-teal)' }}>{t('fin.projs.aunNoHayProyectos')}</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>{t('fin.projs.creaTuPrimerProyectoParaComenzar')}</p>
          <button onClick={() => setOpen(true)} className="btn-primary mx-auto">
            <Plus size={14} /> {t('fin.projs.crearPrimerProyecto')}
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => {
            const arv = p.arv || 0;
            const expectedCost = p.expectedCost || 0;
            const gananciaEsperada = arv - expectedCost;
            const roiEsperado = expectedCost > 0 ? gananciaEsperada / expectedCost : 0;
            const statusColor =
              p.status === "Vendido" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
              p.status === "En Construcción" ? "bg-amber-100 text-amber-700 border-amber-200" :
              p.status === "Pausado" ? "bg-stone-100 text-stone-600 border-stone-200" :
              p.status === "Cerrado" ? "bg-red-50 text-red-600 border-red-200" :
              "bg-blue-50 text-blue-700 border-blue-200";

            return (
              <Link
                key={p.id}
                to={`/finance/projects/${p.id}`}
                className="card overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--brand-teal) 0%, var(--brand-gold) 100%)' }} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(62,90,112,0.12)', color: 'var(--brand-gold)' }}
                      >
                        <Briefcase size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-wide" style={{ color: 'var(--brand-teal2)' }}>{p.code}</div>
                        <h3 className="font-bold text-base truncate" style={{ color: 'var(--brand-teal)' }} title={p.name}>{p.name}</h3>
                      </div>
                    </div>
                    <span className={cls("badge border text-[10px]", statusColor)}>{dataLabel(FIN_PROJECT_STATUS_LABELS, p.status, t)}</span>
                  </div>

                  {/* SPV + Línea + Modelo */}
                  <div className="flex flex-wrap gap-1 mb-3 text-xs">
                    {p.spv?.code && <span className="px-2 py-0.5 rounded font-mono" style={{ background: 'rgba(29,29,31,0.08)', color: 'var(--brand-teal)' }}>{p.spv.code}</span>}
                    {p.line && <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(62,90,112,0.1)', color: 'var(--brand-gold)' }}>{p.line}</span>}
                    {p.model && <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(29,29,31,0.04)', color: 'var(--brand-teal2)' }}>{p.model}</span>}
                  </div>

                  {p.address && (
                    <div className="flex items-center gap-1 text-xs mb-3" style={{ color: 'var(--brand-teal2)' }}>
                      <MapPin size={11} /> <span className="truncate">{p.address}</span>
                    </div>
                  )}

                  {/* Métricas financieras */}
                  <div className="grid grid-cols-2 gap-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--brand-cream2)' }}>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>ARV</div>
                      <div className="font-mono font-bold text-sm" style={{ color: 'var(--brand-teal)' }}>{usd(arv, { compact: true })}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>{t('fin.projDet.costoEsperado')}</div>
                      <div className="font-mono font-bold text-sm" style={{ color: 'var(--brand-teal)' }}>{usd(expectedCost, { compact: true })}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>{t('fin.projs.gananciaEsp')}</div>
                      <div className={cls("font-mono font-bold text-sm", gananciaEsperada >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {usd(gananciaEsperada, { compact: true })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--brand-teal2)' }}>{t('fin.projs.roiEst')}</div>
                      <div className={cls("font-mono font-bold text-sm", roiEsperado >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {pct(roiEsperado)}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.08)' }}>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--brand-teal2)' }}>
                      <span>{p._count?.movements || 0} {t('fin.projs.movs')}</span>
                      <span>{p._count?.loans || 0} {t('fin.projs.loans')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          const ok = await confirm({
                            title: t('fin.projs.eliminarProyecto'),
                            message: t('fin.projs.seguroQueQuieresEliminarElProyecto', { v0: p.name }),
                            detail: t('fin.projs.codigoV0SpvV1EstaAccion', { v0: p.code, v1: p.spv?.name || 'sin SPV' }),
                            destructive: true,
                            confirmText: t('tech.projects.siEliminar'),
                          })
                          if (ok) del.mutate(p.id);
                        }}
                        className="btn-ghost text-red-600 p-1"
                      ><Trash2 size={13} /></button>
                      <ChevronRight size={14} style={{ color: 'var(--brand-gold)' }} />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <ProjectModal open={open} onClose={() => setOpen(false)} catalogs={catalogs} />
    </div>
  );
}

function ProjectModal({ open, onClose, catalogs }: { open: boolean; onClose: () => void; catalogs: any }) {
  const { t } = useI18n()
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", line: "", model: "", status: "Enlistado", spvId: "", address: "", purchasePrice: 0, arv: 0, expectedCost: 0 });

  const mut = useMutation({
    mutationFn: (data: any) => API.createProject(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["catalogs"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t('fin.projs.proyectoCreado'));
      onClose();
      setForm({ code: "", name: "", line: "", model: "", status: "Enlistado", spvId: "", address: "", purchasePrice: 0, arv: 0, expectedCost: 0 });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || t('fin.accts.errorAlCrear')),
  });

  return (
    <Modal open={open} onClose={onClose} title={t('fin.projs.nuevoProyecto')} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.code.trim() || !form.name.trim()) return toast.error(t('fin.projs.codigoYNombreSonObligatorios'));
          mut.mutate({ ...form, spvId: form.spvId ? +form.spvId : null, purchasePrice: +form.purchasePrice, arv: +form.arv, expectedCost: +form.expectedCost });
        }}
        className="grid md:grid-cols-2 gap-3"
      >
        <div><label className="label">{t('common.codigo')}</label><input className="input w-full font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder={t('fin.projs.p001')} /></div>
        <div><label className="label">{t('common.nombre')}</label><input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={t('fin.projs.casaEnAiken')} /></div>
        <div>
          <label className="label">{t('fin.projs.lineaDeNegocio')}</label>
          <select className="select w-full" value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })}>
            <option value="">{t('fin.cat.seleccionar')}</option>
            <option>{t('fin.projs.carolinaDelSur')}</option>
            <option>{t('fin.projs.florida')}</option>
            <option>{t('fin.projs.detroit')}</option>
            <option>{t('common.otro')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('fin.projs.modelo')}</label>
          <select className="select w-full" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            <option value="">{t('fin.cat.seleccionar')}</option>
            <option>{t('fin.projs.fixFlip')}</option>
            <option>{t('fin.projs.landSell')}</option>
            <option>{t('fin.projs.newConstruction')}</option>
            <option>{t('fin.projs.buyHold')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('common.estado')}</label>
          <select className="select w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>{t('fin.projs.enlistado')}</option>
            <option>{t('fin.projs.enConstruccion')}</option>
            <option>{t('fin.projs.vendido')}</option>
            <option>{t('fin.projs.pausado')}</option>
            <option>{t('fin.projs.cerrado')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('fin.projs.spvSubsidiaria')}</label>
          <select className="select w-full" value={form.spvId} onChange={(e) => setForm({ ...form, spvId: e.target.value })}>
            <option value="">{t('fin.projs.sinSpv')}</option>
            {catalogs?.spvs?.map((s: any) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">{t('common.direccion')}</label>
          <input className="input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('fin.projs.123MainStCityState')} />
        </div>
        <div>
          <label className="label">{t('fin.projs.precioCompraUsd')}</label>
          <input type="number" step="0.01" className="input w-full" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })} />
        </div>
        <div>
          <label className="label">{t('fin.projs.arvUsd')} <span className="text-[10px] font-normal" style={{ color: 'var(--brand-teal2)' }}>{t('fin.projs.afterRepairValue')}</span></label>
          <input type="number" step="0.01" className="input w-full" value={form.arv} onChange={(e) => setForm({ ...form, arv: +e.target.value })} />
        </div>
        <div>
          <label className="label">{t('fin.projs.costoEsperadoUsd')}</label>
          <input type="number" step="0.01" className="input w-full" value={form.expectedCost} onChange={(e) => setForm({ ...form, expectedCost: +e.target.value })} />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid rgba(29,29,31,0.1)' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancelar')}</button>
          <button type="submit" className="btn-primary" disabled={mut.isPending}>{mut.isPending ? t('common.creando') : t('fin.projs.crearProyecto')}</button>
        </div>
      </form>
    </Modal>
  );
}
