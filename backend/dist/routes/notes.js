"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:projectId/notes', async (req, res) => {
    try {
        const notes = await prisma.note.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ data: notes, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:projectId/notes', async (req, res) => {
    try {
        const note = await prisma.note.create({
            data: { ...req.body, projectId: req.params.projectId },
        });
        res.json({ data: note, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/notes/:id', async (req, res) => {
    try {
        const note = await prisma.note.update({ where: { id: req.params.id }, data: req.body });
        res.json({ data: note, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:projectId/notes/:id', async (req, res) => {
    try {
        await prisma.note.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
