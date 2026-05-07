"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:projectId/inspections', async (req, res) => {
    try {
        const inspections = await prisma.inspection.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { order: 'asc' },
        });
        res.json({ data: inspections, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/inspections/:id', async (req, res) => {
    try {
        const inspection = await prisma.inspection.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: inspection, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
