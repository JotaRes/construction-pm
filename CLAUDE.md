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
