import { useQuery } from '@tanstack/react-query'
import { systemApi } from '../lib/api'
import type { SystemCapacity } from '../lib/api'
import { AlertTriangle, HardDrive } from 'lucide-react'
import { useState } from 'react'

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Banner global de capacidad documental. Solo se muestra en warning (>80%) o critical (>90%).
export default function CapacityBanner() {
  const [dismissed, setDismissed] = useState(false)
  const { data } = useQuery<SystemCapacity>({
    queryKey: ['system-capacity'],
    queryFn: systemApi.capacity,
    refetchInterval: 5 * 60 * 1000,  // refrescar cada 5 minutos
    retry: 1,
  })

  if (!data || dismissed) return null
  if (data.level === 'ok') return null

  const pct = (data.pct * 100).toFixed(1)
  const isCritical = data.level === 'critical'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-xs border-b ${
      isCritical ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
    }`}>
      {isCritical ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> : <HardDrive className="w-4 h-4 flex-shrink-0" />}
      <div className="flex-1">
        <div className="font-semibold">
          {isCritical
            ? `Capacidad documental al ${pct}% — cerca del límite del plan`
            : `Capacidad documental al ${pct}% — considera limpiar archivos antiguos`}
        </div>
        <div className="text-[10px] mt-0.5 opacity-80">
          {fmtBytes(data.totalBytes)} de {fmtBytes(data.limitBytes)} usados · {data.totalDocs} documentos almacenados
        </div>
      </div>
      <div className="w-32 hidden md:block">
        <div className={`h-2 rounded-full ${isCritical ? 'bg-red-200' : 'bg-amber-200'} overflow-hidden`}>
          <div
            className={`h-full ${isCritical ? 'bg-red-600' : 'bg-amber-600'} transition-all`}
            style={{ width: `${Math.min(100, data.pct * 100)}%` }}
          />
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="text-[11px] opacity-60 hover:opacity-100 ml-2">
        Ocultar
      </button>
    </div>
  )
}
