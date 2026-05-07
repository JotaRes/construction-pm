"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:projectId/providers', async (req, res) => {
    try {
        const providers = await prisma.provider.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { name: 'asc' },
        });
        res.json({ data: providers, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:projectId/providers', async (req, res) => {
    try {
        const provider = await prisma.provider.create({
            data: { ...req.body, projectId: req.params.projectId },
        });
        res.json({ data: provider, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/providers/:id', async (req, res) => {
    try {
        const provider = await prisma.provider.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: provider, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:projectId/providers/:id', async (req, res) => {
    try {
        await prisma.provider.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
