"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const budgetLinesTemplate_1 = require("../data/budgetLinesTemplate");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:id/construction-budget', async (req, res) => {
    try {
        const lines = await prisma.budgetLine.findMany({
            where: { projectId: req.params.id },
            orderBy: { order: 'asc' },
        });
        res.json({ data: lines, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/construction-budget/:id', async (req, res) => {
    try {
        const line = await prisma.budgetLine.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: line, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
// Init budget lines for a new project from template
router.post('/:id/construction-budget/init', async (req, res) => {
    try {
        await prisma.budgetLine.deleteMany({ where: { projectId: req.params.id } });
        let order = 0;
        for (const t of budgetLinesTemplate_1.BUDGET_LINES_TEMPLATE) {
            await prisma.budgetLine.create({
                data: {
                    projectId: req.params.id,
                    divCode: t.divCode,
                    divName: t.divName,
                    itemCode: t.itemCode,
                    description: t.description,
                    unit: t.unit,
                    vendor: t.vendor || null,
                    valorInicial: t.valorInicial,
                    valorPresentado: 0,
                    valorAprobado: 0,
                    pagadoSubs: 0,
                    order: order++,
                },
            });
        }
        res.json({ data: { count: order }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
