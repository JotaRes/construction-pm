"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const archiver_1 = __importDefault(require("archiver"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (_req, res) => {
    try {
        // Export full database snapshot
        const [projects, priceRefs] = await Promise.all([
            prisma.project.findMany({
                include: {
                    phases: { include: { items: { include: { documents: true } } } },
                    draws: true,
                    partners: true,
                    providers: { include: { quotes: true } },
                    notes: true,
                    files: true,
                    inspections: true,
                    tasks: true,
                    budgetLines: true,
                },
            }),
            prisma.priceRef.findMany(),
        ]);
        const dbSnapshot = JSON.stringify({ projects, priceRefs, exportedAt: new Date().toISOString(), version: '1.0' }, null, 2);
        const date = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="construction-pm-backup-${date}.zip"`);
        const archive = (0, archiver_1.default)('zip', { zlib: { level: 6 } });
        archive.on('error', (err) => { throw err; });
        archive.pipe(res);
        // Database data
        archive.append(dbSnapshot, { name: 'data/database.json' });
        // Source code — backend
        const backendDir = path_1.default.join(__dirname, '../..');
        const repoRoot = path_1.default.join(backendDir, '..');
        const addDirIfExists = (src, dest) => {
            if (fs_1.default.existsSync(src))
                archive.directory(src, dest);
        };
        const addFileIfExists = (src, dest) => {
            if (fs_1.default.existsSync(src))
                archive.file(src, { name: dest });
        };
        addDirIfExists(path_1.default.join(backendDir, 'src'), 'code/backend/src');
        addDirIfExists(path_1.default.join(backendDir, 'prisma'), 'code/backend/prisma');
        addFileIfExists(path_1.default.join(backendDir, 'package.json'), 'code/backend/package.json');
        addFileIfExists(path_1.default.join(backendDir, 'tsconfig.json'), 'code/backend/tsconfig.json');
        addFileIfExists(path_1.default.join(repoRoot, 'render.yaml'), 'code/render.yaml');
        // Source code — frontend
        addDirIfExists(path_1.default.join(repoRoot, 'frontend/src'), 'code/frontend/src');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/package.json'), 'code/frontend/package.json');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/tsconfig.json'), 'code/frontend/tsconfig.json');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/vite.config.ts'), 'code/frontend/vite.config.ts');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/tailwind.config.js'), 'code/frontend/tailwind.config.js');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/index.html'), 'code/frontend/index.html');
        await archive.finalize();
    }
    catch (e) {
        if (!res.headersSent)
            res.status(500).json({ error: String(e) });
    }
});
exports.default = router;
