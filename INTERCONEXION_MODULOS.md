# Ideas de interconexión: Módulo Técnico ⇄ Financiero

**Propósito:** elevar el sistema a nivel gerencial integral, con visión 360° del negocio.

---

## 1. ESTADO ACTUAL

Los dos módulos viven en el mismo monorepo pero operan en silos:

```
Técnico (/tech)                       Financiero (/finance)
- Project (id: cuid)                  - FinProject (id: int)
- Item.valorEjecutado                 - FinMovement.amount
- ItemDocument (facturas, cotiz.)     - FinMovementDocument
- Draw (lender draws)                 - FinLoan (préstamos)
- ProjectFile (checklist documental)  - FinProjectDocument
```

**Único punto de contacto actual:** AuthGate global comparte el token entre módulos. Datos separados.

---

## 2. PUNTOS DE INTERCONEXIÓN PROPUESTOS

### A. Vinculación maestra `Project ↔ FinProject` (RECOMENDADO #1)

**Problema:** los gastos del módulo técnico (Item.valorEjecutado) no se reflejan en el módulo financiero, y los movimientos del módulo financiero no se ven en el budget del proyecto técnico. Hoy el usuario debe replicar manualmente.

**Solución:**
- Agregar `Project.finProjectId Int?` opcional (referencia cross-schema).
- En la página de Projects técnico: dropdown "Vincular con proyecto financiero".
- Una vez vinculados:
  - El **costo acumulado** del módulo técnico (sum de Item.valorEjecutado) aparece en KPIs del FinProject.
  - Los **egresos del módulo financiero** asignados a un FinProject se reflejan en el Budget del Project técnico.
  - **Margen real** = ARV (técnico) − costos reales (financiero).

**Endpoint nuevo:** `GET /api/projects/:id/unified-view` que agrega:
```json
{
  "tech": { "ejecutado": 145000, "avance": 32, "alertas": [...] },
  "finance": { "egresos": 145000, "ingresos": 0, "deuda": 200000 },
  "consistency": { "drift": 0, "ok": true }
}
```

### B. Draws (técnico) ↔ Movimientos (financiero) (RECOMENDADO #2)

**Problema:** cuando llega un draw del lender (Hera Holdings), se registra en /tech/draws con el "Net Wire", pero el ingreso a la cuenta bancaria se registra independientemente en /finance/movements.

**Solución:**
- Cuando se marca un Draw como `WIRED`, ofrecer crear automáticamente un FinMovement:
  - type: `Ingreso`
  - origin: `DRAW Hera` (ya existe en catálogo, code FIN-2201)
  - lenderId: vincular al lender del proyecto
  - amount: `netWire`
  - accountId: cuenta que recibe el draw (preguntar al usuario una vez)
  - `isLoan: false` (porque es desembolso de un préstamo ya activo, no un nuevo préstamo)
- Mutación inversa: si se borra el FinMovement, marcar el Draw como PENDING.

### C. Lender Commitment (cargado en /tech/financial) ↔ FinLoan automático

**Ya existe parcialmente** (lo construimos antes, lo reverteré-reincorporé). Hoy: cargar carta de aprobación en /tech/financial extrae datos al Project técnico (loanAmount, interestRate, term). 

**Mejora:** ofrecer botón "También sincronizar con módulo financiero" que cree el FinLoan asociado.

### D. Facturas del módulo técnico → Soporte de movimientos del financiero

**Hoy:** una factura subida en `/tech/execution/item/X` se queda asociada al ItemDocument. El egreso bancario equivalente en `/finance/movements/Y` carga la misma factura como FinMovementDocument duplicado.

**Solución:** cuando se crea un FinMovement con projectId vinculado a un Project técnico, ofrecer auto-asociar las facturas más recientes de ese proyecto. Evita duplicación.

### E. Dashboard ejecutivo unificado

**Nueva página** `/dashboard-ejecutivo` (root, fuera de /tech y /finance) con:

- **Por proyecto:**
  - Avance físico (técnico) vs avance financiero (% costo ejecutado / budget)
  - Drift: si avance físico es 60% pero costo es 80%, alerta amarilla (sobrecosto sin avance)
  - Drift inverso: si avance es 80% pero solo gastaste 50%, alerta verde (bajo budget) o roja (¿faltan facturas?)
- **Cashflow proyectado integrado:**
  - Forecast técnico: días para terminar × promedio diario egresos
  - Forecast financiero: runway actual
  - Cruzar: ¿alcanza el cash + holdback restante para terminar?
- **Alertas combinadas:**
  - Permit vence en 30d Y holdback < $50k → CRÍTICO
  - Cuenta en negativo Y proyecto activo → CRÍTICO
  - Movimientos sin factura > $10k → WARN

---

## 3. SEGURIDAD Y GOBERNANZA

### F. Roles y permisos (multi-usuario)

**Hoy:** un solo usuario con password compartido. Cualquiera puede borrar TODO.

**Propuesta:**
- 3 roles: `Owner` (Juan David), `Equipo` (apoyo), `Socio` (lectura + comentarios)
- JWT incluye `role`. Backend valida por endpoint.
- `Equipo` puede editar movimientos pero no wipe.
- `Socio` solo ve KPIs y reportes — no edita.
- Audit log enriquecido con quién hizo qué.

### G. 2FA + IP allowlist
Para el Owner: TOTP (Google Authenticator) o magic link al email.
Opcional: rate limit por IP en /api/auth/login (ya está en 5/15min) + IP allowlist configurable.

### H. Backups automáticos a S3 / Google Drive
**Hoy:** backup manual. Si el usuario olvida descargar, está expuesto a pérdida.

**Propuesta:**
- Cron diario (Render free no soporta cron, pero podemos usar GitHub Actions o un servicio gratis como cron-job.org).
- Cada 24h: POST /api/internal/snapshot → genera ZIP y sube a S3/Drive de Restrepo Acosta.
- 30 días de retención mínima.

---

## 4. UI / UX GERENCIAL

### I. Vista "Socio" — read-only ejecutiva

**Nueva ruta** `/socio` con login simplificado (link único por email).
- KPIs del proyecto en su rol
- Capital aportado / retornos esperados
- Sin ediciones, solo descargas

### J. Notificaciones por email/WhatsApp

Cuando se dispara una alerta crítica:
- Email automático al Owner + Equipo
- Mensaje WhatsApp opcional vía Twilio (cuesta ~$0.005/msg)
- Triggers:
  - Permit vence en <30d
  - Saldo cuenta < $10k
  - Préstamo vence en <15d
  - Factura sin cargar después de un movimiento >$5k

### K. PDF executive report

**Botón "Generar reporte ejecutivo"** en /dashboard que genera un PDF de 4 hojas:
1. Resumen ejecutivo (KPIs principales del holding)
2. Por proyecto (avance, costos, alertas)
3. Cashflow forecast 90 días
4. Capital aportado por socio + deuda viva

Ideal para reuniones de socios mensuales.

---

## 5. PRIORIZACIÓN SUGERIDA

| Prioridad | Feature | Tiempo estimado | Impacto |
|-----------|---------|-----------------|---------|
| **P0** | A — Vinculación Project ⇄ FinProject | 2-3h | Alto: unifica el reporte real |
| **P0** | B — Draws ⇄ Movimientos auto | 1-2h | Alto: elimina duplicación |
| **P1** | E — Dashboard ejecutivo unificado | 3-4h | Alto: visión 360° |
| **P1** | K — PDF executive report | 2-3h | Alto: reuniones de socios |
| **P2** | F — Roles y permisos | 4-5h | Medio: gobernanza para equipo |
| **P2** | H — Backups automáticos | 2-3h | Alto: seguridad de datos |
| **P3** | J — Notificaciones email/WhatsApp | 3-4h | Medio: alertas proactivas |
| **P3** | I — Vista Socio read-only | 2-3h | Bajo: nice-to-have |

---

## 6. ROADMAP PROPUESTO

**Sprint 1 (esta semana):** P0 → vinculación + draws auto-sync
**Sprint 2 (siguiente semana):** P1 → dashboard unificado + PDF reports
**Sprint 3 (mes 2):** P2 → roles + backups automáticos
**Sprint 4 (mes 3):** P3 → notificaciones + vista socio

---

**Documento generado:** 2026-05-23
**Owner:** Juan David Restrepo
**Sistema:** restrepoacosta.onrender.com
