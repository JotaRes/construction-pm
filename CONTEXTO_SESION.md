# CONTEXTO DE SESIÓN — Construction PM
> Prompt de continuidad para nuevas sesiones de Claude. Copia y pega todo esto al inicio.

---

## PROYECTO

Sistema web full-stack para control de obra residencial que reemplaza un Excel maestro.
- **Repo GitHub:** `https://github.com/JotaRes/construction-pm` (branch `main`)
- **App en producción:** `https://restrepoacosta.onrender.com`
- **Render Service ID:** `srv-d7u040egvqtc73c182vg`
- **Render Dashboard:** `https://dashboard.render.com/web/srv-d7u040egvqtc73c182vg`
- **Carpeta local:** `/Users/juandavid/Desktop/CLAUDE/construction-pm/`

---

## STACK

```
backend/   → Node.js + Express + TypeScript + Prisma + PostgreSQL  (puerto 3001 local / 3000 prod)
frontend/  → React 18 + Vite + Tailwind dark + Zustand + TanStack Query (puerto 5173 local)
```

---

## PROYECTO ACTIVO — Lote 87

```
Dirección:  218 N Foxglove Rd, Westminster, SC 29693 (Chickasaw Point / Oconee County)
SPV:        Acosta Trust Homes, LLC
Permit:     BR26-000029 · Vence jul 27, 2026
Lender:     Hera Holdings LLC · Inspector: Trinity
Loan:       $500,000 · Rate 8.5% · Holdback $395,350
ARV:        $650,000 · 2,400 SF heated
Draws:      Draw #1 ($68,750) + Draw #2 ($67,914) = $136,664 wired
```

---

## ESTADO DEL DEPLOY (al cierre de sesión)

- **Último commit desplegado:** `e52ee65c` — "feat: backup endpoint + frontend rebuild with all fixes"
- **App:** ✅ LIVE — health check: `{"status":"ok"}`
- **Prisma:** usa `db push --accept-data-loss` (NO `migrate deploy`)
- **Base de datos:** PostgreSQL en Render (DATABASE_URL configurado en Render dashboard, `sync: false` en render.yaml)
- **Archivos:** Cloudinary (free tier, 25 GB permanentes)

---

## VARIABLES DE ENTORNO EN RENDER (todas configuradas)

| Variable | Valor / Nota |
|---|---|
| `DATABASE_URL` | PostgreSQL URL — configurado en Render dashboard (`sync: false`) |
| `PORT` | `3000` |
| `JWT_SECRET` | `construction-pm-secret-2026` |
| `APP_PASSWORD` | `18418598` |
| `NODE_ENV` | `production` |
| `CLOUDINARY_CLOUD_NAME` | `dmarzzf0f` (`sync: false`) |
| `CLOUDINARY_API_KEY` | `792694551972484` (`sync: false`) |
| `CLOUDINARY_API_SECRET` | configurado en Render dashboard (`sync: false`) |

---

## ARQUITECTURA DE ARCHIVOS CLAVE

```
backend/prisma/schema.prisma          → provider = "postgresql" (NO sqlite)
backend/prisma/migrations/
  migration_lock.toml                 → provider = "postgresql"
  20260514000000_init_postgresql/     → única migración PostgreSQL válida
backend/src/app.ts                    → sin express.static('/api/uploads') — removido
backend/src/lib/cloudinary.ts         → uploadToCloudinary, deleteFromCloudinary, extractPublicId
backend/src/routes/draws.ts           → memoryStorage + tryCloudinaryUpload (con safety wrapper)
backend/src/routes/providers.ts       → memoryStorage + uploadToCloudinary
backend/src/routes/itemDocuments.ts   → memoryStorage + uploadToCloudinary
backend/src/routes/budgetLines.ts     → memoryStorage solo (parseo, no persiste archivos)
render.yaml                           → en raíz del repo (NO en backend/)
```

---

## ALMACENAMIENTO CLOUDINARY

| Ruta del backend | Carpeta en Cloudinary |
|---|---|
| draws (PDFs de draws y docs) | `construction-pm/draw-pdfs` / `construction-pm/project-docs` |
| providers quotes | `construction-pm/provider-quotes` |
| item documents | `construction-pm/item-docs` |

**Cuenta Cloudinary:** `dmarzzf0f` (rayd_jd@hotmail.com)
**Dashboard:** `https://console.cloudinary.com`

---

## HISTORIAL DE COMMITS RELEVANTES

```
e52ee65c feat: backup endpoint + frontend rebuild with all fixes
58c81ec2 fix: HUD parser + auto-apply on upload
19b16449 fix: HUD parser extracts lot price + apply flows to execution items
b8e1a29d fix: make PDF parse routes work without Cloudinary credentials
dd320100 fix: remove dead disk-storage code from budgetLines.ts + add Cloudinary env vars
48bfbc85 feat: migrate file uploads from local disk to Cloudinary
8519331a fix: replace SQLite migrations with PostgreSQL-compatible migration
60bf7986 fix: render.yaml - use prisma db push for PostgreSQL, fix DATABASE_URL sync
cbe3b45f fix: change Prisma provider from sqlite to postgresql
```

---

## COMANDOS ESENCIALES

```bash
# Arrancar backend (watch mode)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npm run dev

# Arrancar frontend (terminal separada)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/frontend && npm run dev

# Reset completo de la base de datos local
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npm run db:reset

# Aplicar cambios de schema sin borrar datos
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npx prisma db push

# Verificar TypeScript sin errores
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Compilar TypeScript a dist/ (necesario antes de commit si cambias src/)
cd /Users/juandavid/Desktop/CLAUDE/construction-pm/backend && npx tsc

# Git push (siempre desde Mac vía AppleScript — sandbox no tiene credenciales GitHub)
# usar: mcp__Control_your_Mac__osascript con:
# do shell script "cd '/Users/juandavid/Desktop/CLAUDE/construction-pm' && git add -A && git commit -m 'mensaje' && git push origin main"
```

---

## REGLAS CRÍTICAS DEL PROYECTO

1. **TypeScript antes de commit:** siempre compilar con `npx tsc` después de cambiar `src/` y antes de hacer commit, para mantener `dist/` actualizado (Render usa `node dist/app.js`)
2. **Git push:** hacerlo vía `mcp__Control_your_Mac__osascript` → `do shell script "git push origin main"` — el sandbox Linux no tiene credenciales de GitHub
3. **Fórmulas financieras:** TODAS van en `frontend/src/lib/calculations.ts` — nunca inline en componentes
4. **PostgreSQL:** el schema usa `provider = "postgresql"`, la migración `migration_lock.toml` también. No tocar ni revertir a sqlite
5. **No `migrate deploy`:** el startCommand de Render usa `prisma db push --accept-data-loss`, no `migrate deploy`
6. **Chrome es read-only:** en Cowork, Chrome opera en tier "read" — no se puede hacer clic ni escribir en él. Para navegar URLs usar `mcp__Control_Chrome__open_url`. Para interacción en páginas web, la extensión "Claude in Chrome" debe estar conectada

---

## DISEÑO TAILWIND (dark mode)

```
bg-app:     #0F172A  (slate-950)
bg-card:    #1E293B  (slate-800)
bg-sidebar: slate-900
accent:     blue-600 / blue-400
ok:         emerald-400
warning:    amber-400
critical:   red-400
font-body:  Inter
font-mono:  JetBrains Mono
```

---

## PRÓXIMOS PASOS CONOCIDOS

- Deploy a producción estable (ya hecho con Render)
- Exportar PDF de draws para Hera Holdings
- Autenticación más robusta si se abre a internet
- Gantt visual de fases
- Adjuntar archivos reales directos desde la UI (ya funciona vía Cloudinary)
- Posible migración Railway.app si se necesita más control ($5/mes)
