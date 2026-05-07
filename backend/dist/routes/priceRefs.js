"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (_req, res) => {
    try {
        const refs = await prisma.priceRef.findMany({
            orderBy: [{ category: 'asc' }, { description: 'asc' }],
        });
        res.json({ data: refs, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/', async (req, res) => {
    try {
        const ref = await prisma.priceRef.create({ data: req.body });
        res.json({ data: ref, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const ref = await prisma.priceRef.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: ref, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await prisma.priceRef.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
