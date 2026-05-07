"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const budgetLinesTemplate_1 = require("./data/budgetLinesTemplate");
const prisma = new client_1.PrismaClient();
const LOTE87_APROBADOS = {
    '04.01': { apr: 2546.54, presentado: 3000 },
    '04.02': { apr: 2970.96, presentado: 3500 },
    '04.03': { apr: 10186.15, presentado: 12000 },
    '06.01': { apr: 16976.92, presentado: 20000 },
    '06.02': { apr: 11968.73, presentado: 14100 },
    '06.03': { apr: 4583.77, presentado: 5400 },
    '06.04': { apr: 1273.27, presentado: 1500 },
    '07.01': { apr: 7979.15, presentado: 9400 },
    '07.02': { apr: 1612.81, presentado: 1900 },
    '07.03': { apr: 2037.23, presentado: 2400 },
    '07.04': { apr: 2970.96, presentado: 3500 },
    '07.05': { apr: 0, presentado: 0 },
    '07.06': { apr: 15279.23, presentado: 18000 },
    '07.07': { apr: 33614.30, presentado: 39600 },
    '04.04': { apr: 4244.23, presentado: 5000 },
    '04.05': { apr: 12902.18, presentado: 15200 },
    '04.06': { apr: 2546.54, presentado: 3000 },
    '04.07': { apr: 2970.96, presentado: 3500 },
};
async function main() {
    const project = await prisma.project.findFirst({ where: { name: { contains: 'LOTE 87' } } });
    if (!project) {
        console.log('Lote 87 not found');
        return;
    }
    await prisma.budgetLine.deleteMany({ where: { projectId: project.id } });
    let order = 0;
    for (const t of budgetLinesTemplate_1.BUDGET_LINES_TEMPLATE) {
        const extra = LOTE87_APROBADOS[t.itemCode];
        await prisma.budgetLine.create({
            data: {
                projectId: project.id,
                divCode: t.divCode,
                divName: t.divName,
                itemCode: t.itemCode,
                description: t.description,
                unit: t.unit,
                vendor: t.vendor || null,
                valorInicial: t.valorInicial,
                valorPresentado: extra?.presentado ?? t.valorInicial,
                valorAprobado: extra?.apr ?? 0,
                pagadoSubs: 0,
                order: order++,
            },
        });
    }
    console.log(`✓ Seeded ${order} budget lines for ${project.name}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
