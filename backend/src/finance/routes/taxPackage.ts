// ============================================================
// PAQUETE ANUAL PARA EL CONTADOR (Lote C)
// GET /api/finance/tax-package?year=2026
// Genera un ZIP con un Excel por SPV (+ uno corporativo/sin SPV):
//   - Egresos clasificados por bucket fiscal US, con proveedor,
//     proyecto, soporte (sí/no) y link al documento
//   - Ingresos con origen
//   - Resumen por bucket (lo primero que mira el contador)
// ============================================================
import { Router } from "express";
import archiver from "archiver";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { resolveTaxBucket } from "../lib/taxBuckets";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const [movements, spvs] = await Promise.all([
      prisma.finMovement.findMany({
        where: { date: { gte: from, lte: to }, type: { in: ["Ingreso", "Egreso"] } },
        include: {
          category: true,
          origin: true,
          provider: true,
          partner: true,
          lender: true,
          project: { include: { spv: true } },
          account: { include: { spv: true } },
          documents: true,
        },
        orderBy: { date: "asc" },
      }),
      prisma.finSPV.findMany(),
    ]);

    // Agrupar por SPV: la del proyecto del movimiento; si no, la de la cuenta; si no, "CORPORATIVO"
    const groups = new Map<string, typeof movements>();
    for (const m of movements) {
      const spvName = m.project?.spv?.name ?? m.account?.spv?.name ?? "CORPORATIVO_SIN_SPV";
      if (!groups.has(spvName)) groups.set(spvName, []);
      groups.get(spvName)!.push(m);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="paquete-contador-${year}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    for (const [spvName, movs] of groups) {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Restrepo Acosta Global Holding";

      // ── Hoja 1: Resumen por bucket fiscal ──
      const summary = wb.addWorksheet("Resumen fiscal");
      summary.columns = [
        { header: "Bucket fiscal", key: "bucket", width: 42 },
        { header: "Total egresos", key: "total", width: 18, style: { numFmt: '"$"#,##0.00' } },
        { header: "# Movimientos", key: "count", width: 14 },
        { header: "Sin soporte", key: "nosupport", width: 12 },
      ];
      const byBucket = new Map<string, { total: number; count: number; nosupport: number }>();
      for (const m of movs.filter(x => x.type === "Egreso")) {
        const bucket = resolveTaxBucket(m.category);
        const b = byBucket.get(bucket) ?? { total: 0, count: 0, nosupport: 0 };
        b.total += m.amount; b.count += 1;
        if (m.documents.length === 0) b.nosupport += 1;
        byBucket.set(bucket, b);
      }
      for (const [bucket, b] of [...byBucket.entries()].sort((a, c) => c[1].total - a[1].total)) {
        summary.addRow({ bucket, total: b.total, count: b.count, nosupport: b.nosupport });
      }
      summary.getRow(1).font = { bold: true };
      const totalRow = summary.addRow({
        bucket: "TOTAL EGRESOS",
        total: [...byBucket.values()].reduce((s, b) => s + b.total, 0),
        count: [...byBucket.values()].reduce((s, b) => s + b.count, 0),
        nosupport: [...byBucket.values()].reduce((s, b) => s + b.nosupport, 0),
      });
      totalRow.font = { bold: true };

      // ── Hoja 2: Egresos detalle ──
      const eg = wb.addWorksheet("Egresos");
      eg.columns = [
        { header: "Fecha", key: "date", width: 12, style: { numFmt: "yyyy-mm-dd" } },
        { header: "Concepto", key: "concept", width: 44 },
        { header: "Categoría interna", key: "cat", width: 28 },
        { header: "Bucket fiscal", key: "bucket", width: 38 },
        { header: "Monto", key: "amount", width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: "Proveedor", key: "provider", width: 24 },
        { header: "Proyecto", key: "project", width: 22 },
        { header: "Cuenta", key: "account", width: 20 },
        { header: "Soporte", key: "support", width: 9 },
        { header: "Link soporte", key: "link", width: 46 },
      ];
      for (const m of movs.filter(x => x.type === "Egreso")) {
        eg.addRow({
          date: m.date,
          concept: m.concept,
          cat: m.category?.name ?? "—",
          bucket: resolveTaxBucket(m.category),
          amount: m.amount,
          provider: m.provider?.name ?? "—",
          project: m.project?.name ?? "—",
          account: m.account?.name ?? "—",
          support: m.documents.length > 0 ? "SÍ" : "NO",
          link: m.documents[0]?.url ?? "",
        });
      }
      eg.getRow(1).font = { bold: true };
      eg.autoFilter = "A1:J1";

      // ── Hoja 3: Ingresos ──
      const ing = wb.addWorksheet("Ingresos");
      ing.columns = [
        { header: "Fecha", key: "date", width: 12, style: { numFmt: "yyyy-mm-dd" } },
        { header: "Concepto", key: "concept", width: 44 },
        { header: "Origen", key: "origin", width: 28 },
        { header: "Monto", key: "amount", width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: "Socio", key: "partner", width: 20 },
        { header: "Lender", key: "lender", width: 20 },
        { header: "Proyecto", key: "project", width: 22 },
        { header: "Cuenta", key: "account", width: 20 },
        { header: "¿Equity?", key: "eq", width: 9 },
        { header: "¿Préstamo?", key: "loan", width: 10 },
      ];
      for (const m of movs.filter(x => x.type === "Ingreso")) {
        ing.addRow({
          date: m.date, concept: m.concept, origin: m.origin?.name ?? "—", amount: m.amount,
          partner: m.partner?.fullName ?? "—", lender: m.lender?.name ?? "—",
          project: m.project?.name ?? "—", account: m.account?.name ?? "—",
          eq: m.isEquity ? "SÍ" : "NO", loan: m.isLoan ? "SÍ" : "NO",
        });
      }
      ing.getRow(1).font = { bold: true };
      ing.autoFilter = "A1:J1";

      const buf = await wb.xlsx.writeBuffer();
      const safe = spvName.replace(/[^a-zA-Z0-9_-]+/g, "_");
      archive.append(Buffer.from(buf), { name: `${year}/${safe}.xlsx` });
    }

    const readme = [
      `PAQUETE ANUAL PARA EL CONTADOR — ${year}`,
      `Generado: ${new Date().toISOString()}`,
      ``,
      `Un archivo Excel por SPV (${[...groups.keys()].join(", ")}).`,
      `Cada Excel contiene:`,
      `  1. Resumen fiscal — egresos agrupados por bucket fiscal US (empezar por aquí)`,
      `  2. Egresos — detalle con proveedor, proyecto, soporte y link al documento`,
      `  3. Ingresos — detalle con origen, marcando equity y desembolsos de préstamo`,
      ``,
      `NOTAS PARA EL CONTADOR:`,
      `- "Bucket fiscal" es una clasificación preliminar hecha por el sistema;`,
      `  la clasificación final para la declaración es criterio del CPA.`,
      `- Los ingresos marcados ¿Equity?=SÍ son aportes de capital de socios (no ingreso gravable).`,
      `- Los ingresos marcados ¿Préstamo?=SÍ son desembolsos de deuda (no ingreso gravable).`,
      `- La columna "Sin soporte" del resumen indica movimientos sin factura adjunta.`,
    ].join("\n");
    archive.append(readme, { name: `${year}/LEEME.txt` });

    await archive.finalize();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ data: null, error: String(e) });
  }
});

export default router;
