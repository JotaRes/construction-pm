# Restrepo Acosta — Ecosistema operativo

Sistema web full-stack que integra dos módulos bajo una sola URL, una sola clave y un solo deploy:

- **Módulo Técnico** — control de obra residencial (proyectos, fases, ejecución, draws, inspecciones, alertas, proveedores)
- **Módulo Financiero** — CFO digital (movimientos, capital, deuda, conciliación bancaria, reportes)

**Producción:** https://restrepoacosta.onrender.com
**Clave de acceso:** `18418598` (válida para acceder al sistema y a ambos módulos)

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node 20 · Express · TypeScript · Prisma · PostgreSQL (prod) / SQLite (dev) |
| Frontend | React 18 · Vite · Tailwind CSS · TanStack Query · Zustand · React Router |
| Auth | HMAC-SHA256 · token compartido en localStorage |
| Storage | Cloudinary (PDFs, imágenes) |
| Deploy | Render.com (un único servicio web) |

---

## Estructura del repo

```
construction-pm/
├── backend/
│   ├── prisma/schema.prisma       # Un solo schema: modelos tech + Fin* (finance)
│   ├── src/
│   │   ├── app.ts                 # Express + rutas /api/* (tech) y /api/finance/*
│   │   ├── routes/                # Rutas del módulo técnico
│   │   ├── data/                  # Templates tech (fases, inspecciones)
│   │   ├── seed.ts                # Seed inicial: LOTE 87
│   │   └── finance/               # Módulo financiero embebido
│   │       ├── routes/            # 12 routers REST con prefijo /api/finance/*
│   │       ├── services/          # excelImporter, statementParser, reconciliation
│   │       ├── lib/               # prisma, cloudinary, auth, respond
│   │       └── data/              # Catálogos seed finance
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Router top-level: /, /tech/*, /finance/*
│   │   ├── Landing.tsx            # Selector de módulos + backup global
│   │   ├── components/
│   │   │   ├── AuthGate.tsx       # Login único, token pm_auth_token
│   │   │   └── layout/Layout.tsx  # Sidebar tech
│   │   ├── pages/                 # 14 páginas del módulo técnico
│   │   ├── lib/                   # api client, formatters, types
│   │   └── finance/               # Módulo financiero embebido
│   │       ├── FinanceApp.tsx
│   │       ├── components/Layout.tsx
│   │       ├── pages/             # 14 páginas finance
│   │       └── lib/api.ts         # cliente axios con baseURL /api/finance
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── render.yaml                    # Build + start scripts para deploy
└── CLAUDE.md                      # Guía para futuras sesiones de Claude
```

---

## Setup local (desde cero, en otra máquina)

### Prerrequisitos
- **Node.js 20.x** (https://nodejs.org)
- **Git**
- (Opcional) **Cloudinary account** si quieres subir documentos

### 1. Clonar
```bash
git clone https://github.com/JotaRes/construction-pm.git
cd construction-pm
```

### 2. Backend
```bash
cd backend
npm install

# Crear archivo .env con las siguientes variables
cat > .env <<EOF
DATABASE_URL="file:./dev.db"
PORT=8000
JWT_SECRET="construction-pm-secret-2026"
APP_PASSWORD="18418598"
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
EOF

# Inicializar DB y cargar LOTE 87
npx prisma generate
npx prisma db push --accept-data-loss
npm run db:seed

# Arrancar (puerto 8000)
npm run dev
```

### 3. Frontend (terminal separada)
```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:5173
```

### 4. Acceso
- Entra a http://localhost:5173
- Clave: `18418598`
- Verás el Landing con los 2 módulos + opción de backup

---

## Deploy a producción (Render.com)

El repo incluye `render.yaml` con configuración completa.

1. Crear servicio web en Render apuntando a este repo (branch `main`)
2. Render leerá `render.yaml` y configurará el build automáticamente
3. Crear base de datos PostgreSQL en Render
4. Setear variables sensitivas en el dashboard de Render:
   - `DATABASE_URL` → la URL de Postgres de Render
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
5. Push a `main` → Render auto-deploya (`autoDeploy: yes`)

### Qué hace el deploy
**Build:**
1. `npm ci --include=dev` en backend y frontend
2. `vite build` (compila React)
3. Copia `frontend/dist/` → `backend/public/`

**Start:**
1. `sed` cambia provider Prisma de `sqlite` a `postgresql`
2. `npx prisma generate` (cliente unificado tech + finance)
3. `npx prisma db push --accept-data-loss` (un solo schema, sin riesgo de borrar datos)
4. `npx tsx src/app.ts` (servidor)

---

## Modelo de datos

El `schema.prisma` contiene **un único modelo unificado** con dos namespaces:

### Modelos del módulo técnico
`Project`, `Phase`, `Item`, `Draw`, `Partner`, `Provider`, `ProviderQuote`, `Note`, `ProjectFile`, `Inspection`, `BudgetLine`, `Task`, `ItemDocument`, `PriceRef`

### Modelos del módulo financiero (prefijo `Fin`, tablas SQL prefijadas `fin_`)
`FinSPV`, `FinAccount`, `FinPartner`, `FinLender`, `FinProvider`, `FinExpenseCategory`, `FinIncomeOrigin`, `FinProject`, `FinMovement`, `FinCapitalContribution`, `FinLoan`, `FinNonBankContribution`, `FinMovementDocument`, `FinProjectDocument`, `FinBankStatement`, `FinBankStatementLine`, `FinActivityLog`

**Por qué este diseño:** dos schemas Prisma separados en la misma DB causaban que cada `prisma db push` dropeara las tablas del otro. Unificar todo en un schema evita pérdida de datos y simplifica el deploy.

---

## API endpoints

### Auth (global)
- `POST /api/auth/login` — body: `{password}` → `{token}`
- `GET /api/auth/verify` — header Authorization

### Módulo técnico (prefijo `/api/*`)
- `/api/projects`, `/api/items`, `/api/draws`, `/api/projects/:id/phases`, etc.
- `/api/backup` — descarga **ZIP global** con datos de ambos módulos + código fuente

### Módulo financiero (prefijo `/api/finance/*`)
- `/api/finance/dashboard`, `/api/finance/movements`, `/api/finance/accounts`
- `/api/finance/capital`, `/api/finance/loans`, `/api/finance/catalogs`
- `/api/finance/statements`, `/api/finance/imports`, `/api/finance/backup`
- `/api/finance/documents`, `/api/finance/projects`, `/api/finance/reports`

---

## Backup del sistema

Disponible desde el **Landing** (`/`), accesible para ambos módulos.

Genera un ZIP con:
- `data/tech-database.json` — todos los datos del módulo técnico (proyectos, fases, ítems, draws, inspecciones, tareas, presupuestos, etc.)
- `data/finance-database.json` — todos los datos financieros (movimientos, capital, préstamos, extractos, etc.)
- `code/backend/` — código fuente completo del backend
- `code/frontend/` — código fuente completo del frontend
- `code/render.yaml` — configuración de deploy

Suficiente para recrear el sistema completo en otra máquina.

---

## Comandos útiles

```bash
# Backend
cd backend
npm run dev               # arranca en :8000 (watch mode)
npm run db:seed           # carga datos del LOTE 87
npm run db:reset          # borra DB y re-seedea
npx prisma studio         # GUI para inspeccionar la DB
npx tsc --noEmit          # verifica TypeScript

# Frontend
cd frontend
npm run dev               # arranca en :5173
npm run build             # produce bundle para producción
npx tsc --noEmit          # verifica TypeScript
```

---

## Seguridad

- Auth con HMAC-SHA256 (clave + JWT_SECRET → token determinístico)
- Token único `pm_auth_token` compartido entre módulos
- Todas las rutas API requieren `Authorization: Bearer <token>` excepto `/auth/login`
- En producción, `APP_PASSWORD` está en variables de entorno de Render (no en repo)

---

## Licencia

Privado — Restrepo Acosta Global Holding LLC
