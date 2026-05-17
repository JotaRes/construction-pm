// Parser de extractos bancarios — soporta CSV y Excel.
// PDF se acepta pero requiere parsing manual posterior (almacenamos texto crudo).

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
}

function tryParseDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const s = String(v).trim();
  if (!s) return null;
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})/,
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
  ];
  for (const r of formats) {
    const m = s.match(r);
    if (m) {
      let y: number, mo: number, d: number;
      if (r === formats[0]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
      else { d = +m[1]; mo = +m[2]; y = +m[3]; }
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

function tryParseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[\s$,]/g, "").replace(/[()]/g, "");
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return String(v).includes("(") ? -n : n;
}

function detectColumns(headers: string[]): { date: number; description: number; amount: number; debit: number; credit: number } {
  const norm = headers.map((h) => String(h).toLowerCase().trim());
  const find = (...keys: string[]) => norm.findIndex((h) => keys.some((k) => h.includes(k)));
  return {
    date: find("fecha", "date"),
    description: find("descripcion", "descripción", "concepto", "description", "memo"),
    amount: find("monto", "valor", "amount"),
    debit: find("debito", "débito", "debit", "salida", "retiro", "withdrawal"),
    credit: find("credito", "crédito", "credit", "ingreso", "deposito", "depósito", "deposit"),
  };
}

export async function parseStatementFile(buffer: Buffer, filename: string, mimetype: string): Promise<ParsedStatement> {
  const lower = filename.toLowerCase();
  const lines: ParsedLine[] = [];

  if (lower.endsWith(".csv") || lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimetype.includes("sheet") || mimetype === "text/csv") {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null });

    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = (rows[i] || []).map((c) => String(c || "").toLowerCase());
      if (row.some((c) => c.includes("fecha") || c.includes("date"))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) headerIdx = 0;

    const headers = (rows[headerIdx] || []).map((c) => String(c || ""));
    const cols = detectColumns(headers);

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const date = cols.date >= 0 ? tryParseDate(row[cols.date]) : null;
      if (!date) continue;
      const description = cols.description >= 0 ? String(row[cols.description] || "").trim() : "";

      let amount: number | null = null;
      let type: "debit" | "credit" = "debit";

      if (cols.debit >= 0 || cols.credit >= 0) {
        const d = cols.debit >= 0 ? tryParseAmount(row[cols.debit]) : null;
        const c = cols.credit >= 0 ? tryParseAmount(row[cols.credit]) : null;
        if (c && c !== 0) { amount = Math.abs(c); type = "credit"; }
        else if (d && d !== 0) { amount = Math.abs(d); type = "debit"; }
      } else if (cols.amount >= 0) {
        const a = tryParseAmount(row[cols.amount]);
        if (a != null) { amount = Math.abs(a); type = a >= 0 ? "credit" : "debit"; }
      }

      if (amount != null && amount > 0 && description) {
        lines.push({ date, description, amount, type });
      }
    }
  } else if (lower.endsWith(".pdf") || mimetype === "application/pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    const text = data.text || "";
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
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  return {
    lines,
    periodStart: lines[0]?.date,
    periodEnd: lines[lines.length - 1]?.date,
  };
}
