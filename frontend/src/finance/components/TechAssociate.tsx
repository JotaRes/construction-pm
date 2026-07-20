// ============================================================
// Asociación de un movimiento a la OBRA (módulo técnico)
// ============================================================
// Cascada: proyecto → fase → actividad → subactividad (opcional).
//   - La actividad puede CREARSE al vuelo si el gasto no corresponde a
//     ninguna existente (se crea en la fase elegida, con código consecutivo).
//   - La subactividad es opcional: por defecto el sistema crea su propia
//     subactividad espejo; si el gasto corresponde a una subactividad YA
//     existente, se elige aquí y el sistema la adopta (solo sincroniza
//     valor y fecha; nunca la borra).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { API } from "../lib/api";

export interface TechSel {
  projectId: string;
  phaseId: string;
  itemId: string;      // actividad existente elegida ("" si se crea nueva)
  subId: string;       // subactividad existente adoptada ("" = espejo automático)
  newActivity: string; // nombre de la actividad nueva ("" si se usa existente)
}

export const EMPTY_TECH_SEL: TechSel = { projectId: "", phaseId: "", itemId: "", subId: "", newActivity: "" };

/** ¿La selección define una actividad (existente o por crear)? */
export function techSelReady(sel: TechSel): boolean {
  return !!sel.phaseId && (!!sel.itemId || !!sel.newActivity.trim());
}

/**
 * Resuelve la selección a los ids finales para el payload del movimiento.
 * Si el usuario escribió una actividad nueva, la crea primero en la fase.
 */
export async function resolveTechLink(sel: TechSel): Promise<{ techItemId: string | null; techSubActivityId: string | null }> {
  if (!techSelReady(sel)) return { techItemId: null, techSubActivityId: null };
  let techItemId = sel.itemId;
  if (!techItemId && sel.newActivity.trim()) {
    const created = await API.createTechItem(sel.phaseId, sel.newActivity.trim());
    techItemId = created.id;
  }
  return { techItemId: techItemId || null, techSubActivityId: sel.itemId && sel.subId ? sel.subId : null };
}

export function TechAssociate({ sel, onChange, enabled }: { sel: TechSel; onChange: (s: TechSel) => void; enabled: boolean }) {
  const [creatingActivity, setCreatingActivity] = useState(false);

  const { data: techProjects = [] } = useQuery<any[]>({
    queryKey: ["fin-tech-projects"],
    queryFn: API.getTechProjects,
    enabled,
  });
  const { data: techTree = [] } = useQuery<any[]>({
    queryKey: ["fin-tech-tree", sel.projectId],
    queryFn: () => API.getTechTree(sel.projectId),
    enabled: enabled && !!sel.projectId,
  });

  const phase = techTree.find((p: any) => p.id === sel.phaseId);
  const items = (phase?.items ?? []).filter((i: any) => !i.esNA);
  const item = items.find((i: any) => i.id === sel.itemId);
  const subs = item?.subactivities ?? [];

  const startCreate = () => { setCreatingActivity(true); onChange({ ...sel, itemId: "", subId: "" }); };
  const cancelCreate = () => { setCreatingActivity(false); onChange({ ...sel, newActivity: "" }); };

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-2">
        <select
          className="select w-full text-sm"
          value={sel.projectId}
          onChange={(e) => { setCreatingActivity(false); onChange({ ...EMPTY_TECH_SEL, projectId: e.target.value }); }}
        >
          <option value="">— sin obra —</option>
          {techProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <select
          className="select w-full text-sm"
          value={sel.phaseId}
          onChange={(e) => { setCreatingActivity(false); onChange({ ...sel, phaseId: e.target.value, itemId: "", subId: "", newActivity: "" }); }}
          disabled={!sel.projectId}
        >
          <option value="">— fase —</option>
          {techTree.map((p: any) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
        </select>

        {!creatingActivity ? (
          <select
            className="select w-full text-sm"
            value={sel.itemId}
            onChange={(e) => {
              if (e.target.value === "__new__") { startCreate(); return; }
              onChange({ ...sel, itemId: e.target.value, subId: "", newActivity: "" });
            }}
            disabled={!sel.phaseId}
          >
            <option value="">— actividad —</option>
            {items.map((i: any) => <option key={i.id} value={i.id}>{i.itemCode} · {i.activity}</option>)}
            {sel.phaseId && <option value="__new__">＋ Crear actividad nueva en esta fase…</option>}
          </select>
        ) : (
          <div className="flex items-center gap-1.5">
            <input
              className="input w-full text-sm"
              autoFocus
              placeholder="Nombre de la actividad nueva"
              value={sel.newActivity}
              onChange={(e) => onChange({ ...sel, newActivity: e.target.value })}
            />
            <button type="button" className="btn-ghost p-1.5 flex-shrink-0" title="Cancelar" onClick={cancelCreate}>
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Subactividad (opcional) — solo con actividad EXISTENTE elegida */}
      {sel.itemId && subs.length > 0 && (
        <div className="mt-2">
          <select
            className="select w-full text-sm"
            value={sel.subId}
            onChange={(e) => onChange({ ...sel, subId: e.target.value })}
          >
            <option value="">Subactividad: crear una nueva automáticamente (recomendado)</option>
            {subs.map((s: any) => (
              <option key={s.id} value={s.id}>
                Corresponde a: {s.description.length > 50 ? s.description.slice(0, 50) + "…" : s.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {techSelReady(sel) && (
        <p className="text-[11px] mt-2 flex items-start gap-1" style={{ color: "#8a6a1f" }}>
          <Plus size={11} className="mt-0.5 flex-shrink-0" />
          <span>
            {sel.newActivity.trim()
              ? `Se creará la actividad "${sel.newActivity.trim()}" en la fase elegida y el gasto quedará registrado en ella. `
              : sel.subId
                ? "El gasto se registrará sobre la subactividad elegida (se actualizan su valor y fecha; nunca se borra). "
                : "Se creará una subactividad espejo en la actividad elegida con este valor y fecha. "}
            Editar o eliminar el movimiento mantiene la obra sincronizada.
          </span>
        </p>
      )}
    </div>
  );
}
