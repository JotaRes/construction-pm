# Construction PM — Contexto para nueva sesión Claude

Pega este archivo completo al inicio de una nueva conversación con Claude Code
para que tenga todo el contexto del proyecto sin necesidad de re-explorar.

---

## ¿Qué es este proyecto?

Sistema web full-stack de gestión de obra residencial que reemplaza el Excel
MASTER_CHECKLIST. Desarrollado para Restrepo Acosta Global Holdings LLC.

**Proyecto activo en BD:** Lote 87 — 218 N Foxglove Rd, Westminster SC 29693
**SPV:** Acosta Trust Homes, LLC | **Lender:** Hera Holdings LLC
**Loan:** $500,000 @ 8.5% | **ARV:** $650,000 | **SF:** 2,400 heated
**Permit:** BR26-000029 (vence jul 27 2026)
**Draws wired:** Draw #1 $68,750 + Draw #2 $67,914 = $136,664

---

## Ubicación en disco

```
~/Desktop/CLAUDE/construction-pm/
├── backend/          Node.js + Express + TypeScript + Prisma + SQLite
├── frontend/         React 18 + Vite + Tailwind + TanStack Query + Zustand
└── _setup/           Scripts de arranque y deploy
```

---

## Cómo arrancar

```bash
# Terminal 1 — Backend (puerto 3001)
cd ~/Desktop/CLAUDE/construction-pm/backend && npm run dev

# Terminal 2 — Frontend (puerto 5173)
cd ~/Desktop/CLAUDE/construction-pm/frontend && npm run dev

# O ejecutar el script que abre ambos automáticamente:
bash ~/Desktop/CLAUDE/construction-pm/_setup/INICIO_LOCAL.sh
```

---

## Stack técnico

| Capa       | Tecnología |
|------------|-----------|
| Backend    | Node.js + Express + TypeScript |
| ORM        | Prisma 5 + SQLite (dev.db) |
| Frontend   | React 18 + Vite + TypeScript |
| Estilos    | Tailwind CSS v3 |
| Estado     | Zustand (proyecto activo global) |
| Datos      | TanStack Query v5 (NO usar onSuccess en useQuery — usar useEffect) |
| HTTP       | Axios |
| Auth       | Token HMAC-SHA256 en localStorage, contraseña en backend/.env |
| Uploads    | multer → /backend/uploads/ |
| PDF parse  | pdf-parse (CommonJS — usar require(), no import) |

---

## Paleta de marca

```
Teal primario:  #2D4B52   (sidebar, headings)
Gold acento:    #C8922A   (botones, estados activos, tops KPI)
Cream fondo:    #EAE5DF   (background app)
Tarjetas:       #FFFFFF
```

---

## Base de datos — Modelos Prisma

```
Project        configuración completa (financiero, legal, constructivo)
Phase          20 fases F00–F19 por proyecto (cascade delete)
Item           ~204 ítems por proyecto (valorPresupuestado + valorEjecutado)
ItemDocument   documentos adjuntos por ítem (cotización, factura, otro)
Draw           8 draws por proyecto (EMPTY / PENDING / WIRED)
BudgetLine     118 líneas del presupuesto maestro de construcción
Partner        socios con % participación
Provider       contratistas y proveedores
Note           notas libres por proyecto
ProjectFile    referencias a archivos (URL)
Inspection     16 inspecciones por proyecto (condado + HOA)
Task           tareas manuales (LOW / NORMAL / HIGH / URGENT)
PriceRef       catálogo global de precios de referencia
```

---

## API REST — Endpoints

```
POST   /api/auth/login                       → login con contraseña, devuelve token
GET    /api/auth/verify                      → verifica token (header: Bearer <token>)

GET    /api/projects                         → lista proyectos
POST   /api/projects                         → crea proyecto (seed 20 fases + 204 ítems + 8 draws + 16 inspecciones)
GET    /api/projects/:id                     → proyecto completo
GET    /api/projects/:id/dashboard           → KPIs calculados
PATCH  /api/projects/:id                     → actualiza proyecto
DELETE /api/projects/:id                     → elimina con cascade total

GET    /api/projects/:id/phases              → fases + ítems (usado por Ejecución y Presupuesto)
PATCH  /api/items/:id                        → actualiza ítem
GET    /api/items/:itemId/documents          → documentos del ítem
POST   /api/items/:itemId/documents          → sube archivo (multipart/form-data)
DELETE /api/items/:itemId/documents/:docId   → elimina documento

GET    /api/projects/:id/draws               → lista draws
PATCH  /api/draws/:id                        → actualiza draw
POST   /api/projects/:id/draws/parse-pdf     → extrae datos de PDF Trinity draw
POST   /api/projects/:id/docs/parse-pdf      → extrae datos de PDF HUD-1

GET    /api/projects/:id/inspections         → inspecciones
PATCH  /api/projects/:id/inspections/:id     → actualiza inspección

GET    /api/projects/:id/tasks               → tareas
POST   /api/projects/:id/tasks               → crea tarea
PATCH  /api/projects/:id/tasks/:id           → actualiza tarea
DELETE /api/projects/:id/tasks/:id           → elimina tarea

GET    /api/projects/:id/alerts              → 5 alertas automáticas en tiempo real
GET    /api/projects/:id/providers           → proveedores
POST   /api/projects/:id/providers           → agrega proveedor
GET    /api/projects/:id/notes               → notas
POST   /api/projects/:id/notes               → crea nota
GET    /api/projects/:id/budget-lines        → 118 líneas del budget maestro
PATCH  /api/projects/:id/budget-lines/:id    → actualiza línea

GET    /api/price-refs                       → catálogo global de precios
POST   /api/price-refs                       → agrega precio
PATCH  /api/price-refs/:id                   → actualiza precio
DELETE /api/price-refs/:id                   → elimina precio

GET    /api/uploads/...                      → archivos estáticos (PDFs, docs adjuntos)
```

---

## Frontend — Páginas y rutas

```
/projects           Lista de proyectos con tarjetas; modal Nuevo proyecto; delete
/dashboard          KPIs (8 tarjetas), avance por fase, inspecciones, draws recientes
/execution          204 ítems en 20 fases colapsables; adjuntar cotización/factura por ítem
/budget             Presupuesto editable por ítem (valorPresupuestado)
/construction-budget 118 líneas del budget maestro de construcción (desde Excel)
/draws              8 draws con carga automática desde PDF Trinity + campos editables
/inspections        16 inspecciones con resultado y estado
/financial          Modelo financiero: UPB, intereses, ganancia, ROI
/alerts             5 alertas automáticas (permit, budget, físico vs tiempo, holdback, $/SF)
/tasks              Tablero de tareas manuales por proyecto (CRUD, prioridades)
/providers          Directorio de contratistas
/notes              Notas libres
/files              Referencias a documentos
/price-refs         Catálogo global de precios de referencia por categoría
```

---

## Archivos clave

```
backend/prisma/schema.prisma             → todos los modelos (13)
backend/prisma/seed.ts                   → seed completo de Lote 87
backend/src/data/phasesTemplate.ts       → plantilla 20 fases + 204 ítems + 16 inspecciones
backend/src/data/budgetLinesTemplate.ts  → 118 líneas del presupuesto maestro
backend/src/app.ts                       → entry point Express (registra todas las rutas)
backend/src/routes/auth.ts               → login / verify (HMAC token)
backend/.env                             → APP_PASSWORD, JWT_SECRET, DATABASE_URL, PORT

frontend/src/App.tsx                     → Router + AuthGate wrapping toda la app
frontend/src/components/AuthGate.tsx     → pantalla de login + lógica de auth
frontend/src/components/layout/Layout.tsx → sidebar brand teal + nav + logout
frontend/src/lib/api.ts                  → todos los clientes Axios
frontend/src/lib/types.ts                → interfaces TypeScript completas
frontend/src/lib/calculations.ts         → TODAS las fórmulas financieras (regla: solo aquí)
frontend/src/store/projectStore.ts       → Zustand: activeProjectId global
frontend/src/index.css                   → design system completo (brand tokens, componentes)
```

---

## Reglas importantes del proyecto

1. **TanStack Query v5**: NO usar `onSuccess` en `useQuery`. Usar `useEffect` para efectos post-query.
2. **pdf-parse**: Es CommonJS. Usar `require()` no `import`. Declarar así:
   ```typescript
   const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{text: string; numpages: number}>
   ```
3. **Fórmulas financieras**: Todas en `frontend/src/lib/calculations.ts`. No duplicar en componentes.
4. **Nuevo proyecto**: El POST /api/projects siempre debe seedear desde las plantillas (phases, items, inspections, draws, budget lines).
5. **Colores**: Usar las variables CSS `var(--brand-teal)`, `var(--brand-gold)`, `var(--brand-cream)` o las clases Tailwind `bg-[#2D4B52]`, `bg-[#C8922A]`.

---

## Comandos útiles

```bash
# Reset total de la base de datos (borra todo y re-seedea Lote 87)
cd ~/Desktop/CLAUDE/construction-pm/backend && npm run db:reset

# Aplicar cambios de schema sin borrar datos
cd ~/Desktop/CLAUDE/construction-pm/backend && npx prisma db push

# Ver la base de datos en el navegador
cd ~/Desktop/CLAUDE/construction-pm/backend && npx prisma studio

# TypeScript check backend
cd ~/Desktop/CLAUDE/construction-pm/backend && npx tsc --noEmit

# TypeScript check frontend
cd ~/Desktop/CLAUDE/construction-pm/frontend && npx tsc --noEmit

# Cambiar contraseña de acceso
# Editar: ~/Desktop/CLAUDE/construction-pm/backend/.env
# Línea:  APP_PASSWORD="NuevaContraseña"
```

---

## Estado actual del sistema (Mayo 2026)

- Auth con pantalla de login (contraseña en .env → APP_PASSWORD)
- Multi-proyecto: crear, cambiar y eliminar proyectos
- Dashboard con 8 KPIs clicables + avance por fase
- Ejecución: 204 ítems en 20 fases, adjuntar cotizaciones y facturas por ítem
- Presupuesto editable por ítem
- Construction Budget: 118 líneas del presupuesto maestro
- Draws: carga automática desde PDF Trinity + edición manual
- Inspecciones: 16 por proyecto, seguimiento de resultado
- Financiero: modelo UPB, intereses, ganancia, ROI
- Alertas automáticas: 5 indicadores en tiempo real
- Tareas manuales: tablero con prioridades y fechas
- Precios de referencia: catálogo global por categoría
- Proveedores, notas, archivos por proyecto
- Diseño con identidad visual Restrepo Acosta (teal + gold + cream)
