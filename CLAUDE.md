# CLAUDE.md — Guía para sesiones futuras

Este archivo está dirigido a Claude (o cualquier asistente AI) que retome trabajo sobre este repo. Para usuarios humanos, ver [README.md](./README.md).

## Qué es este repo

Monorepo con **dos módulos integrados** bajo un solo deploy en Render:

- **Módulo técnico** (`construction-pm` legacy) — control de obra residencial
- **Módulo financiero** — CFO digital para Restrepo Acosta Global Holding LLC

Producción: https://restrepoacosta.onrender.com · clave `18418598`.

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
- El `sed` para `provider sqlite→postgresql` corre en `startCommand`, no en `buildCommand` (Render resetea source files entre fases, solo persisten artifacts).
- `tsx src/app.ts` en runtime — no compilamos a `dist/`.

## DB local vs producción

| Entorno | Provider | DATABASE_URL |
|---|---|---|
| Local | `sqlite` | `file:./dev.db` (un solo archivo con todas las tablas) |
| Render | `postgresql` | Postgres URL provista por Render (sed cambia provider en startup) |

## Pendientes conocidos / Ideas

- Bundle frontend > 500KB → considerar code-split de Recharts via dynamic import
- Importador de Excel del módulo financiero acepta el archivo "DOC FINANCIERO 2025-2026.xlsx" del usuario
- Cloudinary env vars deben estar configuradas en Render para upload de PDFs

## Reglas de oro

1. **Antes de tocar el schema Prisma**, verifica que no estás re-separando los modelos finance.
2. **Antes de hacer `prisma db push --accept-data-loss` localmente**, asegúrate que las tablas tech existen.
3. **Antes de pushear a main**, verifica `npx tsc --noEmit` limpio en backend y frontend.
4. **Cuando agregues un modelo nuevo al módulo financiero**: prefijo `Fin`, `@@map("fin_xxx")`, y actualizar `routes/backup.ts` para incluirlo en el ZIP.
