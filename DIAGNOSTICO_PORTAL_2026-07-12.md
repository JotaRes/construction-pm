# Diagnóstico Exhaustivo del Portal — 12 julio 2026

**Sistema:** restrepoacosta.onrender.com · Monorepo tech + finance · Node/Express/TS + React 18 + Prisma + Render

Revisión de: schema Prisma (36 modelos), 46 rutas backend, 60+ archivos frontend, render.yaml, git log, docs internas.

---

## 1. VEREDICTO GENERAL

El sistema es **funcionalmente maduro pero operativamente frágil**. Tienes un producto con profundidad de dominio real (draws con trazabilidad línea a línea, conciliación bancaria, sync capital/deuda, OCR de documentos) que pocas empresas de tu tamaño tienen. Pero corre sobre tres bombas de tiempo: el deploy puede destruir datos de producción, la seguridad depende de una clave publicada en el propio repositorio, y los backups son 100% manuales.

La interconexión de módulos que pides ya está diagnosticada por ti mismo en `INTERCONEXION_MODULOS.md` (23 mayo). **Ese plan se quedó en el papel: los P0 (A y B) no se implementaron.** Lo único construido es la parte de lectura (dashboard ejecutivo consolidado y proyección de liquidez). No es un problema de diseño — es un problema de ejecución del plan que ya tenías.

---

## 2. PUNTOS FUERTES (reales, verificados en código)

**Arquitectura unificada bien resuelta.** Un solo schema Prisma, una sola DB, un solo deploy. Los modelos `Fin*` con `@@map("fin_")` conviven sin conflicto con los técnicos. Esto hace que la interconexión sea *barata*: `portfolio.ts` y `liquidity.ts` ya cruzan datos de ambos módulos en una sola query. La decisión de no separar schemas (post-incidente LOTE 87) fue correcta.

**Seguridad perimetral por encima del promedio.** Helmet con CSP estricta, CORS con allowlist, rate limiting en login (5/15min, solo intentos fallidos), auth global en todo `/api/*`, comparación timing-safe de tokens, `trust proxy` configurado con justificación documentada. Esto no es lo típico en un proyecto interno.

**Modelado de dominio profundo.** `DrawLineContribution` (trazabilidad draw→línea presupuestal con recálculo en cascada), `capitalSync`/`loanSync` (un movimiento bancario genera/actualiza automáticamente aportes de capital y préstamos), conciliación de extractos bancarios, audit log. El módulo financiero internamente SÍ está automatizado — el problema es el puente hacia el técnico.

**Backup completo bifocal.** `/api/backup` genera ZIP con datos de ambos módulos + binarios + instrucciones de restore. Existe restore por módulo.

**Disciplina documental.** CLAUDE.md con reglas de oro, README, diagnósticos previos, manual de usuario. El git log muestra commits atómicos con mensajes claros.

---

## 3. PUNTOS DÉBILES

### 🔴 CRÍTICOS (riesgo de pérdida de datos o acceso no autorizado)

**D1 — `prisma db push --accept-data-loss` en cada arranque de producción.**
`render.yaml` ejecuta esto en `startCommand`. Traducción: si algún día editas el schema y renombras o eliminas un campo, el próximo deploy **borra esa columna y sus datos en producción sin preguntar**. Es la misma clase de riesgo que casi mata el LOTE 87, todavía viva. No hay migraciones versionadas en uso (`prisma/migrations` existe pero el flujo real es `db push`).

**D2 — Credenciales de producción publicadas en el repositorio.**
- `render.yaml` (commiteado): los valores reales de `JWT_SECRET` y `APP_PASSWORD` en texto plano.
- `CLAUDE.md` y `README.md`: la clave de producción publicada.
- Fallbacks en código: `'[FALLBACK-ELIMINADO]'` / `'[FALLBACK-ELIMINADO]'`.
- El "token" es un HMAC estático del password: **no expira nunca y no se puede revocar** sin cambiar el password para todos.
Cualquier persona con acceso al repo (o a un backup del ZIP, que incluye código fuente) tiene acceso total y permanente al sistema financiero del holding.

**D3 — Backups solo manuales.**
`GET /api/backup` existe, pero nadie lo llama automáticamente. No hay cron. Si Render pierde la DB Postgres o alguien borra datos por error, la última copia es la última vez que te acordaste de descargar el ZIP.

**D4 — El baile sqlite↔postgresql sigue siendo manual y ahora mismo está en estado peligroso.**
Tu working tree tiene `schema.prisma` modificado localmente (provider `sqlite`) mientras `origin/main` tiene `postgresql`. Con `autoDeploy: yes`, un `git push` descuidado que incluya ese archivo rompe el arranque en producción (Prisma rechaza URL postgres con provider sqlite) — y como el fallo es en `startCommand`, Render puede quedar ciclando. Ya perdiste tiempo antes con esto (commit e47ccec5).

### 🟠 ALTOS (deuda estructural)

**D5 — Interconexión de módulos: solo lectura, cero escritura.**
- No existe FK `Project ↔ FinProject`. Los dos "Lote 87" son registros huérfanos entre sí.
- Un Draw marcado `WIRED` en tech **no genera** el `FinMovement` de ingreso en finance. Doble digitación, riesgo de descuadre.
- Entidades duplicadas sin puente: `Provider`/`FinProvider`, `Partner`/`FinPartner`, lender del proyecto técnico vs `FinLender`.
- El margen real (ARV técnico − costos financieros) no es calculable automáticamente porque nada une los dos proyectos.

**D6 — Cero validación de entrada en backend.**
Zod está solo en el frontend. Los endpoints de escritura aceptan lo que llegue (`req.body` directo a Prisma con casts `+valor`). Un import de Excel malformado o un bug del frontend puede sembrar datos corruptos en el núcleo financiero. Tu propia skill lo define como alerta roja.

**D7 — 21 instancias de `new PrismaClient()`.**
Cada archivo de rutas crea su propio cliente con su propio pool de conexiones. En SQLite es inocuo; en Postgres de Render (límite ~97 conexiones) es una fuga esperando tráfico o un redeploy en caliente. Ya existe `finance/lib/prisma.ts` como singleton — el módulo técnico no lo usa.

**D8 — Cero tests, cero CI, deploy directo a producción.**
`autoDeploy: yes` + sin pipeline = cada push a main llega a producción sin que nadie verifique ni siquiera que compila (`tsc --noEmit` es manual, regla de oro #3 depende de memoria humana). Vitest está instalado en frontend y sin usar.

### 🟡 MEDIOS

**D9 — Dinero en `Float`.** Todos los montos son floats binarios (riesgo de centavos fantasma en agregaciones). Para volumen actual es tolerable; para estados hacia socios/bancos, `Decimal` es el estándar.

**D10 — Rutas monolíticas.** `draws.ts` supera 1.400 líneas mezclando parsing de PDF, lógica de negocio y HTTP. Dificulta mantenimiento y hace el código frágil ante cambios.

**D11 — `uncaughtException` silenciado globalmente.** Mantiene el servidor vivo (razonable por tesseract), pero también puede enmascarar corrupción de estado tras errores no relacionados con OCR. Aceptable solo si hay alertas/logs externos — no los hay.

**D12 — Sin monitoreo.** Si el sitio se cae o el deploy falla, te enteras cuando intentas usarlo.

---

## 4. QUÉ HARÍA YO — PLAN EN 3 FASES

Orden deliberado: **blindar primero lo que puede destruir datos, luego interconectar, luego automatizar hacia afuera.** Interconectar sobre una base que puede perder datos en cada deploy es construir el segundo piso sin cimentación — y tu skill técnica dice exactamente eso.

### FASE 0 — Blindaje (esta semana, ~1 día de trabajo)

| # | Acción | Cómo | Esfuerzo |
|---|--------|------|----------|
| 0.1 | Eliminar `--accept-data-loss` | Adoptar `prisma migrate deploy` en startCommand; generar migración baseline desde el estado actual de producción | 2-3 h |
| 0.2 | Matar el flip sqlite/postgres | Postgres local vía Docker Compose (un comando: `docker compose up -d`). Provider `postgresql` fijo en el repo, mismo motor en local y producción. Se acaba el riesgo D4 y los bugs que solo aparecen en producción | 1-2 h |
| 0.3 | Sacar secretos del repo | `JWT_SECRET` y `APP_PASSWORD` a `sync: false` en render.yaml (valores solo en dashboard de Render). Rotar ambos. Borrar la clave de CLAUDE.md/README. Eliminar fallbacks hardcodeados del código | 1 h |
| 0.4 | Backup automático diario | GitHub Actions con cron diario: llama `/api/backup` con token y sube el ZIP como artifact (90 días retención gratis) o a tu Google Drive. Cero costo | 1-2 h |
| 0.5 | Singleton Prisma | Un `lib/prisma.ts` compartido, reemplazar los 21 `new PrismaClient()` | 1 h |

### FASE 1 — Interconexión de módulos (semanas 1-2, ~2-3 días)

Es ejecutar los P0/P1 de tu propio documento de mayo, con dos ajustes técnicos:

**1.1 Vínculo maestro `Project.finProjectId`** (P0-A). Campo opcional + dropdown en la página del proyecto técnico + endpoint `GET /api/projects/:id/unified-view` que devuelve en una sola respuesta: avance físico, ejecutado técnico, egresos/ingresos financieros del FinProject vinculado, deuda viva, y **drift** (avance físico % vs costo ejecutado %). Es la pieza que habilita todo lo demás. *3-4 h.*

**1.2 Draw WIRED → FinMovement automático** (P0-B), con dos exigencias que tu doc de mayo no incluía y son obligatorias:
- **Idempotencia:** campo `Draw.finMovementId` para que re-guardar un draw no duplique el ingreso.
- **Transacción:** crear el movimiento dentro de `prisma.$transaction` con la actualización del draw — o quedan descuadrados ante cualquier fallo.
Al marcar WIRED: modal "¿Registrar ingreso de $X en cuenta [dropdown]?" → crea FinMovement tipo Ingreso, origen DRAW, lender vinculado. Borrado inverso sincronizado. *3-4 h.*

**1.3 Commitment del lender → FinLoan** (C): botón de sincronización al cargar la carta de aprobación. *2 h.*

**1.4 Mapeo de catálogos duplicados:** tabla de equivalencias `Provider ↔ FinProvider` (no fusionar modelos — demasiado riesgo de migración; un mapping es suficiente y reversible). Permite que una factura subida en tech aparezca como soporte sugerido del egreso en finance (D). *3-4 h.*

**1.5 Drift en el dashboard ejecutivo existente:** ya tienes `portfolio.ts` cruzando datos; agregarle la señal más valiosa: avance físico 60% + costo 80% = alerta de sobrecosto. *2 h.*

### FASE 2 — Profesionalización y automatización externa (mes 1-2)

| # | Acción | Valor | Esfuerzo |
|---|--------|-------|----------|
| 2.1 | Validación Zod en endpoints de escritura (empezar: movements, draws, imports) | Datos financieros no corrompibles | 4-6 h |
| 2.2 | CI en GitHub Actions: `tsc --noEmit` back+front + build en cada push; branch protection en main | Nadie (ni tú ni yo) puede romper producción con un push que no compila | 2 h |
| 2.3 | Tokens JWT reales con expiración + 2 roles (Owner / Socio read-only) | Revocación posible; Oscar ve KPIs sin poder borrar nada | 4-6 h |
| 2.4 | Notificaciones por email (Resend, gratis hasta 3k/mes): permit por vencer, saldo bajo, draw aprobado, deploy fallido | El sistema te busca a ti, no al revés | 3-4 h |
| 2.5 | Monitoreo uptime (UptimeRobot gratis sobre `/api/health`) | Te enteras antes de que duela | 30 min |
| 2.6 | Reporte ejecutivo PDF mensual (ya tienes exceljs; agregar generación PDF del dashboard unificado) | Reuniones de socios sin trabajo manual | 3-4 h |

### FASE 3 — Escala (mes 3+, cuando haya >1 proyecto activo)

Migrar montos a `Decimal` (con migración cuidadosa), partir `draws.ts` en servicios, tests de los cálculos críticos (balances, drift, draws — los cálculos de dinero son lo único que de verdad amerita tests aquí), vista `/socio` con link mágico, code-split de Recharts.

---

## 5. LO QUE NO HARÍA

- **No** separar los módulos en dos servicios/deploys. Tu ventaja competitiva es precisamente la DB única — la interconexión es un JOIN, no una integración.
- **No** fusionar `Provider`/`FinProvider` en un solo modelo. Mapping table: mismo beneficio, 10% del riesgo.
- **No** reescribir nada. El código es mejorable pero sano; el problema es operativo (deploy, secretos, backups), no de calidad de construcción.
- **No** agregar features nuevas antes de la Fase 0. Cada semana que el sistema corre con D1-D4 activos es una apuesta.

---

## 6. RESUMEN EJECUTIVO

| Dimensión | Estado | Nota |
|---|---|---|
| Funcionalidad de negocio | 🟢 Fuerte | Dominio draws/finanzas mejor que muchas herramientas comerciales |
| Interconexión módulos | 🟡 Parcial | Solo lectura (dashboards); escritura cruzada inexistente; plan de mayo sin ejecutar |
| Estabilidad de datos | 🔴 Crítico | `--accept-data-loss` en producción + flip manual de provider |
| Seguridad de acceso | 🔴 Crítico | Password y secret en el repo; token irrevocable |
| Continuidad (backups) | 🔴 Crítico | Solo manual |
| Calidad de código | 🟡 Media | Sin validación backend, sin tests, rutas monolíticas — pero bien organizado |
| Automatización | 🟡 Media | Fuerte dentro de finance; nula entre módulos y hacia afuera |

**Primera acción concreta sugerida:** Fase 0 completa. Puedo ejecutarla contigo paso a paso desde esta sesión — empezando por 0.3 (rotar secretos, 1 hora, cero riesgo) y 0.4 (backup automático), que no tocan ni una línea de lógica de negocio.
