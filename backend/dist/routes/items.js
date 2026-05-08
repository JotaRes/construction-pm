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
        const { activity, description, responsable, unit, esNA, completado, valorPresupuestado, valorEjecutado, providerId, estado, fechaInicioReal, fechaFinReal, observaciones, order, } = req.body;
        const data = {};
        if (activity !== undefined)
            data.activity = activity;
        if (description !== undefined)
            data.description = description || null;
        if (responsable !== undefined)
            data.responsable = responsable || null;
        if (unit !== undefined)
            data.unit = unit || null;
        if (esNA !== undefined)
            data.esNA = esNA;
        if (completado !== undefined)
            data.completado = completado;
        if (valorPresupuestado !== undefined)
            data.valorPresupuestado = Number(valorPresupuestado);
        if (valorEjecutado !== undefined)
            data.valorEjecutado = Number(valorEjecutado);
        if (providerId !== undefined)
            data.providerId = providerId || null;
        if (estado !== undefined)
            data.estado = estado;
        if (fechaInicioReal !== undefined)
            data.fechaInicioReal = fechaInicioReal ? new Date(fechaInicioReal) : null;
        if (fechaFinReal !== undefined)
            data.fechaFinReal = fechaFinReal ? new Date(fechaFinReal) : null;
        if (observaciones !== undefined)
            data.observaciones = observaciones || null;
        if (order !== undefined)
            data.order = Number(order);
        const item = await prisma.item.update({
            where: { id: req.params.id },
            data,
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
