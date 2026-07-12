# INSTRUCTIVO DE IMPLEMENTACIÓN — Sistema Restrepo Acosta Global Holding LLC
**Versión:** 2.0 — Junio 2026  
**Stack:** Node.js + Express + TypeScript · React 18 + Vite · Prisma · PostgreSQL · Render  
**Propósito:** Guía paso a paso para implementar todas las mejoras técnicas y financieras del sistema.  
**Destinatario:** Claude (IDE Antigravity) ejecutando cambios directamente en el repositorio.

---

## REGLA GENERAL ANTES DE CUALQUIER CAMBIO

1. Leer el archivo completo antes de modificarlo (`view` o `Read`).
2. Nunca separar `backend/prisma/schema.prisma` en dos archivos — los modelos `Fin*` y los modelos técnicos conviven en el mismo schema.
3. Después de toda modificación al schema Prisma, ejecutar `npx prisma db push` localmente (SQLite) para validar antes de pushear a main.
4. Antes de pushear a main, ejecutar `npx tsc --noEmit` en `/backend` y en `/frontend` — cero errores.
5. Toda ruta nueva del backend sigue el patrón: `/api/finance/*` para módulo financiero, `/api/*` para módulo técnico.
6. Todo componente React nuevo va en `frontend/src/pages/` (página completa) o `frontend/src/components/` (componente reutilizable).

---

## BLOQUE 1 — MÓDULO TÉCNICO (CONSTRUCCIÓN)

### 1.1 — Fases 0–9 con % avance, fechas y Budget vs Actual por fase

**Objetivo de negocio:** Ver en una sola pantalla el estado real de cada etapa constructiva — cuánto se avanzó, cuánto costó vs lo presupuestado, y cuándo empezó y terminó cada fase.

**Estado actual:** Los modelos `Phase`, `Item` y `BudgetLine` ya existen en el schema. Falta una vista que consolide todo en forma útil.

**Lo que hay que construir:**

**BACKEND** — Crear endpoint `GET /api/projects/:id/phases-summary`

Archivo: `backend/src/routes/phases.ts` (ya existe — agregar la ruta al final del archivo)

```typescript
// Agregar al final de phases.ts, antes del export default

router.get('/:projectId/phases-summary', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const phases = await prisma.phase.findMany({
      where: { projectId },
      include: { items: { include: { documents: true } } },
      orderBy: { order: 'asc' },
    });

    const budgetLines = await prisma.budgetLine.findMany({
      where: { projectId },
    });

    const summary = phases.map(phase => {
      // Items completados vs total
      const totalItems = phase.items.length;
      const completedItems = phase.items.filter(i => i.completado).length;
      const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      // Budget: sumar BudgetLines cuyo divCode coincida con el código de la fase
      const phaseLines = budgetLines.filter(bl => bl.divCode === phase.code);
      const budgetTotal = phaseLines.reduce((s, bl) => s + bl.valorInicial, 0);
      const approvedTotal = phaseLines.reduce((s, bl) => s + bl.valorAprobado, 0);
      const paidTotal = phaseLines.reduce((s, bl) => s + bl.pagadoSubs, 0);

      // Fechas reales: min fechaInicioReal y max fechaFinReal entre sus items
      const startDates = phase.items
        .filter(i => i.fechaInicioReal)
        .map(i => i.fechaInicioReal!.getTime());
      const endDates = phase.items
        .filter(i => i.fechaFinReal)
        .map(i => i.fechaFinReal!.getTime());

      return {
        id: phase.id,
        code: phase.code,
        name: phase.name,
        groupName: phase.groupName,
        order: phase.order,
        totalItems,
        completedItems,
        progressPct,
        budgetTotal,
        approvedTotal,
        paidTotal,
        variancePct: budgetTotal > 0
          ? Math.round(((paidTotal - budgetTotal) / budgetTotal) * 100)
          : 0,
        startDateReal: startDates.length > 0 ? new Date(Math.min(...startDates)) : null,
        endDateReal: endDates.length > 0 ? new Date(Math.max(...endDates)) : null,
        status: progressPct === 100 ? 'COMPLETA'
          : progressPct > 0 ? 'EN_CURSO'
          : 'PENDIENTE',
      };
    });

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener resumen de fases' });
  }
});
```

**FRONTEND** — Crear `frontend/src/pages/PhasesDashboard.tsx`

Este componente muestra una tabla con las 10 fases (0–9), cada fila con:
- Nombre de la fase
- Barra de progreso visual (% avance de ítems completados)
- Fechas inicio/fin real
- Budget inicial vs pagado vs variación en $
- Semáforo de estado: verde (completa), amarillo (en curso), rojo (desviación >10%)

```tsx
// frontend/src/pages/PhasesDashboard.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface PhaseSummary {
  id: string;
  code: string;
  name: string;
  order: number;
  totalItems: number;
  completedItems: number;
  progressPct: number;
  budgetTotal: number;
  approvedTotal: number;
  paidTotal: number;
  variancePct: number;
  startDateReal: string | null;
  endDateReal: string | null;
  status: 'COMPLETA' | 'EN_CURSO' | 'PENDIENTE';
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const statusColor = (s: PhaseSummary) => {
  if (s.status === 'COMPLETA') return '#22c55e';
  if (s.status === 'EN_CURSO') return '#f59e0b';
  return '#94a3b8';
};

export default function PhasesDashboard() {
  const { id: projectId } = useParams();
  const [phases, setPhases] = useState<PhaseSummary[]>([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/phases-summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('pm_auth_token')}` },
    })
      .then(r => r.json())
      .then(setPhases);
  }, [projectId]);

  const totalBudget = phases.reduce((s, p) => s + p.budgetTotal, 0);
  const totalPaid = phases.reduce((s, p) => s + p.paidTotal, 0);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 4 }}>Control de Fases Constructivas</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        Budget total: <strong>{fmt(totalBudget)}</strong> · Pagado: <strong>{fmt(totalPaid)}</strong>
        · Variación: <strong style={{ color: totalPaid > totalBudget ? '#ef4444' : '#22c55e' }}>
          {fmt(totalPaid - totalBudget)}
        </strong>
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#1e3a5f', color: '#fff' }}>
            {['#','Fase','Progreso','Inicio Real','Fin Real','Budget','Pagado','Var %','Estado'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phases.map((p, i) => (
            <tr key={p.id} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.code}</td>
              <td style={{ padding: '10px 12px' }}>{p.name}</td>
              <td style={{ padding: '10px 12px', minWidth: 140 }}>
                <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, width: 120 }}>
                  <div style={{ background: statusColor(p), height: 8, borderRadius: 4, width: `${p.progressPct}%` }} />
                </div>
                <span style={{ fontSize: 12, color: '#64748b' }}>{p.progressPct}% ({p.completedItems}/{p.totalItems})</span>
              </td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>
                {p.startDateReal ? new Date(p.startDateReal).toLocaleDateString('en-US') : '—'}
              </td>
              <td style={{ padding: '10px 12px', fontSize: 13 }}>
                {p.endDateReal ? new Date(p.endDateReal).toLocaleDateString('en-US') : '—'}
              </td>
              <td style={{ padding: '10px 12px' }}>{fmt(p.budgetTotal)}</td>
              <td style={{ padding: '10px 12px' }}>{fmt(p.paidTotal)}</td>
              <td style={{ padding: '10px 12px', color: p.variancePct > 10 ? '#ef4444' : p.variancePct > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>
                {p.variancePct > 0 ? '+' : ''}{p.variancePct}%
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{ background: statusColor(p), color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12 }}>
                  {p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Registrar en el router principal (`frontend/src/App.tsx` o donde estén las rutas):
```tsx
<Route path="/tech/projects/:id/phases" element={<PhasesDashboard />} />
```

---

### 1.2 — Timeline Gantt Interactivo por Proyecto

**Objetivo de negocio:** Visualizar la secuencia de fases en el tiempo, ver dependencias, detectar superposiciones o huecos en el cronograma.

**Dependencia:** Los items ya tienen `fechaInicioReal` y `fechaFinReal`. El Gantt agrupa por fase.

**Instalar librería:**
```bash
cd frontend && npm install gantt-task-react
```

**FRONTEND** — Crear `frontend/src/pages/GanttView.tsx`

```tsx
// frontend/src/pages/GanttView.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

export default function GanttView() {
  const { id: projectId } = useParams();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/phases-summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('pm_auth_token')}` },
    })
      .then(r => r.json())
      .then((phases: any[]) => {
        const today = new Date();
        const ganttTasks: Task[] = phases
          .filter(p => p.startDateReal || p.endDateReal)
          .map(p => ({
            id: p.id,
            name: `${p.code} – ${p.name}`,
            start: p.startDateReal ? new Date(p.startDateReal) : today,
            end: p.endDateReal ? new Date(p.endDateReal) : today,
            progress: p.progressPct,
            type: 'task' as const,
            styles: {
              progressColor: p.variancePct > 10 ? '#ef4444' : p.status === 'COMPLETA' ? '#22c55e' : '#3b82f6',
              progressSelectedColor: '#1e3a5f',
            },
          }));
        setTasks(ganttTasks);
      });
  }, [projectId]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['Day','Week','Month'] as const).map(v => (
          <button
            key={v}
            onClick={() => setViewMode(ViewMode[v])}
            style={{
              padding: '6px 16px', borderRadius: 6, border: '1px solid #cbd5e1',
              background: viewMode === ViewMode[v] ? '#1e3a5f' : '#fff',
              color: viewMode === ViewMode[v] ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >{v}</button>
        ))}
      </div>
      {tasks.length > 0 ? (
        <Gantt tasks={tasks} viewMode={viewMode} locale="en-US" listCellWidth="200px" columnWidth={60} />
      ) : (
        <p style={{ color: '#94a3b8' }}>Aún no hay fechas registradas en las fases para mostrar el Gantt.</p>
      )}
    </div>
  );
}
```

Registrar en router:
```tsx
<Route path="/tech/projects/:id/gantt" element={<GanttView />} />
```

Agregar botón "Gantt" en la barra de navegación del proyecto.

---

### 1.3 — Fotos de Obra Vinculadas a Fase e Inspección

**Objetivo de negocio:** Documentar visualmente el avance por fase. Las fotos sirven como soporte para draws, HOA, lender y auditoría.

**Estado actual:** `ItemDocument` y `ProjectFile` ya soportan URLs de imágenes. Solo falta una galería visual.

**FRONTEND** — Crear `frontend/src/pages/PhotoGallery.tsx`

```tsx
// frontend/src/pages/PhotoGallery.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface Photo {
  id: string;
  name: string;
  url: string;
  category?: string;
  createdAt: string;
  kind: 'project' | 'item';
  phaseName?: string;
}

export default function PhotoGallery() {
  const { id: projectId } = useParams();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Photo | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/files/${projectId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('pm_auth_token')}` },
      }).then(r => r.json()),
    ]).then(([files]) => {
      const imgs = (files as any[])
        .filter(f => f.mimetype?.startsWith('image/'))
        .map(f => ({ ...f, kind: 'project' as const }));
      setPhotos(imgs);
    });
  }, [projectId]);

  const categories = ['all', ...Array.from(new Set(photos.map(p => p.category || 'Sin categoría')))];

  const filtered = filter === 'all' ? photos : photos.filter(p => (p.category || 'Sin categoría') === filter);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Galería de Obra</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{
              padding: '4px 14px', borderRadius: 20, cursor: 'pointer',
              background: filter === c ? '#1e3a5f' : '#f1f5f9',
              color: filter === c ? '#fff' : '#374151',
              border: 'none', fontSize: 13,
            }}>{c}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {filtered.map(p => (
          <div key={p.id} onClick={() => setSelected(p)}
            style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', background: '#fff' }}>
            <img src={p.url} alt={p.name}
              style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(p.createdAt).toLocaleDateString('en-US')}</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: '#94a3b8', gridColumn: '1/-1' }}>No hay fotos en esta categoría.</p>
        )}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <img src={selected.url} alt={selected.name}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}
```

---

### 1.4 — Notificaciones de Hito Próximo (Inspecciones, Permisos)

**Objetivo de negocio:** Que el sistema avise con anticipación cuando hay una inspección próxima o un permiso por vencer, sin depender de la memoria del equipo.

**BACKEND** — Crear `backend/src/routes/alerts.ts` (ya existe — agregar endpoint de alertas técnicas al final)

```typescript
// Agregar en backend/src/routes/alerts.ts

router.get('/upcoming', authMiddleware, async (req, res) => {
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Inspecciones programadas en los próximos 30 días sin resultado
  const inspecciones = await prisma.inspection.findMany({
    where: {
      fechaSolicitada: { gte: today, lte: in30 },
      resultado: null,
    },
    include: { project: { select: { name: true } } },
    orderBy: { fechaSolicitada: 'asc' },
  });

  // Permisos por vencer en los próximos 30 días
  const permisos = await prisma.project.findMany({
    where: {
      permitExpires: { gte: today, lte: in30 },
    },
    select: { id: true, name: true, permitExpires: true, permitNumber: true },
  });

  // Tareas con dueDate vencida o próxima
  const tareas = await prisma.task.findMany({
    where: {
      done: false,
      dueDate: { lte: in30 },
    },
    include: { project: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  res.json({
    inspecciones: inspecciones.map(i => ({
      type: 'INSPECCION',
      severity: i.fechaSolicitada! < new Date(today.getTime() + 7 * 86400000) ? 'HIGH' : 'MEDIUM',
      projectName: i.project.name,
      description: `${i.tipo} — WBS ${i.wbs}`,
      date: i.fechaSolicitada,
      url: `/tech/projects/${i.projectId}/inspections`,
    })),
    permisos: permisos.map(p => ({
      type: 'PERMISO',
      severity: p.permitExpires! < new Date(today.getTime() + 7 * 86400000) ? 'CRITICAL' : 'HIGH',
      projectName: p.name,
      description: `Permiso #${p.permitNumber} vence`,
      date: p.permitExpires,
      url: `/tech/projects/${p.id}`,
    })),
    tareas: tareas.map(t => ({
      type: 'TAREA',
      severity: t.dueDate! < today ? 'CRITICAL' : 'MEDIUM',
      projectName: t.project.name,
      description: t.title,
      date: t.dueDate,
      url: `/tech/projects/${t.projectId}/tasks`,
    })),
  });
});
```

**FRONTEND** — Crear componente `frontend/src/components/AlertsPanel.tsx`

```tsx
// frontend/src/components/AlertsPanel.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SEVERITY_STYLE: Record<string, { bg: string; label: string }> = {
  CRITICAL: { bg: '#fef2f2', label: '#dc2626' },
  HIGH: { bg: '#fff7ed', label: '#ea580c' },
  MEDIUM: { bg: '#fffbeb', label: '#ca8a04' },
};

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/alerts/upcoming', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pm_auth_token')}` },
    })
      .then(r => r.json())
      .then(data => {
        const all = [
          ...(data.inspecciones || []),
          ...(data.permisos || []),
          ...(data.tareas || []),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setAlerts(all);
      });
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {alerts.slice(0, 8).map((a, i) => {
          const s = SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.MEDIUM;
          return (
            <div key={i} onClick={() => navigate(a.url)}
              style={{
                minWidth: 220, padding: '8px 12px', borderRadius: 8,
                background: s.bg, border: `1px solid ${s.label}33`,
                cursor: 'pointer', flexShrink: 0,
              }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.label, marginBottom: 2 }}>
                {a.type} · {a.severity}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{a.projectName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{a.description}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {a.date ? new Date(a.date).toLocaleDateString('en-US') : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Incluir `<AlertsPanel />` en el layout principal de `/tech/*` (justo debajo del header).

---

### 1.5 — Gestión de Subcontratistas: Contratos, Scope, Pagos Programados

**Objetivo de negocio:** Cada contratista debe tener contrato firmado, alcance definido, y calendario de pagos vinculado al avance físico.

**Schema — Agregar a `backend/prisma/schema.prisma`** (al final del bloque de modelos técnicos, antes del comentario del módulo financiero):

```prisma
model SubcontractorContract {
  id            String    @id @default(cuid())
  providerId    String
  provider      Provider  @relation(fields: [providerId], references: [id], onDelete: Cascade)
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  contractValue Float     @default(0)
  scopeDetails  String?   // Texto libre con el alcance exacto
  startDate     DateTime?
  endDate       DateTime?
  status        String    @default("ACTIVO") // ACTIVO | COMPLETADO | CANCELADO
  contractUrl   String?   // PDF del contrato firmado
  contractName  String?
  notes         String?
  paymentSchedule SubcontractorPayment[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("subcontractor_contract")  // si prefieres snake_case en DB
}

model SubcontractorPayment {
  id           String                @id @default(cuid())
  contractId   String
  contract     SubcontractorContract @relation(fields: [contractId], references: [id], onDelete: Cascade)
  milestoneDesc String               // "Framing completado al 100%"
  amount       Float                @default(0)
  dueDate      DateTime?
  paidDate     DateTime?
  status       String               @default("PENDIENTE") // PENDIENTE | PAGADO | RETENIDO
  notes        String?
  createdAt    DateTime             @default(now())
}
```

**Agregar relaciones en `Provider`** (dentro del modelo existente):
```prisma
contracts SubcontractorContract[]
```

**Agregar relaciones en `Project`** (dentro del modelo existente):
```prisma
subcontracts SubcontractorContract[]
```

**BACKEND** — Crear `backend/src/routes/subcontracts.ts`

```typescript
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Listar contratos por proyecto
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  const contracts = await prisma.subcontractorContract.findMany({
    where: { projectId: req.params.projectId },
    include: {
      provider: { select: { id: true, name: true, type: true, phone: true } },
      paymentSchedule: { orderBy: { dueDate: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(contracts);
});

// Crear contrato
router.post('/', authMiddleware, async (req, res) => {
  const contract = await prisma.subcontractorContract.create({ data: req.body });
  res.json(contract);
});

// Actualizar contrato
router.put('/:id', authMiddleware, async (req, res) => {
  const contract = await prisma.subcontractorContract.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(contract);
});

// Agregar pago al schedule
router.post('/:id/payments', authMiddleware, async (req, res) => {
  const payment = await prisma.subcontractorPayment.create({
    data: { ...req.body, contractId: req.params.id },
  });
  res.json(payment);
});

// Marcar pago como pagado
router.patch('/payments/:paymentId/pay', authMiddleware, async (req, res) => {
  const payment = await prisma.subcontractorPayment.update({
    where: { id: req.params.paymentId },
    data: { status: 'PAGADO', paidDate: new Date() },
  });
  res.json(payment);
});

export default router;
```

Registrar en `backend/src/app.ts`:
```typescript
import subcontractsRouter from './routes/subcontracts';
app.use('/api/subcontracts', subcontractsRouter);
```

**FRONTEND** — Crear `frontend/src/pages/Subcontracts.tsx`

Pantalla con:
- Lista de contratos por proveedor (nombre, valor total, estado, % pagado)
- Al hacer click en un contrato: expandir el calendario de pagos con semáforo (PENDIENTE/PAGADO/VENCIDO)
- Botón "Registrar pago" que llama al endpoint `/pay`
- Total comprometido vs total pagado por proyecto

---

## BLOQUE 2 — MÓDULO FINANCIERO

### 2.1 — Dashboard de Flujo de Caja Semanal/Mensual por LLC

**Objetivo de negocio:** Ver en una vista consolidada los ingresos y egresos agrupados por semana o mes, por cuenta (LLC), con saldo running.

**Estado actual:** El modelo `FinMovement` ya tiene todos los datos necesarios. Solo falta el endpoint de agregación y el componente de visualización.

**BACKEND** — Agregar en `backend/src/routes/` (crear `cashflow.ts`):

```typescript
// backend/src/routes/cashflow.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/finance/cashflow?groupBy=week|month&months=3
router.get('/', authMiddleware, async (req, res) => {
  const months = parseInt(req.query.months as string) || 3;
  const groupBy = (req.query.groupBy as string) || 'month';

  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const movements = await prisma.finMovement.findMany({
    where: { date: { gte: since } },
    include: { account: { select: { code: true, name: true } } },
    orderBy: { date: 'asc' },
  });

  // Agrupar
  const buckets: Record<string, { period: string; ingresos: number; egresos: number; neto: number }> = {};

  for (const m of movements) {
    const d = new Date(m.date);
    let key: string;
    if (groupBy === 'week') {
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - day + 1);
      key = monday.toISOString().slice(0, 10);
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!buckets[key]) buckets[key] = { period: key, ingresos: 0, egresos: 0, neto: 0 };
    if (m.type === 'Ingreso') buckets[key].ingresos += m.amount;
    else if (m.type === 'Egreso') buckets[key].egresos += m.amount;
  }

  const result = Object.values(buckets).map(b => ({
    ...b,
    neto: b.ingresos - b.egresos,
  }));

  // Saldo corriente running (acumulado)
  let runningBalance = 0;
  const withRunning = result.map(r => {
    runningBalance += r.neto;
    return { ...r, runningBalance };
  });

  res.json(withRunning);
});

export default router;
```

Registrar en `backend/src/app.ts`:
```typescript
import cashflowRouter from './routes/cashflow';
app.use('/api/finance/cashflow', cashflowRouter);
```

**FRONTEND** — Agregar sección al `Financial.tsx` existente o crear `frontend/src/pages/CashflowDashboard.tsx`:

Usar `recharts` (ya está instalado en el proyecto) para mostrar:
- `BarChart` apilado: Ingresos (verde) + Egresos (rojo) por período
- `LineChart` superpuesto: Saldo running (azul)
- Selector de período: Semana / Mes, últimos 1/3/6/12 meses

---

### 2.2 — Alertas por Bajo Saldo (Email/WhatsApp)

**Objetivo de negocio:** Recibir alerta automática cuando una cuenta cae por debajo de un umbral definido, antes de que haya un problema de caja.

**BACKEND** — Agregar en `backend/prisma/schema.prisma` (dentro del bloque financiero):

```prisma
model FinAccountAlert {
  id            Int      @id @default(autoincrement())
  accountId     Int
  account       FinAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  thresholdLow  Float    @default(5000)   // Alerta cuando saldo < este valor
  emailEnabled  Boolean  @default(true)
  emailTo       String?
  lastTriggered DateTime?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  @@map("fin_account_alert")
}
```

Agregar relación en `FinAccount`:
```prisma
alerts FinAccountAlert[]
```

**BACKEND** — Crear `backend/src/services/alertService.ts`:

```typescript
// backend/src/services/alertService.ts
import { prisma } from '../lib/prisma';
import nodemailer from 'nodemailer';

export async function checkBalanceAlerts() {
  const alerts = await prisma.finAccountAlert.findMany({
    where: { active: true },
    include: { account: true },
  });

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.ALERT_EMAIL_USER,
      pass: process.env.ALERT_EMAIL_PASS,
    },
  });

  for (const alert of alerts) {
    if (alert.account.currentBalance < alert.thresholdLow) {
      // Evitar spam: solo disparar si no se disparó en las últimas 24h
      const lastTriggered = alert.lastTriggered;
      const hoursSinceLast = lastTriggered
        ? (Date.now() - lastTriggered.getTime()) / 3600000
        : 999;

      if (hoursSinceLast > 24) {
        if (alert.emailEnabled && alert.emailTo) {
          await transporter.sendMail({
            from: process.env.ALERT_EMAIL_USER,
            to: alert.emailTo,
            subject: `⚠️ Alerta: Saldo bajo en ${alert.account.name}`,
            html: `
              <h2>Alerta de saldo bajo</h2>
              <p>La cuenta <strong>${alert.account.name}</strong> tiene un saldo de 
              <strong>$${alert.account.currentBalance.toLocaleString()}</strong>, 
              por debajo del umbral de $${alert.thresholdLow.toLocaleString()}.</p>
              <p>Revisa el sistema: <a href="${process.env.APP_URL}/finance">Ver finanzas</a></p>
            `,
          });
        }

        await prisma.finAccountAlert.update({
          where: { id: alert.id },
          data: { lastTriggered: new Date() },
        });
      }
    }
  }
}
```

Instalar nodemailer:
```bash
cd backend && npm install nodemailer @types/nodemailer
```

Activar el chequeo automático en `backend/src/app.ts`:
```typescript
import { checkBalanceAlerts } from './services/alertService';

// Correr cada 6 horas
setInterval(() => checkBalanceAlerts(), 6 * 60 * 60 * 1000);
checkBalanceAlerts(); // también al arrancar
```

Variables de entorno a agregar en Render:
```
ALERT_EMAIL_USER=jrestrepoavila88@gmail.com
ALERT_EMAIL_PASS=<app password de Gmail>
APP_URL=https://restrepoacosta.onrender.com
```

---

### 2.3 — Conciliación Bancaria: Importar CSV y Comparar vs Registros

**Estado actual:** El schema ya tiene `FinBankStatement` y `FinBankStatementLine` con campo `matchStatus`. La lógica de matching ya existe parcialmente. Lo que falta es la pantalla de UI para ver el estado de conciliación de forma clara.

**FRONTEND** — Crear `frontend/src/pages/BankReconciliation.tsx`

Esta pantalla debe:
1. Mostrar los extractos cargados por cuenta con botón "Ver líneas"
2. Para cada extracto: tabla con las líneas del extracto, color por `matchStatus`
   - Verde (`matched`): conciliado
   - Amarillo (`unmatched` pero hay movimiento manual cercano en fecha/monto): sugerencia de match
   - Rojo (`unmatched`): sin contrapartida — registrar movimiento faltante
3. Botón "Auto-match" que llama al endpoint de matching automático
4. Métricas: % conciliado, total en extracto vs total en sistema, diferencia

**BACKEND** — Agregar endpoint de auto-matching en la ruta de statements:

```typescript
// Agregar en la ruta de bank statements existente

router.post('/:statementId/auto-match', authMiddleware, async (req, res) => {
  const { statementId } = req.params;
  const lines = await prisma.finBankStatementLine.findMany({
    where: { statementId: parseInt(statementId), matchStatus: 'unmatched' },
  });

  let matched = 0;
  for (const line of lines) {
    // Buscar movimiento manual con misma fecha (±2 días) y mismo monto
    const dateFrom = new Date(line.date);
    dateFrom.setDate(dateFrom.getDate() - 2);
    const dateTo = new Date(line.date);
    dateTo.setDate(dateTo.getDate() + 2);

    const candidate = await prisma.finMovement.findFirst({
      where: {
        amount: { gte: Math.abs(line.amount) * 0.99, lte: Math.abs(line.amount) * 1.01 },
        date: { gte: dateFrom, lte: dateTo },
        matchStatus: 'pending',
      },
    });

    if (candidate) {
      await prisma.finBankStatementLine.update({
        where: { id: line.id },
        data: { matchStatus: 'matched', matchedMovementId: candidate.id },
      });
      await prisma.finMovement.update({
        where: { id: candidate.id },
        data: { matchStatus: 'matched', matchedLineId: line.id, isReconciled: true },
      });
      matched++;
    }
  }

  res.json({ matched, total: lines.length });
});
```

---

### 2.4 — Proyecciones de Liquidez a 90 Días por Proyecto Activo

**Objetivo de negocio:** Saber hoy cuándo se necesitará capital adicional en los próximos 3 meses, por proyecto, para anticipar necesidades de financiamiento antes de que sean urgentes.

**BACKEND** — Crear endpoint `GET /api/finance/liquidity-projection`:

```typescript
// backend/src/routes/liquidityProjection.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const today = new Date();
  const in90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Pagos programados de subcontratistas en los próximos 90 días
  const payments = await prisma.subcontractorPayment.findMany({
    where: {
      dueDate: { gte: today, lte: in90 },
      status: 'PENDIENTE',
    },
    include: {
      contract: {
        include: {
          project: { select: { id: true, name: true } },
          provider: { select: { name: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });

  // Draws solicitados pero no wired (compromisos salientes)
  const draws = await prisma.draw.findMany({
    where: {
      estado: { in: ['SOLICITADO', 'APROBADO'] },
    },
    include: { project: { select: { name: true } } },
  });

  // Saldo actual de cuentas
  const accounts = await prisma.finAccount.findMany({
    where: { active: true },
    select: { name: true, currentBalance: true, code: true },
  });

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalCommitted = payments.reduce((s, p) => s + p.amount, 0);
  const totalDrawsPending = draws.reduce((s, d) => s + d.montoSolicitado, 0);

  // Proyección: agrupar salidas por semana
  const weeklyProjection: Record<string, number> = {};
  for (const p of payments) {
    const week = new Date(p.dueDate!);
    week.setDate(week.getDate() - week.getDay() + 1);
    const key = week.toISOString().slice(0, 10);
    weeklyProjection[key] = (weeklyProjection[key] || 0) + p.amount;
  }

  res.json({
    currentBalance: totalBalance,
    totalCommitted,
    totalDrawsPending,
    projectedFreeBalance: totalBalance - totalCommitted,
    accounts,
    upcomingPayments: payments.map(p => ({
      date: p.dueDate,
      amount: p.amount,
      projectName: p.contract.project.name,
      providerName: p.contract.provider.name,
      milestone: p.milestoneDesc,
    })),
    weeklyOutflows: Object.entries(weeklyProjection).map(([week, amount]) => ({ week, amount })).sort((a, b) => a.week.localeCompare(b.week)),
    draws: draws.map(d => ({
      project: d.project.name,
      drawNumber: d.drawNumber,
      amount: d.montoSolicitado,
      status: d.estado,
    })),
  });
});

export default router;
```

**FRONTEND** — Crear `frontend/src/pages/LiquidityProjection.tsx`

Vista con:
- Panel superior: saldo actual vs compromisos vs saldo libre proyectado
- Gráfico de barras: salidas proyectadas por semana en los próximos 90 días (recharts)
- Tabla de pagos programados con fecha, proyecto, proveedor y monto
- Alerta visual si `projectedFreeBalance < 0`

---

### 2.5 — Reporte de Retorno por Proyecto (ROI, IRR, Profit Margin)

**Objetivo de negocio:** Comparar proyectos entre sí en términos de rentabilidad real, no solo de ingresos brutos.

**BACKEND** — Crear `GET /api/finance/project-returns`:

```typescript
// backend/src/routes/projectReturns.ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  const finProjects = await prisma.finProject.findMany({
    include: {
      movements: true,
      loans: true,
      capitalContribs: true,
    },
  });

  const results = finProjects.map(proj => {
    const totalInverted = proj.movements
      .filter(m => m.type === 'Egreso' || m.isLoan)
      .reduce((s, m) => s + m.amount, 0);

    const totalIncome = proj.movements
      .filter(m => m.type === 'Ingreso' && !m.isLoan && !m.isIntercompany)
      .reduce((s, m) => s + m.amount, 0);

    const totalEquity = proj.capitalContribs.reduce((s, c) => s + c.amount, 0);
    const totalDebt = proj.loans.reduce((s, l) => s + l.amount, 0);

    const grossProfit = totalIncome - totalInverted;
    const profitMarginPct = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    const roi = totalEquity > 0 ? (grossProfit / totalEquity) * 100 : 0;

    return {
      id: proj.id,
      code: proj.code,
      name: proj.name,
      status: proj.status,
      arv: proj.arv,
      expectedCost: proj.expectedCost,
      totalInverted,
      totalIncome,
      grossProfit,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
      roi: Math.round(roi * 10) / 10,
      totalEquity,
      totalDebt,
      debtEquityRatio: totalEquity > 0 ? Math.round((totalDebt / totalEquity) * 100) / 100 : null,
    };
  });

  res.json(results);
});

export default router;
```

**FRONTEND** — Agregar como sección en `Financial.tsx` o como página separada:

Tabla con columnas: Proyecto · ARV · Costo Real · Ingreso · Profit $ · Margen % · ROI · Deuda/Equity.  
Semáforo por margen: verde >20%, amarillo 10–20%, rojo <10%.

---

### 2.6 — Integración con Trinity (Lender) para Importar Inspecciones en PDF

**Objetivo de negocio:** Eliminar el ingreso manual de datos de inspecciones del lender. El sistema debe poder leer el PDF de Trinity y extraer: draw number, monto aprobado, % completado por línea.

**BACKEND** — Este requiere un parser de PDF. Usar `pdf-parse`:

```bash
cd backend && npm install pdf-parse @types/pdf-parse
```

Crear `backend/src/services/trinityPdfParser.ts`:

```typescript
import pdfParse from 'pdf-parse';

export interface TrinityInspectionData {
  drawNumber: number | null;
  inspectionDate: string | null;
  totalApproved: number | null;
  lines: Array<{
    itemCode: string;
    description: string;
    pctComplete: number;
    amountApproved: number;
  }>;
}

export async function parseTrinityPdf(buffer: Buffer): Promise<TrinityInspectionData> {
  const data = await pdfParse(buffer);
  const text = data.text;

  // Extraer número de draw
  const drawMatch = text.match(/Draw\s*#?\s*(\d+)/i);
  const drawNumber = drawMatch ? parseInt(drawMatch[1]) : null;

  // Extraer fecha
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  const inspectionDate = dateMatch ? dateMatch[1] : null;

  // Extraer monto total aprobado
  const totalMatch = text.match(/Total\s+Approved[:\s]+\$?([\d,]+\.?\d*)/i);
  const totalApproved = totalMatch ? parseFloat(totalMatch[1].replace(',', '')) : null;

  // Extraer líneas (ajustar regex según formato real del PDF de Trinity)
  // Patrón esperado: código · descripción · % · $monto
  const linePattern = /([A-Z]\d{2,4})\s+([^\n]+?)\s+(\d{1,3})%\s+\$?([\d,]+\.?\d*)/g;
  const lines = [];
  let match;
  while ((match = linePattern.exec(text)) !== null) {
    lines.push({
      itemCode: match[1],
      description: match[2].trim(),
      pctComplete: parseInt(match[3]),
      amountApproved: parseFloat(match[4].replace(',', '')),
    });
  }

  return { drawNumber, inspectionDate, totalApproved, lines };
}
```

**NOTA IMPORTANTE:** El regex del parser debe ajustarse al formato real del PDF de Trinity. Una vez que tengas un PDF de ejemplo, enviárselo a Claude para que calibre el regex exacto.

Crear endpoint en `backend/src/routes/draws.ts` (ya existe — agregar ruta):
```typescript
// POST /api/projects/:id/draws/parse-trinity
router.post('/:projectId/draws/parse-trinity', authMiddleware, upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF requerido' });
  const { parseTrinityPdf } = await import('../services/trinityPdfParser');
  const result = await parseTrinityPdf(req.file.buffer);
  res.json(result);
});
```

---

## BLOQUE 3 — MEJORAS ADICIONALES PROPUESTAS (más allá del documento original)

### 3.1 — Dashboard Ejecutivo Cruzado: Técnico + Financiero por Proyecto

**Por qué:** La mayor debilidad actual es que el módulo técnico y el módulo financiero operan aislados. Un dashboard que muestre simultáneamente "Fase actual → Costo real → Draw disponible → Saldo de caja" elimina la necesidad de abrir múltiples pantallas para entender la salud de un proyecto.

**BACKEND** — Crear `GET /api/projects/:id/executive-summary`:

```typescript
router.get('/:id/executive-summary', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const [project, phases, draws, inspections, tasks] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.phase.findMany({
      where: { projectId: id },
      include: { items: true },
      orderBy: { order: 'asc' },
    }),
    prisma.draw.findMany({ where: { projectId: id }, orderBy: { drawNumber: 'desc' } }),
    prisma.inspection.findMany({
      where: { projectId: id, estado: { not: 'APROBADA' } },
      orderBy: { fechaSolicitada: 'asc' },
    }),
    prisma.task.findMany({ where: { projectId: id, done: false }, orderBy: { dueDate: 'asc' } }),
  ]);

  // Avance global
  const allItems = phases.flatMap(p => p.items);
  const globalProgress = allItems.length > 0
    ? Math.round((allItems.filter(i => i.completado).length / allItems.length) * 100)
    : 0;

  // Fase activa (primera con items pendientes)
  const activePhase = phases.find(p => p.items.some(i => !i.completado));

  // Draw más reciente
  const latestDraw = draws[0] || null;

  // Budget summary
  const budgetLines = await prisma.budgetLine.findMany({ where: { projectId: id } });
  const totalBudget = budgetLines.reduce((s, b) => s + b.valorInicial, 0);
  const totalPaid = budgetLines.reduce((s, b) => s + b.pagadoSubs, 0);

  res.json({
    project: { name: project?.name, address: project?.address, lender: project?.lender },
    globalProgress,
    activePhase: activePhase ? { code: activePhase.code, name: activePhase.name } : null,
    totalBudget,
    totalPaid,
    budgetVariancePct: totalBudget > 0 ? Math.round(((totalPaid - totalBudget) / totalBudget) * 100) : 0,
    drawsSummary: {
      totalDraws: draws.length,
      totalFunded: draws.reduce((s, d) => s + d.netWire, 0),
      latestDraw: latestDraw ? {
        number: latestDraw.drawNumber,
        status: latestDraw.estado,
        amount: latestDraw.netWire,
      } : null,
    },
    pendingInspections: inspections.length,
    overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length,
    loanAmount: project?.loanAmount,
    upbPost: latestDraw?.upbPost,
    remainingLoanBalance: project ? (project.loanAmount - (latestDraw?.upbPost || 0)) : 0,
  });
});
```

**FRONTEND** — Crear `frontend/src/pages/ExecutiveDashboard.tsx`

Dashboard de una sola pantalla por proyecto con cards:
- Progreso global de obra (% circular grande)
- Fase activa con nombre y próximas actividades
- Budget: inicial vs pagado vs variación
- Draws: último draw, monto, estado
- Loan: monto original, UPB actual, saldo disponible
- Alertas: inspecciones pendientes, tareas vencidas

---

### 3.2 — Draw Package PDF Automático (Listo para Enviar al Lender)

**Por qué:** Hoy el draw package se arma manualmente. Con toda la información ya en el sistema, se puede generar un PDF ejecutivo con: número de draw, % avance por fase, fotos de avance, facturas vinculadas, resumen financiero. Esto ahorra horas por draw y reduce errores.

**BACKEND** — Instalar `pdfkit`:
```bash
cd backend && npm install pdfkit @types/pdfkit
```

Crear `backend/src/services/drawPackageGenerator.ts`:

```typescript
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma';

export async function generateDrawPackage(drawId: string): Promise<Buffer> {
  const draw = await prisma.draw.findUnique({
    where: { id: drawId },
    include: {
      project: {
        include: {
          phases: { include: { items: true } },
          budgetLines: true,
        },
      },
    },
  });

  if (!draw) throw new Error('Draw no encontrado');

  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 50, bottom: 50, left: 60, right: 60 } });
  const chunks: Buffer[] = [];
  doc.on('data', chunk => chunks.push(chunk));

  // Encabezado
  doc.fontSize(18).text('DRAW REQUEST PACKAGE', { align: 'center' });
  doc.fontSize(12).text(`${draw.project.name}`, { align: 'center' });
  doc.text(`Draw #${draw.drawNumber} · ${draw.fechaSolicitud?.toLocaleDateString('en-US') || ''}`, { align: 'center' });
  doc.moveDown(2);

  // Resumen financiero
  doc.fontSize(14).text('FINANCIAL SUMMARY');
  doc.fontSize(11);
  doc.text(`Amount Requested: $${draw.montoSolicitado.toLocaleString()}`);
  doc.text(`Trinity Eligible: $${draw.elegibleTrinity.toLocaleString()}`);
  doc.text(`Net Wire: $${draw.netWire.toLocaleString()}`);
  doc.text(`UPB Post Draw: $${draw.upbPost.toLocaleString()}`);
  doc.moveDown();

  // Avance por fase
  doc.fontSize(14).text('CONSTRUCTION PROGRESS BY PHASE');
  doc.fontSize(11);
  for (const phase of draw.project.phases) {
    const total = phase.items.length;
    const done = phase.items.filter(i => i.completado).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    doc.text(`${phase.code} – ${phase.name}: ${pct}% (${done}/${total} items)`);
  }
  doc.moveDown();

  // Cerrar el doc
  doc.end();

  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
```

Endpoint en `draws.ts`:
```typescript
router.get('/:drawId/package-pdf', authMiddleware, async (req, res) => {
  const { generateDrawPackage } = await import('../services/drawPackageGenerator');
  const buffer = await generateDrawPackage(req.params.drawId);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="draw-package-${req.params.drawId}.pdf"`,
  });
  res.send(buffer);
});
```

---

### 3.3 — Reporte Semanal Automático por Email (Digest Técnico + Financiero)

**Por qué:** En lugar de abrir el sistema para revisar el estado, el sistema debe enviarte un resumen ejecutivo cada lunes antes de las 8am con: estado de obra, próximas inspecciones, caja actual, draws pendientes, tareas vencidas.

**BACKEND** — Crear `backend/src/services/weeklyDigest.ts`:

```typescript
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';

export async function sendWeeklyDigest() {
  const projects = await prisma.project.findMany({
    include: {
      phases: { include: { items: true } },
      draws: { orderBy: { drawNumber: 'desc' }, take: 1 },
      inspections: {
        where: { estado: { not: 'APROBADA' }, fechaSolicitada: { gte: new Date() } },
        orderBy: { fechaSolicitada: 'asc' },
        take: 3,
      },
      tasks: { where: { done: false, dueDate: { lte: new Date(Date.now() + 7 * 86400000) } } },
    },
  });

  const accounts = await prisma.finAccount.findMany({ where: { active: true } });
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  let html = `
    <h1 style="color:#1e3a5f">📋 Reporte Semanal — Restrepo Acosta</h1>
    <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    <hr>
    <h2>💰 Posición de Caja</h2>
    <p>Saldo total consolidado: <strong>$${totalBalance.toLocaleString()}</strong></p>
    ${accounts.map(a => `<p style="margin:4px 0">• ${a.name}: $${a.currentBalance.toLocaleString()}</p>`).join('')}
    <hr>
    <h2>🏗️ Estado de Proyectos</h2>
  `;

  for (const project of projects) {
    const allItems = project.phases.flatMap(p => p.items);
    const progress = allItems.length > 0
      ? Math.round((allItems.filter(i => i.completado).length / allItems.length) * 100)
      : 0;
    const latestDraw = project.draws[0];

    html += `
      <h3>${project.name}</h3>
      <p>Avance global: <strong>${progress}%</strong></p>
      ${latestDraw ? `<p>Último draw: #${latestDraw.drawNumber} · ${latestDraw.estado} · $${latestDraw.netWire.toLocaleString()}</p>` : ''}
      ${project.inspections.length > 0 ? `<p>⚠️ Inspecciones próximas: ${project.inspections.map(i => `${i.tipo} (${i.fechaSolicitada?.toLocaleDateString('en-US')})`).join(', ')}</p>` : ''}
      ${project.tasks.length > 0 ? `<p>📌 Tareas próximas: ${project.tasks.length}</p>` : ''}
    `;
  }

  html += `<hr><p style="color:#94a3b8;font-size:12px">Generado automáticamente por Construction PM · Restrepo Acosta Global Holding LLC</p>`;

  const transporter = nodemailer.createTransporter({
    service: 'gmail',
    auth: { user: process.env.ALERT_EMAIL_USER, pass: process.env.ALERT_EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.ALERT_EMAIL_USER,
    to: 'jrestrepoavila88@gmail.com',
    subject: `📋 Reporte Semanal Construction PM — ${new Date().toLocaleDateString('en-US')}`,
    html,
  });
}
```

Activar en `app.ts`:
```typescript
import { sendWeeklyDigest } from './services/weeklyDigest';

// Ejecutar todos los lunes a las 7am (verificar timezone)
function scheduleWeeklyDigest() {
  const now = new Date();
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
  nextMonday.setHours(7, 0, 0, 0);
  const msUntil = nextMonday.getTime() - now.getTime();
  setTimeout(() => {
    sendWeeklyDigest();
    setInterval(sendWeeklyDigest, 7 * 24 * 60 * 60 * 1000);
  }, msUntil);
}
scheduleWeeklyDigest();
```

---

### 3.4 — Scorecard de Subcontratistas

**Por qué:** Con el tiempo, el sistema acumula información sobre cada contratista: cuántos pagos se hicieron a tiempo, cuántos draws asociados tuvieron problemas, cuántas inspecciones fallidas en sus fases. Esto permite tomar mejores decisiones en el siguiente proyecto.

**BACKEND** — Endpoint `GET /api/providers/:id/scorecard`:

```typescript
router.get('/:id/scorecard', authMiddleware, async (req, res) => {
  const provider = await prisma.provider.findUnique({
    where: { id: req.params.id },
    include: {
      items: {
        include: {
          phase: { select: { name: true } },
          documents: true,
        },
      },
      contracts: {
        include: { paymentSchedule: true },
      },
    },
  });

  if (!provider) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const totalItems = provider.items.length;
  const completedItems = provider.items.filter(i => i.completado).length;
  const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const allPayments = provider.contracts.flatMap(c => c.paymentSchedule);
  const paidOnTime = allPayments.filter(p =>
    p.status === 'PAGADO' && p.paidDate && p.dueDate && p.paidDate <= p.dueDate
  ).length;
  const paymentPunctuality = allPayments.filter(p => p.status === 'PAGADO').length > 0
    ? Math.round((paidOnTime / allPayments.filter(p => p.status === 'PAGADO').length) * 100)
    : null;

  res.json({
    name: provider.name,
    type: provider.type,
    totalItems,
    completedItems,
    completionRate,
    totalContracts: provider.contracts.length,
    totalContractValue: provider.contracts.reduce((s, c) => s + c.contractValue, 0),
    totalPaid: allPayments.filter(p => p.status === 'PAGADO').reduce((s, p) => s + p.amount, 0),
    paymentPunctuality,
  });
});
```

---

### 3.5 — Modo Multi-Proyecto: Navegación Global y Comparación

**Por qué:** El negocio está creciendo a múltiples proyectos simultáneos. La app debe mostrar una vista global de portafolio desde la pantalla principal, no solo proyecto a proyecto.

**FRONTEND** — Mejorar `frontend/src/pages/Projects.tsx`:

Agregar una vista de portafolio con:
- Cards por proyecto: foto (si existe), dirección, % avance, saldo de draw disponible, próxima inspección
- Filtros por estado: en construcción / completado / enlistado
- Ordenar por: % avance, fecha de inicio, budget total
- KPI row arriba: total proyectos activos, total capital invertido, total draws fondeados

---

## BLOQUE 4 — ORDEN DE IMPLEMENTACIÓN RECOMENDADO

Implementar en este orden estricto. Cada ítem debe deployarse y validarse antes de pasar al siguiente.

| Orden | Módulo | Item | Impacto | Esfuerzo |
|-------|--------|------|---------|----------|
| 1 | TÉCNICO | Fases 0-9 con % avance, budget vs actual (1.1) | 🔴 Alto | Medio |
| 2 | TÉCNICO | Notificaciones de hito próximo (1.4) | 🔴 Alto | Bajo |
| 3 | TÉCNICO | Gestión de subcontratistas + pagos (1.5) — Schema primero | 🔴 Alto | Alto |
| 4 | FINANCIERO | Dashboard flujo de caja (2.1) | 🔴 Alto | Medio |
| 5 | CRUZADO | Dashboard ejecutivo cruzado (3.1) | 🔴 Alto | Medio |
| 6 | FINANCIERO | Proyecciones de liquidez 90 días (2.4) | 🟡 Medio | Medio |
| 7 | TÉCNICO | Gantt interactivo (1.2) | 🟡 Medio | Medio |
| 8 | FINANCIERO | Alertas por bajo saldo (2.2) | 🟡 Medio | Bajo |
| 9 | FINANCIERO | Conciliación bancaria UI (2.3) | 🟡 Medio | Medio |
| 10 | FINANCIERO | Reporte ROI/IRR (2.5) | 🟡 Medio | Bajo |
| 11 | TÉCNICO | Galería de fotos (1.3) | 🟢 Bajo | Bajo |
| 12 | CRUZADO | Draw Package PDF (3.2) | 🟢 Bajo | Medio |
| 13 | CRUZADO | Digest semanal por email (3.3) | 🟢 Bajo | Bajo |
| 14 | FINANCIERO | Trinity PDF parser (2.6) | 🟡 Medio | Alto |
| 15 | CRUZADO | Scorecard contratistas (3.4) | 🟢 Bajo | Bajo |

---

## BLOQUE 5 — CHECKLIST ANTES DE CADA DEPLOY

- [ ] `npx tsc --noEmit` en `/backend` — cero errores
- [ ] `npx tsc --noEmit` en `/frontend` — cero errores
- [ ] `npx prisma validate` — schema válido
- [ ] Si hubo cambios en schema: `npx prisma db push` local con SQLite primero
- [ ] Build frontend: `npm run build` — sin warnings críticos
- [ ] Verificar que el `sed` de SQLite→PostgreSQL sigue activo en `startCommand` del `render.yaml`
- [ ] No separar `schema.prisma` bajo ninguna circunstancia
- [ ] Backup de producción antes de deploy con schema changes: `GET /api/backup`

---

## BLOQUE 6 — VARIABLES DE ENTORNO NUEVAS REQUERIDAS EN RENDER

```
ALERT_EMAIL_USER=jrestrepoavila88@gmail.com
ALERT_EMAIL_PASS=<Gmail App Password — generar en cuenta Google>
APP_URL=https://restrepoacosta.onrender.com
```

Para Gmail App Password: ir a Google Account → Security → 2-Step Verification → App Passwords → crear una para "Construction PM".

---

*Documento generado por Claude · Restrepo Acosta Global Holding LLC · Junio 2026*  
*Versión: 2.0 — Incorpora funcionalidades del documento original + mejoras adicionales propuestas*
