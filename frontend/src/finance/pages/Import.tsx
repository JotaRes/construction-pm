import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API } from "../lib/api";
import {
  Upload, Database, Download, AlertTriangle, FileSpreadsheet,
  Archive, RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Import() {
  const qc = useQueryClient();
  const [wipe, setWipe] = useState(false);
  const [result, setResult] = useState<any>(null);

  const importDisk = useMutation({
    mutationFn: () => API.importExcelFromDisk(wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`${r.movements} movimientos importados`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const importUpload = useMutation({
    mutationFn: (file: File) => API.importExcel(file, wipe),
    onSuccess: (r) => { setResult(r); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success(`Importación completa: ${r.movements} movimientos`); },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error"),
  });

  const wipeAll = useMutation({
    mutationFn: () => API.wipeAllData(),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Base de datos del módulo financiero borrada completamente", { duration: 5000 });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || "Error al borrar datos"),
  });

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-5 page-content">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Importar / Backup</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--brand-teal2)' }}>Exporta tus datos a Excel o JSON, importa desde un archivo, o resetea todo desde cero</p>
      </div>

      {/* === EXPORTAR === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Download size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Exportar datos</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          Descarga toda la información financiera en el formato que necesites. Ideal para respaldos periódicos, análisis externos o migración.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Excel */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}
              >
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>Excel (.xlsx)</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  Multi-hoja con: cuentas, movimientos, proyectos, capital, préstamos, extractos
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.excelExportUrl(), `finance-${new Date().toISOString().slice(0, 10)}.xlsx`)}
              className="btn-primary w-full justify-center text-sm"
            >
              <Download size={14} /> Descargar Excel
            </button>
          </div>

          {/* JSON / ZIP */}
          <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(200,146,42,0.12)', color: 'var(--brand-gold)' }}
              >
                <Archive size={20} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--brand-teal)' }}>Backup completo (ZIP + JSON)</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  Snapshot exacto del sistema · Útil para restaurar en otro entorno
                </div>
              </div>
            </div>
            <button
              onClick={() => downloadFile(API.backupUrl(), `finance-backup-${new Date().toISOString().slice(0, 10)}.zip`)}
              className="btn-secondary w-full justify-center text-sm"
            >
              <Archive size={14} /> Descargar ZIP
            </button>
          </div>
        </div>
      </div>

      {/* === IMPORTAR === */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Upload size={18} style={{ color: 'var(--brand-gold)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--brand-teal)', fontFamily: 'Georgia, serif' }}>Importar desde Excel</h2>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--brand-teal2)' }}>
          Carga las hojas <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>MOV 2025</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>MOV 2026</code>, <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>CAPITALIZACION</code> y <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(200,146,42,0.1)', color: 'var(--brand-gold)' }}>PROYECTOS</code> de tu archivo financiero.
        </p>

        <label className="flex items-center gap-2 text-sm p-3 rounded-lg mb-3 cursor-pointer" style={{ background: 'var(--brand-cream2)' }}>
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} className="rounded" />
          <AlertTriangle size={14} className="text-amber-600" />
          <span style={{ color: 'var(--brand-teal)' }}>Borrar movimientos y capitalización existentes antes de importar (recomendado en primera carga)</span>
        </label>

        <div className="flex gap-2 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => importDisk.mutate()}
            disabled={importDisk.isPending}
          >
            <Database size={14} />
            {importDisk.isPending ? "Importando…" : "Importar desde servidor"}
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
          <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--brand-cream2)', border: '1px solid rgba(45,75,82,0.08)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--brand-teal)' }}>✓ Importación exitosa</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs" style={{ color: 'var(--brand-teal2)' }}>
              <div>Movimientos: <strong style={{ color: 'var(--brand-teal)' }}>{result.movements}</strong></div>
              <div>Aportes capital: <strong style={{ color: 'var(--brand-teal)' }}>{result.capitalContribs}</strong></div>
              <div>Préstamos: <strong style={{ color: 'var(--brand-teal)' }}>{result.loans}</strong></div>
              <div>Aportes no-banc.: <strong style={{ color: 'var(--brand-teal)' }}>{result.nonBank}</strong></div>
              <div>Proyectos: <strong style={{ color: 'var(--brand-teal)' }}>{result.projectsTouched}</strong></div>
            </div>
            {result.warnings?.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-amber-600 font-semibold">{result.warnings.length} advertencia(s)</summary>
                <ul className="mt-1 ml-4 text-xs space-y-0.5" style={{ color: 'var(--brand-teal2)' }}>
                  {result.warnings.map((w: string, i: number) => <li key={i}>· {w}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* === ZONA PELIGROSA === */}
      <div className="card p-5" style={{ borderColor: 'rgba(220,38,38,0.3)', borderWidth: 2 }}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h2 className="text-base font-bold text-red-600" style={{ fontFamily: 'Georgia, serif' }}>Zona peligrosa: Reset completo</h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-teal2)' }}>
          Borra <strong>TODOS</strong> los datos del módulo financiero: movimientos, cuentas, proyectos, socios, lenders, categorías, capital, préstamos, extractos, documentos. <strong className="text-red-600">Esta acción no se puede deshacer.</strong> Se recomienda <em>descargar el backup ZIP primero</em>.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => downloadFile(API.backupUrl(), `finance-pre-wipe-${new Date().toISOString().slice(0, 10)}.zip`)}
          >
            <Archive size={14} /> Descargar backup primero
          </button>
          <button
            className="btn-danger text-sm"
            onClick={() => {
              const confirm1 = confirm("⚠️ ¿Estás SEGURO de que quieres borrar TODOS los datos del módulo financiero?\n\nEsto incluye: cuentas, movimientos, proyectos, socios, lenders, categorías, capital y préstamos.\n\nEsta acción NO se puede deshacer.");
              if (!confirm1) return;
              const word = prompt("Escribe BORRAR TODO para confirmar el reseteo completo:");
              if (word !== "BORRAR TODO") {
                toast.error("Texto de confirmación incorrecto. No se borró nada.");
                return;
              }
              wipeAll.mutate();
            }}
            disabled={wipeAll.isPending}
          >
            <RotateCcw size={14} /> {wipeAll.isPending ? "Borrando…" : "Resetear todo desde cero"}
          </button>
        </div>
      </div>
    </div>
  );
}
