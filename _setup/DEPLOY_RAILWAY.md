# Publicar Construction PM en Railway
## (Acceso desde cualquier dispositivo, dominio propio opcional)

Railway.app es la forma más simple de publicar. Costo: ~$5/mes.
URL final ejemplo: `https://construction-pm-production.up.railway.app`

---

## PASO 1 — Preparar el código en GitHub

1. Ve a https://github.com/new y crea un repositorio privado llamado `construction-pm`
2. En la terminal, desde la carpeta del proyecto:

```bash
cd ~/Desktop/CLAUDE/construction-pm
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/construction-pm.git
git push -u origin main
```

---

## PASO 2 — Crear cuenta en Railway

1. Ve a https://railway.app
2. Regístrate con GitHub (así se conecta directo)

---

## PASO 3 — Crear proyecto Backend en Railway

1. Nuevo proyecto → "Deploy from GitHub repo"
2. Selecciona `construction-pm`
3. En **Root Directory** escribe: `backend`
4. Railway detecta automáticamente Node.js

**Variables de entorno (Settings → Variables):**
```
APP_PASSWORD    = TuContraseñaSegura2026
JWT_SECRET      = restrepo-acosta-secret-produccion
DATABASE_URL    = file:./dev.db
PORT            = 3001
NODE_ENV        = production
```

5. En **Settings → Start Command** escribe:
```
npx prisma db push && npx prisma db seed && node dist/app.js
```

6. En **Settings → Build Command** escribe:
```
npm install && npx prisma generate && npx tsc
```

> ⚠️ SQLite en Railway NO persiste si el servidor se reinicia.
> Para producción real, cambiar a PostgreSQL (Railway lo ofrece gratis).
> Pídele a Claude que haga la migración SQLite → PostgreSQL cuando estés listo.

---

## PASO 4 — Crear proyecto Frontend en Railway

1. Nuevo servicio en el mismo proyecto Railway → "Deploy from GitHub repo"
2. Selecciona `construction-pm`
3. En **Root Directory** escribe: `frontend`

**Variables de entorno:**
```
VITE_API_URL = https://TU-BACKEND.up.railway.app
```

4. **Build Command:**
```
npm install && npm run build
```

5. **Start Command:**
```
npx serve dist -p 5173
```

(instala serve: agrega `"serve": "latest"` a dependencies del frontend)

---

## PASO 5 — Conectar frontend con backend

En `frontend/src/lib/api.ts`, la URL base debe leer la variable de entorno:

```typescript
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
```

Pídele a Claude Code que haga este cambio cuando vayas a deployar.

---

## PASO 6 — Dominio propio (opcional)

En Railway → Settings → Networking → Custom Domain:
Escribe tu dominio (ej. `pm.restrepo-acosta.com`) y apunta el DNS.

---

## Alternativas más simples

| Opción | Costo | Ventaja |
|--------|-------|---------|
| **Railway** | ~$5/mes | Todo en uno, fácil |
| **Render.com** | Gratis tier | Free tier (se duerme) |
| **Fly.io** | ~$3/mes | Más control |
| **VPS DigitalOcean** | $6/mes | Control total |

---

## Resumen rápido

```
GitHub → Railway → Backend (puerto 3001) + Frontend (puerto 5173/80)
                ↗
        Variables .env en Railway (no en el código)
```
