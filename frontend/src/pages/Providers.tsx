import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { providersApi, providerQuotesApi, providerDocumentsApi, providersGlobalApi } from '../lib/api'
import { formatUSD, formatDate } from '../lib/calculations'
import type { Provider, ProviderDocumentType } from '../lib/types'
import { Plus, Trash2, X, Check, ChevronDown, FileText, Upload, ExternalLink, FolderOpen, ShieldCheck, FileSignature, Receipt, BadgeCheck, FileSpreadsheet, Users, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useI18n, type TranslationKey, currentLocale, tStatic } from '../i18n'
import { dataLabel, PROVIDER_CATEGORY_LABELS } from '../i18n/dataLabels'

// Tipos de documentos sugeridos por proveedor con icono y descripción contextual
const PROVIDER_DOC_TYPES: { value: ProviderDocumentType; labelKey: TranslationKey; descriptionKey: TranslationKey }[] = [
  { value: 'SEGURO',     labelKey: 'tech.providers.seguroInsurance',     descriptionKey: 'tech.providers.certificadoCoiWorkersCompLiability' },
  { value: 'COTIZACION', labelKey: 'tech.providers.cotizacionRecibida',    descriptionKey: 'tech.providers.quoteEstimateEnviadoPorElProveedor' },
  { value: 'FACTURA',    labelKey: 'tech.providers.facturaEntregada',      descriptionKey: 'tech.providers.invoiceQueYoLePagueDebo' },
  { value: 'CONTRATO',   labelKey: 'tech.providers.contratoFirmado',       descriptionKey: 'tech.providers.serviceAgreementSowSubcontract' },
  { value: 'LICENCIA',   labelKey: 'tech.providers.licenciaProfesional',   descriptionKey: 'tech.providers.contractorLicenseGcTradeLicense' },
  { value: 'W9',         labelKey: 'tech.providers.w9TaxForm',         descriptionKey: 'tech.providers.w9FirmadoEin1099Etc' },
  { value: 'OTRO',       labelKey: 'tech.providers.otroDocumento',         descriptionKey: 'tech.providers.permisosPlanosFotosCertificadosEtc' },
]

function docTypeIcon(t: string) {
  switch (t) {
    case 'SEGURO':     return <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
    case 'COTIZACION': return <FileText className="w-3.5 h-3.5 text-amber-600" />
    case 'FACTURA':    return <Receipt className="w-3.5 h-3.5 text-emerald-600" />
    case 'CONTRATO':   return <FileSignature className="w-3.5 h-3.5 text-indigo-600" />
    case 'LICENCIA':   return <BadgeCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
    case 'W9':         return <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
    default:           return <FileText className="w-3.5 h-3.5 text-slate-400" />
  }
}

function ProviderDocumentsModal({ provider, projectId, onClose }: { provider: Provider; projectId: string; onClose: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [type, setType] = useState<ProviderDocumentType>('SEGURO')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('name', name || (file?.name ?? 'Documento'))
      if (amount) fd.append('amount', amount)
      if (notes) fd.append('notes', notes)
      if (file) fd.append('file', file)
      return providerDocumentsApi.create(projectId, provider.id, fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers', projectId] })
      setName(''); setAmount(''); setNotes(''); setFile(null)
    },
  })

  const delMut = useMutation({
    mutationFn: (docId: string) => providerDocumentsApi.delete(projectId, provider.id, docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const docs = provider.documents ?? []
  const selectedType = PROVIDER_DOC_TYPES.find(t => t.value === type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[var(--brand-gold)]" />
              {t('tech.providers.repositorioDe')} {provider.name}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{docs.length} {t('tech.providers.documentoSAlmacenadoS')}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Form */}
        <div className="p-6 border-b border-slate-100 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tech.providers.subirNuevoDocumento')}</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <select value={type} onChange={e => setType(e.target.value as ProviderDocumentType)}
                className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
                {PROVIDER_DOC_TYPES.map(pd => <option key={pd.value} value={pd.value}>{t(pd.labelKey)}</option>)}
              </select>
              {selectedType && (
                <div className="text-[10px] text-slate-400 mt-1 pl-1">💡 {t(selectedType.descriptionKey)}</div>
              )}
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={t('tech.providers.nombreReferenciaDelDocumento')}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            {(type === 'COTIZACION' || type === 'FACTURA') && (
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('tech.providers.montoOpcional')}
                className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t('tech.providers.notasVigenciaCondicionesObservaciones')}
              rows={2}
              className={`${type === 'COTIZACION' || type === 'FACTURA' ? '' : 'col-span-2'} bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none placeholder-slate-400`} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] border border-slate-200 hover:border-[#3E5A70]/40 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" />{file ? file.name : t('tech.providers.adjuntarPdfImagen')}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !file}
              className="flex items-center gap-2 px-4 py-1.5 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" />{addMut.isPending ? t('tech.draws.subiendo') : t('tech.providers.guardarDocumento')}
            </button>
          </div>
          {addMut.isError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {t('landing.error')} {(addMut.error as Error)?.message ?? t('tech.providers.errorSubiendoDocumento')}
            </div>
          )}
        </div>

        {/* List grouped by type */}
        <div className="divide-y divide-slate-100">
          {docs.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              {t('tech.providers.sinDocumentosAlmacenados')}<br />
              <span className="text-[10px] text-slate-300">{t('tech.providers.subeElSeguroContratoW9')}</span>
            </div>
          )}
          {PROVIDER_DOC_TYPES.map(dt => {
            const group = docs.filter(d => d.type === dt.value)
            if (group.length === 0) return null
            return (
              <div key={dt.value} className="px-6 py-3">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  {docTypeIcon(dt.value)}{t(dt.labelKey)} <span className="text-slate-300">({group.length})</span>
                </div>
                <div className="space-y-1.5">
                  {group.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                          {d.amount != null && <span className="font-mono font-semibold text-emerald-600">{formatUSD(d.amount)}</span>}
                          <span>{formatDate(d.createdAt)}</span>
                          {d.notes && <span className="truncate">{d.notes}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {d.fileUrl && (
                          <a href={d.fileUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] text-[var(--brand-teal)] hover:underline">
                            <FileText className="w-3 h-3" />{t('common.ver')}
                          </a>
                        )}
                        <button onClick={() => delMut.mutate(d.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const CATEGORIES = ['GC', 'Subcontratista', 'Lender', 'Inspector', 'Title Company', 'Utility', 'Authority', 'Realtor', 'Architect', 'Engineer', 'Surveyor', 'Otro']

// Códigos de país más comunes en USA real estate
const COUNTRY_CODES = [
  { code: '+1',  flag: '🇺🇸', countryKey: 'data.country.usaCanada' },
  { code: '+57', flag: '🇨🇴', countryKey: 'data.country.colombia' },
  { code: '+52', flag: '🇲🇽', countryKey: 'data.country.mexico' },
  { code: '+34', flag: '🇪🇸', countryKey: 'data.country.spain' },
  { code: '+54', flag: '🇦🇷', countryKey: 'data.country.argentina' },
  { code: '+58', flag: '🇻🇪', countryKey: 'data.country.venezuela' },
  { code: '+51', flag: '🇵🇪', countryKey: 'data.country.peru' },
  { code: '+56', flag: '🇨🇱', countryKey: 'data.country.chile' },
  { code: '+55', flag: '🇧🇷', countryKey: 'data.country.brazil' },
  { code: '+44', flag: '🇬🇧', countryKey: 'data.country.uk' },
  { code: '+593',flag: '🇪🇨', countryKey: 'data.country.ecuador' },
  { code: '+507',flag: '🇵🇦', countryKey: 'data.country.panama' },
  { code: '+503',flag: '🇸🇻', countryKey: 'data.country.elSalvador' },
  { code: '+504',flag: '🇭🇳', countryKey: 'data.country.honduras' },
  { code: '+506',flag: '🇨🇷', countryKey: 'data.country.costaRica' },
]

function QuoteModal({ provider, projectId, onClose }: { provider: Provider; projectId: string; onClose: () => void }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('description', desc || t('tech.exec.cotizacion'))
      fd.append('amount', amount)
      fd.append('date', date)
      fd.append('notes', notes)
      if (file) fd.append('file', file)
      return providerQuotesApi.create(projectId, provider.id, fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers', projectId] })
      setDesc(''); setAmount(''); setDate(''); setNotes(''); setFile(null)
    },
  })

  const delMut = useMutation({
    mutationFn: (quoteId: string) => providerQuotesApi.delete(projectId, provider.id, quoteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] }),
  })

  const quotes = provider.quotes ?? []
  const totalQuotes = quotes.reduce((s, q) => s + q.amount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-900">{provider.name}</div>
            <div className="text-xs text-slate-400 mt-0.5">{quotes.length} {t('tech.providers.cotizacionEsTotal')} {formatUSD(totalQuotes)}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        {/* Add quote form */}
        <div className="p-6 border-b border-slate-100 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tech.providers.nuevaCotizacion')}</div>
          <div className="grid grid-cols-2 gap-2">
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('tech.providers.descripcionDelTrabajo')}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={t('tech.exec.monto')}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] placeholder-slate-400" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('tech.providers.notasAdicionales')} rows={2}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none placeholder-slate-400" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-[var(--brand-gold)] border border-slate-200 hover:border-[#3E5A70]/40 px-3 py-1.5 rounded-lg transition-colors">
              <Upload className="w-3.5 h-3.5" />{file ? file.name : t('tech.providers.adjuntarPdfImagen')}
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => addMut.mutate()} disabled={addMut.isPending}
              className="flex items-center gap-2 px-4 py-1.5 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" />{t('tech.providers.guardarCotizacion')}
            </button>
          </div>
        </div>

        {/* Quote list */}
        <div className="divide-y divide-slate-100">
          {quotes.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">{t('tech.providers.sinCotizacionesRegistradas')}</div>
          )}
          {quotes.map(q => (
            <div key={q.id} className="px-6 py-3 flex items-start justify-between gap-4 hover:bg-slate-50/60">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{q.description}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono font-semibold text-emerald-600">{formatUSD(q.amount)}</span>
                  {q.date && <span className="text-[10px] text-slate-400">{formatDate(q.date)}</span>}
                  {q.notes && <span className="text-[10px] text-slate-400">{q.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {q.fileUrl && (
                  <a href={q.fileUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[var(--brand-teal)] hover:underline">
                    <FileText className="w-3 h-3" />{t('tech.providers.verDoc')}
                  </a>
                )}
                <button onClick={() => delMut.mutate(q.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// COI (Lote A): estado del seguro del proveedor con semáforo de vencimiento.
// Un sub con COI vencido trabajando en el lote es riesgo directo del holding.
function CoiRow({ provider, projectId }: { provider: Provider; projectId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['providers', projectId] })

  const uploadCoiMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return providersApi.uploadCoi(projectId, provider.id, fd)
    },
    onSuccess: invalidate,
  })
  const removeCoiMut = useMutation({
    mutationFn: () => providersApi.removeCoi(projectId, provider.id),
    onSuccess: invalidate,
  })
  const dateMut = useMutation({
    mutationFn: (coiExpiresAt: string | null) => providersApi.patch(projectId, provider.id, { coiExpiresAt }),
    onSuccess: invalidate,
  })

  const days = provider.coiExpiresAt
    ? Math.ceil((new Date(provider.coiExpiresAt).getTime() - Date.now()) / 86400000)
    : null

  const badge = days === null
    ? { cls: 'bg-slate-100 text-slate-500', label: t('tech.providers.coiSinRegistrar') }
    : days < 0
      ? { cls: 'bg-red-500/10 text-red-500', label: `COI VENCIDO hace ${Math.abs(days)}d` }
      : days < 30
        ? { cls: 'bg-amber-500/10 text-amber-600', label: tStatic('tech.providers.coiExpiresIn', { days }) }
        : { cls: 'bg-emerald-500/10 text-emerald-600', label: `COI vigente · ${days}d` }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
        <ShieldCheck className="w-3 h-3" /> {badge.label}
      </span>
      <input type="date"
        value={provider.coiExpiresAt ? provider.coiExpiresAt.slice(0, 10) : ''}
        onChange={e => dateMut.mutate(e.target.value || null)}
        title={t('tech.providers.fechaDeVencimientoDelCoi')}
        className="bg-slate-50 border border-slate-200 text-[10px] px-1.5 py-0.5 rounded-md focus:outline-none focus:border-[var(--brand-gold)] text-slate-500" />
      {provider.coiUrl ? (
        <>
          <a href={provider.coiUrl} target="_blank" rel="noreferrer"
            className="text-[10px] font-semibold text-[var(--brand-teal)] hover:underline">{t('tech.providers.verCertificado')}</a>
          <button onClick={() => removeCoiMut.mutate()} className="text-[10px] text-slate-400 hover:text-red-400 hover:underline">{t('tech.providers.quitar')}</button>
        </>
      ) : (
        <label className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--brand-teal)] hover:underline cursor-pointer">
          <Upload className="w-3 h-3" /> {uploadCoiMut.isPending ? t('common.subiendo') : t('tech.providers.subirCoi')}
          <input type="file" className="hidden" accept=".pdf,image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadCoiMut.mutate(f) }} />
        </label>
      )}
    </div>
  )
}

/* ── Historial de servicios del proveedor ─────────────────────────
   Récord completo alimentado desde Ejecución: actividades asignadas,
   subactividades ejecutadas y facturas registradas — con totales. */
function ProviderRecordSection({ providerId }: { providerId: string }) {
  const { t } = useI18n()
  const { data: record, isLoading } = useQuery<any>({
    queryKey: ['provider-record', providerId],
    queryFn: () => providersGlobalApi.record(providerId),
    staleTime: 30_000,
  })
  if (isLoading) return <div className="text-[11px] text-slate-400 animate-pulse py-2">{t('tech.providers.cargandoHistorial')}</div>
  if (!record) return null
  const { activities = [], subactivities = [], invoices = [], totals } = record
  const empty = activities.length === 0 && subactivities.length === 0 && invoices.length === 0
  if (empty) {
    return (
      <div className="text-[11px] text-slate-400 italic py-2">
        {t('tech.providers.sinServiciosRegistradosAunAsignaEste')}
      </div>
    )
  }
  return (
    <div className="space-y-2 pt-1">
      {/* Totales del récord */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide">{t('tech.providers.servicios')}</div>
          <div className="text-sm font-bold font-mono text-slate-700">{totals?.servicios ?? 0}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide">{t('common.ejecutado')}</div>
          <div className="text-sm font-bold font-mono text-[var(--brand-teal)]">{formatUSD((totals?.actividades ?? 0) + (totals?.subactividades ?? 0))}</div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide">{t('tech.providers.facturado')}</div>
          <div className="text-sm font-bold font-mono text-emerald-600">{formatUSD(totals?.facturado ?? 0)}</div>
        </div>
      </div>
      {/* Actividades asignadas */}
      {activities.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('tech.providers.actividadesACargo')}</div>
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 truncate">
                <span className="font-mono text-slate-400">{a.itemCode}</span> {a.activity}
                <span className="text-slate-300"> · {a.phase?.project?.name}</span>
              </span>
              <span className={`font-mono flex-shrink-0 ${a.completado ? 'text-emerald-600' : 'text-slate-500'}`}>
                {a.valorEjecutado > 0 ? formatUSD(a.valorEjecutado) : a.completado ? '✓' : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Subactividades ejecutadas */}
      {subactivities.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('tech.providers.subactividadesEjecutadas')}</div>
          {subactivities.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 truncate">
                {s.description}
                <span className="text-slate-300"> · {s.item?.itemCode} · {s.item?.phase?.project?.name}</span>
                {s.fecha && <span className="text-slate-400"> · {new Date(s.fecha).toLocaleDateString(currentLocale())}</span>}
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                {s.invoiceUrl
                  ? <span title={`Invoice: ${s.invoiceName ?? ''}`} className="text-emerald-500">📎</span>
                  : s.valorEjecutado > 0 && <span title={t('tech.providers.sinInvoice')} className="text-red-400">⚠</span>}
                <span className="font-mono text-slate-600">{formatUSD(s.valorEjecutado || 0)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Facturas registradas */}
      {invoices.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{t('tech.providers.facturasYDocumentos')}</div>
          {invoices.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 truncate">
                <span className={`text-[9px] px-1 rounded mr-1 ${d.type === 'FACTURA' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.type}</span>
                {d.item?.itemCode} · {d.item?.activity}
              </span>
              <span className="font-mono text-slate-600 flex-shrink-0">{d.amount ? formatUSD(d.amount) : '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderCard({ provider, projectId, billing, onUpdate, onDelete }: {
  billing?: Record<string, { projectName: string; total: number; count: number }>
  provider: Provider
  projectId: string
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showRecord, setShowRecord] = useState(false)
  // Detectar si el type viene como "Otro: XYZ" para mostrar el input custom
  const initialType = provider.type ?? ''
  const isCustomType = initialType && !CATEGORIES.includes(initialType)
  const [form, setForm] = useState({
    name: provider.name,
    type: isCustomType ? 'Otro' : (initialType || ''),
    customType: isCustomType ? initialType : '',
    phoneCountry: (provider as any).phoneCountry ?? '+1',
    phone: provider.phone ?? '',
    email: provider.email ?? '',
    license: provider.license ?? '',
    address: (provider as any).address ?? '',
    notes: provider.notes ?? '',
  })

  const providerQuotes = provider.quotes ?? []
  const totalQuotes = providerQuotes.reduce((s, q) => s + q.amount, 0)

  if (editing) {
    return (
      <div className="bg-white border border-[#3E5A70]/40 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('common.nombre')}
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <div className={form.type === 'Otro' ? '' : 'col-span-2 md:col-span-1'}>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, customType: e.target.value === 'Otro' ? f.customType : '' }))}
              className="w-full bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]">
              <option value="">{t('tech.providers.categoria')}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{dataLabel(PROVIDER_CATEGORY_LABELS, c, t)}</option>)}
            </select>
          </div>
          {form.type === 'Otro' && (
            <input value={form.customType} onChange={e => setForm(f => ({ ...f, customType: e.target.value }))}
              placeholder={t('tech.providers.especificarCategoria')}
              className="bg-amber-50 border border-amber-300 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {form.type !== 'Otro' && (
            <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} placeholder={t('tech.providers.licencia')}
              className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {form.type === 'Otro' && (
            <input value={form.license} onChange={e => setForm(f => ({ ...f, license: e.target.value }))} placeholder={t('tech.providers.licencia')}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          )}
          {/* Teléfono con código país */}
          <div className="col-span-2 flex gap-2">
            <select value={form.phoneCountry} onChange={e => setForm(f => ({ ...f, phoneCountry: e.target.value }))}
              className="w-28 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-2 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] flex-shrink-0">
              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
            </select>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('tech.providers.telefonoSinCodigoPais')}
              className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          </div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder={t('common.email')}
            type="email"
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder={t('common.direccion')}
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('tech.providers.notasEspecialidadDiasHorariosDisponiblesCo')} rows={3}
            className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => {
            const finalType = form.type === 'Otro' && form.customType ? form.customType : form.type
            onUpdate(provider.id, {
              name: form.name,
              type: finalType,
              phoneCountry: form.phoneCountry,
              phone: form.phone,
              email: form.email,
              license: form.license,
              address: form.address,
              notes: form.notes,
            })
            setEditing(false)
          }}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--brand-teal)] text-white text-xs rounded-lg hover:bg-[#48484A]">
            <Check className="w-3.5 h-3.5" />{t('common.guardar')}
          </button>
          <button onClick={() => setEditing(false)} className="text-slate-400 text-xs px-3 py-1.5 hover:text-slate-700">{t('common.cancelar')}</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">{provider.name}</span>
              {provider.type && (
                <span className="text-[10px] bg-[#1D1D1F]/10 text-[var(--brand-teal)] px-2 py-0.5 rounded-full font-medium">{provider.type}</span>
              )}
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: provider.projectId ? 'rgba(62,90,112,0.12)' : 'rgba(29,29,31,0.08)', color: provider.projectId ? 'var(--brand-gold)' : 'var(--brand-teal2)' }}>
                {provider.project?.name ?? t('tech.providers.global')}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {provider.phone && (
                <a href={`tel:${(provider.phoneCountry ?? '')}${provider.phone}`} className="hover:text-[var(--brand-gold)]">
                  📞 {provider.phoneCountry ?? ''} {provider.phone}
                </a>
              )}
              {provider.email && <a href={`mailto:${provider.email}`} className="hover:text-[var(--brand-gold)] flex items-center gap-1">✉ {provider.email}<ExternalLink className="w-2.5 h-2.5" /></a>}
              {provider.license && <span className="text-slate-400">{t('tech.providers.lic')} {provider.license}</span>}
              {provider.address && <span className="text-slate-400">📍 {provider.address}</span>}
            </div>
            {provider.notes && <div className="text-[11px] text-slate-400 mt-1">{provider.notes}</div>}

            {/* COI — Certificate of Insurance (Lote A) */}
            <CoiRow provider={provider} projectId={projectId} />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowQuotes(true)}
              className="flex items-center gap-1.5 text-[10px] text-[var(--brand-teal)] border border-[#1D1D1F]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#1D1D1F]/5 transition-colors">
              <FileText className="w-3 h-3" />
              {t('tech.providers.cotizaciones')}
              {providerQuotes.length > 0 && <span className="bg-[var(--brand-teal)] text-white text-[9px] px-1.5 py-0.5 rounded-full">{providerQuotes.length}</span>}
            </button>
            <button onClick={() => setShowDocs(true)}
              className="flex items-center gap-1.5 text-[10px] text-[var(--brand-gold)] border border-[#3E5A70]/40 px-2.5 py-1.5 rounded-lg hover:bg-[#3E5A70]/5 transition-colors">
              <FolderOpen className="w-3 h-3" />
              {t('tech.providers.docs')}
              {(provider.documents?.length ?? 0) > 0 && <span className="bg-[var(--brand-gold)] text-white text-[9px] px-1.5 py-0.5 rounded-full">{provider.documents?.length}</span>}
            </button>
            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-[var(--brand-gold)] p-1 transition-colors">
              <ChevronDown className="w-3.5 h-3.5 rotate-[-90deg]" />
            </button>
            <button onClick={() => onDelete(provider.id)} className="text-slate-300 hover:text-red-400 p-1 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {providerQuotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">{providerQuotes.length} {t('tech.providers.cotizacionEs')}</span>
            <span className="font-mono font-semibold text-emerald-600">{formatUSD(totalQuotes)} {t('tech.providers.total')}</span>
          </div>
        )}
        {/* R2: récord de facturación por proyecto (facturas adjuntadas en Ejecución) */}
        {billing && Object.keys(billing).length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t('tech.providers.facturacionRegistrada')}</div>
            {Object.entries(billing).map(([pid, b]) => (
              <div key={pid} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{b.projectName} · {b.count} {t('tech.providers.facturaS')}</span>
                <span className="font-mono font-semibold text-[var(--brand-teal)]">{formatUSD(b.total)}</span>
              </div>
            ))}
          </div>
        )}
        {/* Historial COMPLETO de servicios: actividades + subactividades + facturas */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button onClick={() => setShowRecord(v => !v)}
            className="w-full flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-[var(--brand-teal)] transition-colors">
            <ChevronDown className={`w-3 h-3 transition-transform ${showRecord ? '' : '-rotate-90'}`} />
            {t('tech.providers.historialDeServiciosYPagos')}
          </button>
          {showRecord && <ProviderRecordSection providerId={provider.id} />}
        </div>
      </div>

      {showQuotes && <QuoteModal provider={provider} projectId={projectId} onClose={() => setShowQuotes(false)} />}
      {showDocs && <ProviderDocumentsModal provider={provider} projectId={projectId} onClose={() => setShowDocs(false)} />}
    </>
  )
}

export default function Providers({ projectId }: { projectId: string }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({
    name: '', type: '', customType: '',
    phoneCountry: '+1', phone: '', email: '', license: '', address: '', notes: '',
  })

  // R2: catálogo GLOBAL — todos los proveedores del holding, usables en todos
  // los proyectos. queryKey global para que Ejecución comparta el mismo caché.
  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['providers-global'],
    queryFn: providersGlobalApi.listAll,
  })
  const { data: billing = {} } = useQuery({
    queryKey: ['providers-billing'],
    queryFn: providersGlobalApi.billing,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => providersApi.patch(projectId, id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers-global'] }); queryClient.invalidateQueries({ queryKey: ['providers', projectId] }) },
    onError: (e) => console.error('Provider update failed:', e),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => providersApi.delete(projectId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers-global'] }); queryClient.invalidateQueries({ queryKey: ['providers', projectId] }) },
    onError: (e) => console.error('Provider delete failed:', e),
  })
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => providersGlobalApi.createGlobal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers-global'] })
      setShowAdd(false)
      setNewForm({ name: '', type: '', customType: '', phoneCountry: '+1', phone: '', email: '', license: '', address: '', notes: '' })
    },
  })

  const handleCreate = () => {
    if (!newForm.name.trim()) return
    const finalType = newForm.type === 'Otro' && newForm.customType ? newForm.customType : newForm.type
    createMut.mutate({
      name: newForm.name,
      type: finalType || null,
      phoneCountry: newForm.phoneCountry,
      phone: newForm.phone || null,
      email: newForm.email || null,
      license: newForm.license || null,
      address: newForm.address || null,
      notes: newForm.notes || null,
    })
  }

  if (isLoading) return <div className="text-slate-500 text-sm animate-pulse">{t('tech.providers.cargandoProveedores')}</div>

  const byCategory = providers.reduce((acc, p) => {
    const cat = p.type || 'Otro'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Provider[]>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-head-title flex items-center gap-3"><span className="page-head-icon"><Users className="w-[22px] h-[22px]" strokeWidth={1.8} /></span><span>{t('tech.providers.directorioDeProveedoresCatalogoGeneral')}</span></h1>
          <p className="text-sm text-slate-500 mt-0.5">{providers.length} {t('tech.providers.proveedoresDelHoldingAplicanATodos')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const r = await providersGlobalApi.importFromFinance()
                if (r.imported === 0) {
                  toast.success(t('tech.providers.sinNovedadesLosV0ProveedorEs', { v0: r.skipped }))
                } else {
                  toast.success(t('tech.providers.v0ProveedorEsImportadosDelModulo', { v0: r.imported, v1: r.skipped > 0 ? ` · ${r.skipped} ya existían` : '' }), { duration: 7000 })
                }
                queryClient.invalidateQueries({ queryKey: ['providers-global'] })
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('tech.providers.errorAlImportar'))
              }
            }}
            title={t('tech.providers.traeLosProveedoresContratistasYaRegistrado')}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors">
            <Download className="w-4 h-4" />
            {t('tech.providers.importarDelFinanciero')}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-[var(--brand-gold)] hover:bg-[#4A6880] text-white text-sm px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" />{t('common.agregar')}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white border border-[#3E5A70]/40 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('tech.providers.nuevoProveedor')}</div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder={t('common.nombre')} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <select value={newForm.type}
              onChange={e => setNewForm(f => ({ ...f, type: e.target.value, customType: e.target.value === 'Otro' ? f.customType : '' }))}
              className={(newForm.type === 'Otro' ? '' : 'col-span-2 md:col-span-1 ') + 'bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]'}>
              <option value="">{t('tech.providers.categoria')}</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{dataLabel(PROVIDER_CATEGORY_LABELS, c, t)}</option>)}
            </select>
            {newForm.type === 'Otro' && (
              <input placeholder={t('tech.providers.especificarCategoria')} value={newForm.customType}
                onChange={e => setNewForm(f => ({ ...f, customType: e.target.value }))}
                className="bg-amber-50 border border-amber-300 text-sm text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {newForm.type !== 'Otro' && (
              <input placeholder={t('tech.providers.licencia')} value={newForm.license} onChange={e => setNewForm(f => ({ ...f, license: e.target.value }))}
                className="bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {newForm.type === 'Otro' && (
              <input placeholder={t('tech.providers.licencia')} value={newForm.license} onChange={e => setNewForm(f => ({ ...f, license: e.target.value }))}
                className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            )}
            {/* Teléfono con código país */}
            <div className="col-span-2 flex gap-2">
              <select value={newForm.phoneCountry} onChange={e => setNewForm(f => ({ ...f, phoneCountry: e.target.value }))}
                className="w-28 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-2 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] flex-shrink-0">
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
              <input placeholder={t('tech.providers.telefonoSinCodigoPais')} value={newForm.phone}
                onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))}
                className="flex-1 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            </div>
            <input placeholder={t('common.email')} type="email" value={newForm.email}
              onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <input placeholder={t('common.direccion')} value={newForm.address}
              onChange={e => setNewForm(f => ({ ...f, address: e.target.value }))}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)]" />
            <textarea placeholder={t('tech.providers.notasEspecialidadDiasHorariosDisponiblesCo')}
              value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="col-span-2 bg-slate-50 border border-slate-200 text-sm text-slate-700 px-3 py-2 rounded-lg focus:outline-none focus:border-[var(--brand-gold)] resize-none" />
          </div>
          {createMut.isError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {t('tech.projects.errorAlGuardar')} {(createMut.error as Error)?.message ?? t('tech.providers.errorDesconocido')}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleCreate}
              disabled={!newForm.name || (newForm.type === 'Otro' && !newForm.customType) || createMut.isPending}
              className="px-4 py-1.5 bg-[var(--brand-teal)] text-white text-xs rounded-lg hover:bg-[#48484A] disabled:opacity-40">
              {createMut.isPending ? t('common.guardando2') : t('common.guardar')}
            </button>
            <button onClick={() => { setShowAdd(false); createMut.reset() }} className="text-slate-400 text-xs px-3 py-1.5 hover:text-slate-700">{t('common.cancelar')}</button>
          </div>
        </div>
      )}

      {Object.entries(byCategory).map(([cat, list]) => (
        <div key={cat}>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{cat}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {list.map(p => (
              <ProviderCard key={p.id} provider={p} projectId={projectId} billing={(billing as any)[p.id]}
                onUpdate={(id, data) => updateMut.mutate({ id, data })}
                onDelete={id => deleteMut.mutate(id)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
