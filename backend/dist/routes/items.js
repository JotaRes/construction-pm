"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.post('/', async (req, res) => {
    try {
        const { phaseId, activity, unit, valorPresupuestado, responsable, description } = req.body;
        if (!phaseId)
            return res.status(400).json({ data: null, error: 'phaseId required' });
        const phase = await prisma.phase.findUnique({ where: { id: phaseId }, include: { items: true } });
        if (!phase)
            return res.status(404).json({ data: null, error: 'Phase not found' });
        const existingCodes = phase.items.map(i => i.itemCode);
        let idx = phase.items.length + 1;
        let newCode = `${phase.code.replace('F', '')}.A${String(idx).padStart(2, '0')}`;
        while (existingCodes.includes(newCode)) {
            idx++;
            newCode = `${phase.code.replace('F', '')}.A${String(idx).padStart(2, '0')}`;
        }
        const item = await prisma.item.create({
            data: {
                phaseId,
                itemCode: newCode,
                activity: activity ?? 'Nueva actividad',
                unit: unit ?? 'LS',
                valorPresupuestado: valorPresupuestado ?? 0,
                responsable: responsable ?? null,
                description: description ?? null,
                order: phase.items.length,
            },
            include: { provider: true },
        });
        res.json({ data: item, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const item = await prisma.item.update({
            where: { id: req.params.id },
            data: req.body,
            include: { provider: true },
        });
        res.json({ data: item, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await prisma.item.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
