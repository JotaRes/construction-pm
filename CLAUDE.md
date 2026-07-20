# CLAUDE.md — Guía para sesiones futuras

Este archivo está dirigido a Claude (o cualquier asistente AI) que retome trabajo sobre este repo. Para usuarios humanos, ver [README.md](./README.md).

## Qué es este repo

Monorepo con **dos módulos integrados** bajo un solo deploy en Render:

- **Módulo técnico** (`construction-pm` legacy) — control de obra residencial
- **Módulo financiero** — CFO digital para Restrepo Acosta Global Holding LLC

Producción: https://restrepoacosta.onrender.com · clave: env var `APP_PASSWORD` en Render (nunca en el repo).

## Arquitectura crítica que NO debes romper

### Un solo schema Prisma
`backend/prisma/schema.prisma` contiene los modelos de AMBOS módulos. Los modelos finance están prefijados con `Fin` (ej. `FinAccount`, `FinMovement`, `FinProject`) y mapeados a tablas SQL con prefijo `fin_` vía `@@map`.

**No vuelvas a separar finance.prisma.** El intento anterior causó que `prisma db push` de uno dropeara las tablas del otro (ambos schemas compartían DATABASE_URL). Casi se pierde el LOTE 87 en producción.

### Cliente Prisma único
- Tech accede a `prisma.project`, `prisma.partner`, `prisma.provider`, etc.
- Finance accede a `prisma.finProject`, `prisma.finPartner`, `prisma.finProvider`, etc. (camelCase del modelo)

### Routes con prefijos
- `/api/*` — módulo técnico (legacy paths)
- `/api/finance/*` — módulo financiero
- `/api/auth/*` — auth global (servido desde tech, compartido)
- `/api/backup` — backup global del sistema (datos de AMBOS módulos + código fuente)

### Frontend routing
- `/` — Landing con selector de módulos + botón de backup
- `/tech/*` — módulo técnico
- `/finance/*` — módulo financiero
- AuthGate global envuelve todo. Token compartido en `localStorage.pm_auth_token`.

### Render.yaml
- `autoDeploy: yes` — push a main dispara deploy automático
- `startCommand` usa **`prisma migrate deploy`** con fallback de baseline (`migrate resolve --applied 20260712000000_baseline`). **PROHIBIDO reintroducir `db push --accept-data-loss`** — eso puede borrar columnas y datos de producción sin aviso.
- `tsx src/app.ts` en runtime — no compilamos a `dist/`.
- Los secretos (`JWT_SECRET`, `APP_PASSWORD`, `WIPE_PASSWORD`) son `sync: false` — valores SOLO en el dashboard de Render, nunca en el repo.

## DB local vs producción (desde julio 2026)

| Entorno | Provider | DATABASE_URL |
|---|---|---|
| Local | `postgresql` | `postgresql://postgres:postgres@localhost:5432/restrepoacosta` (Docker: `docker compose up -d`) |
| Render | `postgresql` | Postgres URL provista por Render |

**El provider es postgresql FIJO en ambos entornos.** El hook pre-commit y el job `guard-schema` del CI bloquean cualquier commit/push con provider sqlite. El viejo `dev.db` de SQLite quedó obsoleto.

### Cambios de schema (flujo obligatorio)
1. Editar `schema.prisma`
2. `./scripts/new-migration.sh nombre_del_cambio` (desde `backend/`)
3. **Revisar el SQL generado** — si contiene `DROP`, confirmar que es intencional
4. Commit de schema + migración juntos. Render aplica con `migrate deploy` en el próximo deploy.

## Automatización activa (GitHub Actions)

- `.github/workflows/ci.yml` — cada push: guard de schema/secretos + typecheck backend + build frontend
- `.github/workflows/backup.yml` — backup diario 06:00 UTC como artifact (90 días retención). Requiere secret `APP_PASSWORD` en GitHub.
- `.git/hooks/pre-commit` (local) — bloquea commits con provider sqlite o credenciales conocidas

## Presupuesto & Ejecución UNIFICADOS (desde julio 2026)

- La página `Budget.tsx` ya NO está en la navegación: `/tech/budget` redirige a `/tech/execution`.
  `Execution.tsx` es la sección unificada — columna `Presup. ✏` editable inline. No re-separar.
- **Asociación actividad ↔ Construction Budget**: `Item.budgetLineId → BudgetLine` (SetNull).
  La columna `Desv.` y las alertas se miden contra `budgetLine.valorInicial` cuando hay
  asociación; contra `valorPresupuestado` (manual) cuando no. Los KPIs "Desv. vs budget"
  agrupan POR LÍNEA (el presupuesto de una línea cuenta una vez aunque varias actividades
  apunten a ella) — mantener esa lógica en cualquier cálculo nuevo.
- `Phase.name` es renombrable vía `PATCH /projects/:id/phases/:phaseId` (campo `name`).
- `SubActivity` tiene control administrativo: `fecha`, `responsable`, `observaciones`,
  `invoiceUrl/invoiceName` (upload en `POST /subactivities/:id/invoice`, Cloudinary).
- **Excel técnico re-importable**: `buildTechExcel` incrusta el snapshot JSON completo en la
  hoja oculta `_RESTORE` (troceado a 30k chars/celda). `POST /api/backup/restore-tech` acepta
  `.xlsx` además de `.json/.zip` leyéndola con `readRestoreSnapshotFromXlsx`. Si tocas el
  snapshot, NO rompas este círculo: el Excel debe seguir restaurando con fidelidad total.
- En el restore, las **budgetLines se crean ANTES que los items** (FK `budgetLineId`) y las
  subactividades se extraen del item anidado y se crean por separado. No revertir ese orden.
- `Draws.tsx` tiene el **Chequeo Pre-Draw** (`PreDrawCheck`): avance físico vs % girado,
  facturas faltantes, sobrecosto vs budget asociado, invoices de subactividades.
- Alertas relacionadas en `routes/alerts.ts`: `budget-link-overrun` y
  `subactivity-missing-invoices`.

## Identidad visual FIJA (desde julio 2026 — validada con el logo corporativo)

Paleta oficial (única fuente: bloque de tokens en `frontend/src/index.css`):
- **Petróleo** `#33495C` (torres del logo) · acento interactivo `#3E5A70` · hover `#4A6880`
- **Oro** `#C6952F` (arco del logo; `#D9AE52` sobre fondos oscuros) — SOLO firma de marca:
  arco del logo, regla del page-head, icono activo del sidebar. Nunca botones ni masas.
- **Marfil** `#F4F1EB` fondo general · superficies blancas · tinta `#1D1D1F`
- Semánticos: ok `#1D9A57` · warn `#C9820B` · err `#D93025`
- Tipografía: stack del sistema (SF Pro). PROHIBIDO: serifas, morados/violetas,
  gradientes decorativos, naranjas terracota.
- El logo (torres + arco) vive como SVG en Splash, Landing (`RALogoMark`), Layout
  técnico, `RAMark` (finance) y ModuleGate — si se cambia, cambiar en los cinco.
- NO reintroducir azul Apple #0071E3: fue reemplazado por decisión del usuario.

## Módulo Administrativo v1.0 (desde julio 2026)

- **Sin "Asistente"**: el botón flotante AssistantButton fue RETIRADO por decisión del
  usuario (era solo un buscador de navegación, no IA). No reintroducirlo.
- **Socios y colaboradores** (`/admin/persons`): modelos `AdmPerson`,
  `AdmPersonRequirement` (checklist con categorías LIBRES por persona) y
  `AdmPersonDocument` (Cloudinary, carpeta `admin-corporate/persons/:id`).
  Al crear una persona se siembra un checklist inicial editable
  (identidad/migratorio/fiscal/personal). El cumplimiento se DERIVA
  (`computePersonCompliance`) — nunca se almacena estado.
- **Documentos requeridos personalizables por empresa**: además del due diligence
  preestablecido, `AdminAPI.addCompanyRequirement` crea un `AdmDocType` con code
  `CUSTOM_*` + categoría libre y lo exige a la empresa vía `AdmRequirement`.
  Quitar un requisito usa `required: false` (upsert) y NO borra archivos.
- **Tareas**: `AdmTask.personId` (Cascade) además de `companyId`. Alta rápida
  inline en CompanyDetail y PersonDetail. `GET /api/admin/tasks/summary`
  alimenta los badges del sidebar (pendientes/vencidas — rojo pulsante si hay
  vencidas; alertas críticas+altas en el ítem Alertas).
- **Alertas** incluyen ahora: docs de personas (PERSONA_DOC_*), tareas vencidas
  y tareas PRÓXIMAS a vencer (ventana 7 días, `TASK_DUE_SOON_DAYS`).
- En rutas de persons.ts las rutas con prefijo fijo (/requirements/*, /documents/*)
  van ANTES que las paramétricas (/:id) — no reordenar.
- El backup global incluye persons/personRequirements/personDocuments (JSON) y
  sus binarios (`collectPersonTargets`, carpeta files/administrativo/socios/).

## Engranaje entre módulos v1.1 (desde julio 2026)

- **FinMovement ↔ obra**: un EGRESO puede asociarse a una actividad técnica
  (`FinMovement.techItemId → Item`, cascada proyecto→fase→actividad en el
  formulario). El backend crea una **SubActivity espejo** (`techSubActivityId`,
  descripción con prefijo `[FIN]`) vía `finance/services/techSync.ts`:
  crear/editar/eliminar el movimiento crea/actualiza/elimina el espejo y
  recalcula `Item.valorEjecutado` con `recomputeItemExecuted`. NUNCA tocar
  subactividades manuales; el espejo es solo el id guardado en el movimiento.
  Endpoints árbol: `GET /api/finance/movements/tech-projects` y
  `/tech-tree/:projectId` (definidos ANTES de `/:id` — no reordenar).
- **Project (técnico) ↔ AdmCompany**: `Project.admCompanyId` (SetNull).
  Asignación desde CompanyDetail (`POST /api/admin/companies/:id/assign-project`
  y `/unassign-project`; lista en `GET /:id/projects` con avance y carga).
  Las propiedades financieras de la empresa se DERIVAN del SPV vinculado
  (FinProject.spvId) — no se almacena doble.
- **Alertas técnicas de presupuesto en dos niveles** (`routes/alerts.ts`):
  `activity-budget-overrun` por actividad (siempre que su casilla esté
  diligenciada) y `phase-budget-overrun` SOLO cuando TODAS las actividades
  habilitadas (no N/A) de la fase tienen presupuesto > 0. La alerta global
  `budget-deviation` se calcula únicamente sobre fases completas.
- **OCR robusto** (`lib/pdfOcr.ts`): límite subido a 20MB (el auto-split del
  frontend genera partes de ~9.3MB que antes se saltaban el OCR), 12 páginas,
  timeout por página, heurística de densidad (<120 chars útiles/página =
  escaneado) y `force`. `files.ts` reintenta con OCR forzado si el parseo no
  encontró NINGÚN campo sin haber usado OCR. No bajar estos límites sin medir
  memoria en Render (512MB).
- **Organigrama**: colores POR ROL dentro de la paleta fija (nada de morados),
  leyenda de roles, proyectos/propiedades y alertas visibles por tarjeta.

## Pendientes conocidos / Ideas

- Bundle frontend > 500KB → considerar code-split de Recharts via dynamic import
- Importador de Excel del módulo financiero acepta el archivo "DOC FINANCIERO 2025-2026.xlsx" del usuario
- Cloudinary env vars deben estar configuradas en Render para upload de PDFs

## Reglas de oro

1. **Antes de tocar el schema Prisma**, verifica que no estás re-separando los modelos finance.
2. **NUNCA usar `prisma db push` contra producción.** Los cambios de schema van SIEMPRE por migración versionada (ver flujo arriba). `--accept-data-loss` está prohibido en cualquier entorno con datos reales.
3. **Antes de pushear a main**, verifica `npx tsc --noEmit` limpio en backend y frontend (el CI también lo verifica, pero Render deploya en paralelo — no esperes al CI para enterarte).
4. **Cuando agregues un modelo nuevo al módulo financiero**: prefijo `Fin`, `@@map("fin_xxx")`, y actualizar `routes/backup.ts` para incluirlo en el ZIP.
5. **NUNCA instanciar `new PrismaClient()` en rutas o servicios.** Importar el singleton: `import { prisma } from '../lib/prisma'`. Múltiples clientes agotan las conexiones del Postgres de Render.
6. **NUNCA escribir contraseñas o secretos en código, docs o render.yaml.** Local: `backend/.env` (gitignored). Producción: Render → Environment. El pre-commit hook y el CI lo bloquean.
7. **Endpoints de escritura nuevos llevan validación Zod** (ver `finance/lib/validate.ts` como patrón).
