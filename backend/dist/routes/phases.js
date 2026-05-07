"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/:projectId/phases', async (req, res) => {
    try {
        const phases = await prisma.phase.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { order: 'asc' },
            include: {
                items: {
                    orderBy: { order: 'asc' },
                    include: {
                        provider: true,
                        documents: { select: { id: true, type: true } },
                    },
                },
            },
        });
        res.json({ data: phases, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
