import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import { Upload, Database, Download, AlertTriangle, FileSpreadsheet, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function Import() {
  const qc = useQueryClient();
  const [wipe, setWipe] = useState(false);
  const [result, setResult] = useState<any>(null);

  const importDisk = useMutation({
    mutationFn: () => API.importExcelFromDisk(wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`${r.movements} movimientos · ${r.capitalContribs} aportes · ${r.loans} préstamos`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const importUpload = useMutation({
    mutationFn: (file: File) => API.importExcel(file, wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`Importación completa: ${r.movements} movimientos`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const clearAll = useMutation({
    mutationFn: () => API.clearAllData(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Todos los datos han sido eliminados"); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al eliminar datos"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Importar / Backup</h1>
        <p className="text-sm text-slate-400">Carga inicial desde el Excel y descarga de respaldos completos</p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-accent" />
          <h2 className="text-sm font-semibold">Importar desde Excel</h2>
        </div>
        <p className="text-sm text-slate-400">
          Carga las hojas <code className="text-accent">MOV 2025</code>, <code className="text-accent">MOV 2026</code>, <code className="text-accent">CAPITALIZACION</code> y <code className="text-accent">PROYECTOS</code> de tu archivo financiero.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
          <AlertTriangle size={14} className="text-warn" />
          Borrar movimientos y capitalización existente antes de importar (recomendado en primera carga)
        </label>

        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => importDisk.mutate()}
            disabled={importDisk.isPending}
          >
            <Database size={14} />
            {importDisk.isPending ? "Importando…" : "Importar desde Desktop"}
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={14} /> Subir archivo Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importUpload.mutate(f); e.target.value = ""; }}
              disabled={importUpload.isPending}
            />
          </label>
        </div>

        {result && (
          <div className="card-soft p-3 mt-2 text-xs space-y-1">
            <div>✓ Movimientos: <strong>{result.movements}</strong></div>
            <div>✓ Aportes de capital: <strong>{result.capitalContribs}</strong></div>
            <div>✓ Préstamos: <strong>{result.loans}</strong></div>
            <div>✓ Aportes no-bancarizados: <strong>{result.nonBank}</strong></div>
            <div>✓ Proyectos actualizados: <strong>{result.projectsTouched}</strong></div>
            {result.warnings?.length > 0 && (
              <details className="text-warn">
                <summary className="cursor-pointer">{result.warnings.length} advertencias</summary>
                <ul className="ml-4 mt-1">
                  {result.warnings.map((w: string, i: number) => <li key={i}>· {w}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Download size={14} /> Descargar backup</h2>
        <p className="text-sm text-slate-400 mb-3">
          Descarga un ZIP con toda la data (movimientos, capital, proyectos, extractos, documentos referenciados).
        </p>
        <a href={API.backupUrl()} className="btn-primary inline-flex" download>
          <Download size={14} /> Descargar backup ZIP
        </a>
      </div>

      <div className="card p-5 border border-negative/30">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-2 text-negative"><AlertTriangle size={14} /> Borrar todos los datos</h2>
        <p className="text-sm text-slate-400 mb-4">
          Elimina permanentemente todos los movimientos, aportes, préstamos, extractos y documentos. <strong>Esta acción no se puede deshacer.</strong>
        </p>
        <button
          className="btn-danger"
          onClick={() => {
            if (confirm("¿Estás seguro de que quieres eliminar TODOS los datos? Esta acción no se puede deshacer.")) {
              clearAll.mutate();
            }
          }}
          disabled={clearAll.isPending}
        >
          <Trash2 size={14} /> {clearAll.isPending ? "Eliminando…" : "Borrar todos los datos"}
        </button>
      </div>
    </div>
  );
}
