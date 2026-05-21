// Parser de extractos bancarios — soporta CSV, Excel y PDF.
// Diseñado para ser tolerante a múltiples formatos bancarios (Ocean Bank, Chase, BoA, etc.)

import * as XLSX from "xlsx";

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

function tryParseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s) return null;
  // Detectar valores entre paréntesis = negativo (formato contable)
  const isParens = /^\(.*\)$/.test(s);
  s = s.replace(/[\s$,()]/g, "").replace(/^USD/i, "");
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return isParens ? -Math.abs(n) : n;
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
    // Patrón más flexible: fecha + descripción + monto
    const re = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const date = tryParseDate(m[1]);
      const description = m[2].trim();
      const amt = tryParseAmount(m[3]);
      if (date && description && amt != null) {
        lines.push({ date, description, amount: Math.abs(amt), type: amt >= 0 ? "credit" : "debit" });
      }
    }
    if (lines.length === 0) {
      throw new Error("No se pudieron extraer movimientos del PDF. El formato puede no ser compatible o necesita OCR.");
    }
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
