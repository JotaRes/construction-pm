# Construction PM — CLAUDE.md
Sistema web full-stack que reemplaza el MASTER_CHECKLIST_V11.xlsx para control de obra residencial.
Cliente: Restrepo Acosta Global Holding LLC · Usuario: Juan David Restrepo (50% partner)

## Ubicación
```
/Users/juandavid/Desktop/CLAUDE/construction-pm/
├── backend/   → Node.js + Express + TypeScript + Prisma + SQLite (:3001)
└── frontend/  → React 18 + Vite + Tailwind dark + Zustand + TanStack Query (:5173)
```

## Comandos esenciales
```bash
# Arrancar backend (watch mode)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npm run dev

# Arrancar frontend (terminal separada)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/frontend && npm run dev

# Reset completo de la base de datos (borra todo y re-seedea Lote 87)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npm run db:reset

# Aplicar cambios de schema sin borrar datos
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npx prisma db push

# Verificar TypeScript
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

## Base de datos — Modelos Prisma (SQLite)
```
Project       → configuración completa del proyecto (financiero, legal, constructivo)
Phase         → 20 fases (F00–F19) por proyecto, cascade delete
Item          → ~204 ítems por proyecto (valorPresupuestado + valorEjecutado), cascade
Draw          → 8 draws por proyecto (EMPTY/PENDING/WIRED), cascade
Partner       → socios con % participación, cascade
Provider      → contratistas y proveedores, cascade
Note          → notas libres por proyecto, cascade
ProjectFile   → referencias a archivos (URL), cascade
Inspection    → 16 inspecciones por proyecto (condado + HOA), cascade
Task          → tareas manuales por proyecto (prioridad LOW/NORMAL/HIGH/URGENT), cascade
```

## API REST — Endpoints principales
```
GET    /api/projects                         → lista todos los proyectos (incluye draws)
POST   /api/projects                         → crea proyecto NUEVO con 20 fases + 204 ítems + 8 draws + 16 inspecciones desde template
GET    /api/projects/:id                     → proyecto completo con todas las relaciones
GET    /api/projects/:id/dashboard           → KPIs calculados (avance, UPB, intereses, $/SF, ganancia)
PATCH  /api/projects/:id                     → actualiza campos del proyecto
DELETE /api/projects/:id                     → elimina proyecto y TODOS sus datos (cascade)

GET    /api/projects/:id/phases              → fases con sus ítems (para Ejecución y Presupuesto)
PATCH  /api/items/:id                        → actualiza un ítem (valorPresupuestado, valorEjecutado, estado, completado, etc.)

GET    /api/projects/:id/draws               → lista draws
PATCH  /api/draws/:id                        → actualiza draw

GET    /api/projects/:id/inspections         → lista inspecciones
PATCH  /api/projects/:id/inspections/:id     → actualiza inspección

GET    /api/projects/:id/tasks               → lista tareas ordenadas por prioridad/done
POST   /api/projects/:id/tasks               → crea tarea
PATCH  /api/projects/:id/tasks/:id           → actualiza tarea
DELETE /api/projects/:id/tasks/:id           → elimina tarea

GET    /api/projects/:id/alerts              → 5 alertas automáticas calculadas en tiempo real
GET    /api/projects/:id/providers           → proveedores
POST   /api/projects/:id/providers           → agrega proveedor
GET    /api/projects/:id/notes               → notas
POST   /api/projects/:id/notes               → crea nota
```

## Frontend — Páginas (React Router)
```
/projects     → lista de proyectos con tarjetas; modal "Nuevo proyecto"; delete con confirmación
/dashboard    → KPIs, avance por fase, inspecciones pendientes, historial draws
/execution    → 204 ítems en 20 fases colapsables; dots de estado; side panel por ítem
/budget       → presupuesto editable por ítem (valorPresupuestado); baseline para Ejecución
/draws        → 8 tarjetas de draw con fechas, montos, estado
/inspections  → tabla de 16 inspecciones con resultado y estado
/financial    → modelo financiero: préstamo, UPB, interés acumulado, ganancia bruta, ROI
/alerts       → 5 alertas automáticas (permit, budget, físico vs tiempo, holdback, $/SF)
/tasks        → cuadro de tareas manuales por proyecto (CRUD, prioridades, fechas límite)
/providers    → directorio de contratistas
/notes        → notas libres
/files        → referencias a documentos
```

## Estado de datos — Lote 87 (proyecto principal)
```
Dirección:     218 N Foxglove Rd, Westminster, SC 29693 (Chickasaw Point / Oconee County)
SPV:           Acosta Trust Homes, LLC
Permit:        BR26-000029 · Vence jul 27, 2026
Lender:        Hera Holdings LLC · Inspector: Trinity
Loan:          $500,000 · Rate 8.5% · Holdback $395,350
ARV:           $650,000 · 2,400 SF heated
Draws wired:   Draw #1 ($68,750) + Draw #2 ($67,914) = $136,664
Fases:         20 fases · 204 ítems · 16 inspecciones
```

## Arquitectura de store y datos
```typescript
// Zustand store — proyecto activo global
useProjectStore → { activeProjectId, setActiveProjectId }

// TanStack Query — cache de datos por proyecto
['projects']           → lista general
['phases', projectId]  → fuente compartida de Budget y Execution (mismo endpoint)
['tasks', projectId]   → tareas del proyecto activo
['alerts', projectId]  → alertas (refetch cada 60s)

// Regla crítica TanStack v5: NO usar onSuccess en useQuery.
// Usar useEffect para efectos post-query.
```

## Archivos clave
```
backend/prisma/schema.prisma          → schema completo (10 modelos)
backend/prisma/seed.ts                → seed completo de Lote 87
backend/src/data/phasesTemplate.ts    → PHASES_TEMPLATE + INSPECTIONS_TEMPLATE (usado por POST /projects)
backend/src/routes/projects.ts        → incluye POST (crea desde template) y DELETE (cascade)
backend/src/routes/tasks.ts           → CRUD completo de tareas
frontend/src/lib/api.ts               → todos los clientes API axios
frontend/src/lib/types.ts             → interfaces TypeScript completas
frontend/src/lib/calculations.ts      → TODAS las fórmulas financieras aquí (regla de proyecto)
frontend/src/components/layout/Layout.tsx → sidebar con project switcher dropdown + badges alertas/tareas
```

## Reglas de diseño (Tailwind dark)
```
bg-app:     #0F172A  (slate-950)
bg-card:    #1E293B  (slate-800)
bg-sidebar: slate-900
accent:     blue-600 / blue-400
ok:         emerald-400
warning:    amber-400
critical:   red-400
font-body:  Inter
font-mono:  JetBrains Mono (font-mono)
```

## Próximos pasos conocidos / Ideas pendientes
- Deploy a producción (ver sección de deployment en este mismo documento)
- Autenticación básica (si se abre a internet)
- Exportar PDF de draws para Hera Holdings
- Gantt visual de fases
- Adjuntar archivos reales (S3 o Cloudflare R2)

## Deployment a producción
Ver respuesta detallada en el chat del 2026-05-04. Opciones:
1. Railway.app (recomendado) — $5/mes, deploy desde GitHub
2. DigitalOcean Droplet — $6/mes, control total, requiere más configuración
3. Fly.io — free tier disponible
Requiere: separar SQLite → PostgreSQL (o usar Turso/LibSQL para SQLite en la nube)
