# Checklist Go-Live — Blindaje Fase 0

## ✅ COMPLETADO EL 12 JULIO 2026

Todos los pasos ejecutados y verificados: variables en Render configuradas, secretos rotados, deploy en producción (commits bb005362 + 69e7fbd), CI en verde, secret en GitHub, y primer backup automático exitoso (Actions → Backup diario #1). Este documento queda como registro histórico.

## Paso 1 — Render dashboard (obligatorio ANTES del push)

Ir a https://dashboard.render.com → servicio **restrepoacosta** → **Environment** y configurar:

| Variable | Valor |
|---|---|
| `JWT_SECRET` | (valor nuevo que te di en el chat — 64 caracteres hex) |
| `APP_PASSWORD` | (tu nueva clave de acceso — te propuse una en el chat, puedes elegir otra) |
| `WIPE_PASSWORD` | (clave nueva SOLO para restore/wipe — distinta a la de acceso) |

Guardar. Render NO redeploya todavía (no hay push).

## Paso 2 — GitHub (para el backup automático diario)

Repo en GitHub → **Settings → Secrets and variables → Actions → New repository secret**:
- Nombre: `APP_PASSWORD`
- Valor: el mismo que pusiste en Render en el paso 1.

## Paso 3 — Push (avísame y lo hago, o hazlo tú)

```
git push origin main
```

## Paso 4 — Verificación post-deploy (5 min)

1. En Render → Logs debe verse: `Prisma migrate deploy` → `Baseline: BD existente sin historial — resolviendo` (solo la primera vez) → `Starting app`.
2. Entrar a https://restrepoacosta.onrender.com con la **clave NUEVA** (la vieja ya no existe en ninguna parte).
3. Verificar que el LOTE 87 y los movimientos financieros están intactos (la migración baseline NO toca datos — solo registra el historial).
4. En GitHub → Actions: el workflow **CI** debe estar en verde. Correr **Backup diario** manualmente una vez (Run workflow) y confirmar que genera el artifact.

## Qué cambia en el uso diario

- La clave de acceso es la nueva `APP_PASSWORD` — comunicársela a Oscar.
- Los backups se hacen solos cada día a la 1–2 am (hora SC) y quedan 90 días en GitHub → Actions → artifacts.
- Cada push a main pasa por CI (typecheck + guards). Si sale ❌ en GitHub, revisar antes de confiar en ese deploy.
- Cambios de schema: SIEMPRE con `./scripts/new-migration.sh nombre` (ver CLAUDE.md). `db push` quedó prohibido.
- Cuando quieras desarrollo local: instalar Docker Desktop → `docker compose up -d` → listo (backend/.env ya apunta al Postgres local).

## Pendiente (siguiente sesión — Fase 1)

Interconexión de módulos sobre esta base blindada: vínculo Project↔FinProject, Draw WIRED → ingreso automático en finance, sync commitment→FinLoan, drift físico vs financiero.
