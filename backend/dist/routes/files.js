"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:projectId/files', async (req, res) => {
    try {
        const files = await prisma.projectFile.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ data: files, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:projectId/files', async (req, res) => {
    try {
        const file = await prisma.projectFile.create({
            data: { ...req.body, projectId: req.params.projectId },
        });
        res.json({ data: file, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:projectId/files/:id', async (req, res) => {
    try {
        await prisma.projectFile.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
