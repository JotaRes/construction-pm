"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:id/tasks', async (req, res) => {
    try {
        const tasks = await prisma.task.findMany({
            where: { projectId: req.params.id },
            orderBy: [{ done: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
        });
        res.json({ data: tasks, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:id/tasks', async (req, res) => {
    try {
        const count = await prisma.task.count({ where: { projectId: req.params.id } });
        const task = await prisma.task.create({
            data: {
                projectId: req.params.id,
                title: req.body.title ?? 'Nueva tarea',
                responsable: req.body.responsable ?? null,
                priority: req.body.priority ?? 'NORMAL',
                dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
                notes: req.body.notes ?? null,
                order: count,
            },
        });
        res.json({ data: task, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/tasks/:id', async (req, res) => {
    try {
        const task = await prisma.task.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: task, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:projectId/tasks/:id', async (req, res) => {
    try {
        await prisma.task.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
