// Parser de extractos bancarios — soporta CSV, Excel y PDF.
// Diseñado para ser tolerante a múltiples formatos bancarios (Ocean Bank, Chase, BoA, etc.)

import * as XLSX from "xlsx";
import { parseAmountFlexible } from "../../lib/parseAmount";

export interface ParsedLine {
  date: Date;
  description: string;
  amount: number;
  type: "debit" | "credit";
}

export interface ParsedStatement {
  lines: ParsedLine[];
  periodStart?: Date;
  periodEnd?: Date;
  openingBalance?: number;
  closingBalance?: number;
  warnings?: string[];
}

function tryParseDate(v: any): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v).trim();
  if (!s) return null;
  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  // US: MM/DD/YYYY or MM-DD-YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    // Asumir formato US (MM/DD/YYYY) por defecto
    const dt = new Date(Date.UTC(y, +m[1] - 1, +m[2]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  // dd.mm.yyyy
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    const dt = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  // Last resort: native parsing
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

// Soporta formato US ($45,200.00), europeo ($45.200,00), paréntesis (contable negativo)
// y números nativos. Devuelve null si la celda está vacía/no parseable.
function tryParseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  const n = parseAmountFlexible(v);
  // Distinguir 0 explícito (válido) de input incomprensible (null)
  if (n === 0) {
    const s = String(v).replace(/[\s$,.()]/g, "");
    if (!/^0+$/.test(s)) return null;
  }
  return n;
}

function detectColumns(headers: string[]): {
  date: number; description: number; amount: number; debit: number; credit: number; type: number; balance: number;
} {
  const norm = headers.map((h) => String(h || "").toLowerCase().trim());
  const findContains = (...keys: string[]) =>
    norm.findIndex((h) => keys.some((k) => h.includes(k)));
  const findExact = (...keys: string[]) =>
    norm.findIndex((h) => keys.some((k) => h === k));

  return {
    date: findContains("fecha", "date", "post date", "transaction date", "trans date"),
    description: findContains("descripcion", "descripción", "concepto", "description", "memo", "detail", "narration", "transaction"),
    amount: findContains("monto", "valor", "amount"),
    debit: findExact("debito", "débito", "salida", "retiro", "withdrawal", "debit", "debits"),
    credit: findExact("credito", "crédito", "deposito", "depósito", "deposit", "credit", "credits"),
    type: findContains("type", "tipo", "d/c"),
    balance: findContains("balance", "saldo"),
  };
}

export async function parseStatementFile(buffer: Buffer, filename: string, mimetype: string): Promise<ParsedStatement> {
  const lower = (filename || "").toLowerCase();
  const lines: ParsedLine[] = [];
  const warnings: string[] = [];

  const isExcelOrCsv =
    lower.endsWith(".csv") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    /sheet|csv|excel/i.test(mimetype);

  if (isExcelOrCsv) {
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: false });
    } catch (e: any) {
      throw new Error(`No se pudo leer el archivo: ${e.message}`);
    }

    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("El archivo no contiene hojas válidas");

    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

    if (rows.length < 2) {
      throw new Error("El archivo está vacío o tiene menos de 2 filas (necesita header + al menos 1 movimiento)");
    }

    // Buscar la fila de header (con "Fecha" o "Date")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = (rows[i] || []).map((c) => String(c || "").toLowerCase());
      if (row.some((c) =>
        c.includes("fecha") || c.includes("date") || c.includes("trans") || c.includes("post")
      )) {
        // Verificar que también tenga columna de descripción o monto
        if (row.some((c) => c.includes("descrip") || c.includes("concepto") || c.includes("memo") || c.includes("amount") || c.includes("monto") || c.includes("debit") || c.includes("credit"))) {
          headerIdx = i;
          break;
        }
      }
    }
    if (headerIdx === -1) {
      warnings.push("No se detectó fila de encabezado, se asume fila 1.");
      headerIdx = 0;
    }

    const headers = (rows[headerIdx] || []).map((c) => String(c || ""));
    const cols = detectColumns(headers);

    if (cols.date < 0) {
      throw new Error(`No se encontró columna de fecha. Headers detectados: [${headers.filter(Boolean).join(", ")}]`);
    }
    if (cols.description < 0) {
      warnings.push("No se detectó columna de descripción/concepto explícita; se intentará inferir.");
    }
    if (cols.debit < 0 && cols.credit < 0 && cols.amount < 0) {
      throw new Error(`No se encontraron columnas de monto (Amount, Debit/Credit, Monto). Headers: [${headers.filter(Boolean).join(", ")}]`);
    }

    let parseErrors = 0;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      // Saltar filas vacías
      if (row.every((c) => c == null || String(c).trim() === "")) continue;

      const date = tryParseDate(row[cols.date]);
      if (!date) {
        parseErrors++;
        continue;
      }

      let description = "";
      if (cols.description >= 0) {
        description = String(row[cols.description] || "").trim();
      }
      // Si no hay descripción, intentar concatenar otras columnas relevantes
      if (!description) {
        description = row
          .map((c, idx) => (idx !== cols.date && idx !== cols.amount && idx !== cols.debit && idx !== cols.credit && idx !== cols.balance) ? String(c || "") : "")
          .filter(Boolean)
          .join(" ")
          .trim()
          .slice(0, 200);
      }
      if (!description) description = "(sin descripción)";

      let amount: number | null = null;
      let type: "debit" | "credit" = "debit";

      // Caso 1: columnas Debit y Credit separadas
      if (cols.debit >= 0 || cols.credit >= 0) {
        const d = cols.debit >= 0 ? tryParseAmount(row[cols.debit]) : null;
        const c = cols.credit >= 0 ? tryParseAmount(row[cols.credit]) : null;
        if (c != null && c !== 0) { amount = Math.abs(c); type = "credit"; }
        else if (d != null && d !== 0) { amount = Math.abs(d); type = "debit"; }
      } else if (cols.amount >= 0) {
        // Caso 2: una sola columna Amount
        const a = tryParseAmount(row[cols.amount]);
        if (a != null && a !== 0) {
          amount = Math.abs(a);
          if (cols.type >= 0) {
            const t = String(row[cols.type] || "").toLowerCase().trim();
            if (t.startsWith("d") || t.includes("debit") || t.includes("débito") || t.includes("debito")) type = "debit";
            else if (t.startsWith("c") || t.includes("credit") || t.includes("crédito") || t.includes("credito")) type = "credit";
            else type = a >= 0 ? "credit" : "debit";
          } else {
            type = a >= 0 ? "credit" : "debit";
          }
        }
      }

      if (amount != null && amount > 0) {
        lines.push({ date, description, amount, type });
      } else {
        parseErrors++;
      }
    }

    if (parseErrors > 0) {
      warnings.push(`${parseErrors} fila(s) se omitieron por falta de fecha o monto válido.`);
    }
  } else if (lower.endsWith(".pdf") || mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = data.text || "";
    const parsedPdf = parsePdfStatement(text, warnings);
    lines.push(...parsedPdf.lines);
    if (lines.length === 0) {
      throw new Error("No se pudieron extraer movimientos del PDF. El formato puede no ser compatible o el extracto puede necesitar OCR.");
    }
    lines.sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      lines,
      periodStart: parsedPdf.periodStart ?? lines[0]?.date,
      periodEnd:   parsedPdf.periodEnd   ?? lines[lines.length - 1]?.date,
      openingBalance: parsedPdf.openingBalance,
      closingBalance: parsedPdf.closingBalance,
      warnings,
    };
  } else {
    throw new Error(`Formato no soportado: ${filename}. Use CSV, Excel (.xlsx, .xls) o PDF.`);
  }

  if (lines.length === 0) {
    throw new Error("No se pudieron extraer líneas válidas del archivo. Verifica las columnas: Fecha, Descripción y Monto (o Débito/Crédito).");
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    lines,
    periodStart: lines[0]?.date,
    periodEnd: lines[lines.length - 1]?.date,
    warnings,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// PDF parser robusto — diseñado para extractos Ocean Bank y similares.
//
// Heurísticas:
//   1. Skip ruido: PREVIOUS BALANCE, BEGINNING BALANCE, TOTAL DEBITS, TOTAL
//      CREDITS, ENDING BALANCE, página, header de columnas. Estos NO son
//      movimientos.
//   2. Capturar opening/closing balance del header del extracto.
//   3. Capturar período (Statement Period: MM/DD/YYYY - MM/DD/YYYY).
//   4. Para cada movimiento real: fecha + descripción + monto + tipo.
//      Tipo se infiere por:
//        a) Sección del extracto: "DEPOSITS AND CREDITS" → credit;
//           "WITHDRAWALS AND DEBITS" / "CHECKS" / "FEES" → debit.
//        b) Si no hay sección clara: amount negativo → debit, positivo → credit.
//        c) Si la descripción contiene "WITHDRAWAL", "DEBIT", "FEE", "CHECK",
//           "PAYMENT", "PURCHASE" → debit; "DEPOSIT", "CREDIT", "INCOMING" →
//           credit.
//   5. Descripción es TODO el texto entre la fecha y el monto — no sólo el ID.
// ───────────────────────────────────────────────────────────────────────────
export function parsePdfStatement(text: string, warnings: string[] = []): {
  lines: ParsedLine[];
  openingBalance?: number;
  closingBalance?: number;
  periodStart?: Date;
  periodEnd?: Date;
} {
  const out: ParsedLine[] = [];
  // Normalizar: \r\n → \n, comprimir múltiples espacios pero preservar \n
  const normalized = text.replace(/\r\n/g, "\n").replace(/\x00/g, " ");

  // 1. Período del extracto — "Statement Period: 01/06/2026 - 02/01/2026"
  //    o "Period: ... to ..."
  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;
  const periodRe = /(?:statement\s*period|period|statement\s*date|cycle)\s*[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:-|to|through|–|—|al?)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
  const pm = normalized.match(periodRe);
  if (pm) {
    periodStart = tryParseDate(pm[1]) ?? undefined;
    periodEnd   = tryParseDate(pm[2]) ?? undefined;
  }

  // 2. Balances apertura/cierre
  let openingBalance: number | undefined;
  let closingBalance: number | undefined;
  const openRe = /(?:previous\s*balance|beginning\s*balance|opening\s*balance|saldo\s*anterior|saldo\s*inicial)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i;
  const om = normalized.match(openRe);
  if (om) openingBalance = parseAmountFlexible(om[1]);
  const closeRe = /(?:ending\s*balance|closing\s*balance|new\s*balance|saldo\s*final|saldo\s*nuevo|current\s*balance)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i;
  const cm = normalized.match(closeRe);
  if (cm) closingBalance = parseAmountFlexible(cm[1]);

  // 3. Detectar secciones del estado de cuenta
  //    Recorremos línea por línea, manteniendo el "currentSection" actual.
  const lines = normalized.split("\n");

  // Patrones para identificar header de cada sección
  const SECTION_CREDITS = /\b(deposits?\s*(?:and|&|\/)?\s*credits?|other\s*credits?|deposits|cr[eé]ditos|incoming\s*wires?|deposits\s*and\s*additions)\b/i;
  const SECTION_DEBITS  = /\b(withdrawals?\s*(?:and|&|\/)?\s*debits?|debits?|withdrawals|checks?\s*paid|fees|servicio\s*fees?|outgoing\s*wires?|other\s*withdrawals|debit\s*card)\b/i;
  const SECTION_ENDS    = /\b(daily\s*balance|account\s*summary|monthly\s*summary|membership\s*fees?|service\s*charges?|statement\s*summary|fee\s*summary|saldo\s*diario)\b/i;

  // Filas que NO son movimientos (totales, balances, headers)
  const SKIP_LINE = /^\s*(previous|beginning|opening|ending|closing|new|current)\s*balance\b/i;
  const SKIP_TOTAL = /^\s*(?:total\s*(?:debits|credits|withdrawals|deposits|fees)|page\s*\d+|account\s*number|date\s+description|date\s+amount)/i;
  const PAGE_FOOTER = /\bpage\s+\d+\s+of\s+\d+\b/i;

  // Pattern de un movimiento: fecha + cualquier cosa + monto al final
  //   Ej: "01/06/2026  CHECK # 1234 ABC PAYMENT TO XYZ  -$1,234.56"
  //       "01/06  ACH DEPOSIT FROM EMPLOYER  $2,500.00"
  // Acepta fecha MM/DD/YYYY o MM/DD (sin año, se asume del periodStart)
  const LINE_RE = /^\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+(.+?)\s+(-?\$?\s*[\d,]+\.\d{2})(?:\s+(-?\$?\s*[\d,]+\.\d{2}))?\s*$/;

  let currentSection: "credits" | "debits" | "neutral" = "neutral";
  const periodYear = periodStart ? periodStart.getUTCFullYear() : new Date().getUTCFullYear();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const ln = raw.trim();
    if (!ln) continue;

    // Detectar cambio de sección
    if (SECTION_CREDITS.test(ln) && !LINE_RE.test(ln)) { currentSection = "credits"; continue; }
    if (SECTION_DEBITS.test(ln)  && !LINE_RE.test(ln)) { currentSection = "debits";  continue; }
    if (SECTION_ENDS.test(ln)) { currentSection = "neutral"; continue; }

    // Saltar líneas de ruido
    if (SKIP_LINE.test(ln) || SKIP_TOTAL.test(ln) || PAGE_FOOTER.test(ln)) continue;

    const m = ln.match(LINE_RE);
    if (!m) continue;

    let dateStr = m[1];
    // Si la fecha viene sin año, anexar año del período
    if (!/\d{4}|\d{2}$/.test(dateStr) || /^\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
      if (/^\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
        dateStr = `${dateStr}/${periodYear}`;
      }
    }
    const date = tryParseDate(dateStr);
    if (!date) continue;
    // Saltar si la fecha cae fuera del período del extracto
    if (periodStart && periodEnd) {
      if (date < periodStart || date > periodEnd) continue;
    }

    let description = (m[2] || "").trim()
      .replace(/\s{2,}/g, " ")
      .slice(0, 200);
    if (!description || /^\d+$/.test(description)) description = "(sin descripción)";

    const amtStr = m[3];
    const rawAmt = parseAmountFlexible(amtStr);
    if (!Number.isFinite(rawAmt) || Math.abs(rawAmt) < 0.01) continue;

    // Filtrar nuevamente "PREVIOUS BALANCE" si la fecha y monto match accidental
    if (/^(previous|beginning|opening|ending|closing)\s*balance$/i.test(description)) continue;

    // Inferir tipo (debit/credit)
    let type: "debit" | "credit";
    if (currentSection === "credits") type = "credit";
    else if (currentSection === "debits") type = "debit";
    else if (rawAmt < 0) type = "debit";
    else {
      // Inferir por palabras clave en la descripción
      if (/\b(withdrawal|debit|fee|charge|payment|purchase|wire\s*out|ach\s*debit|check\s*\#?\s*\d+|chk\s*\#)\b/i.test(description)) {
        type = "debit";
      } else if (/\b(deposit|credit|incoming|wire\s*in|ach\s*credit|transfer\s*in)\b/i.test(description)) {
        type = "credit";
      } else {
        // Default conservador: si no hay señal, asumir débito (es lo más común)
        type = "debit";
      }
    }

    out.push({ date, description, amount: Math.abs(rawAmt), type });
  }

  if (out.length === 0) {
    warnings.push("No se detectaron transacciones reconocibles en el PDF. El formato del extracto puede ser exótico o el PDF puede estar escaneado (necesita OCR).");
  }

  return { lines: out, openingBalance, closingBalance, periodStart, periodEnd };
}
