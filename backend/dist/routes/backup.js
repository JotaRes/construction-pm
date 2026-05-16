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
router.get('/', async (req, res) => {
    res.setTimeout(0);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="construction-pm-backup-${date}.zip"`);
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 6 } });
    let aborted = false;
    const abort = (reason) => {
        if (aborted)
            return;
        aborted = true;
        console.warn(`Backup aborted: ${reason}`);
        try {
            archive.abort();
        }
        catch { }
        if (!res.headersSent)
            res.status(500).json({ error: reason });
        else
            res.destroy();
    };
    archive.on('error', (err) => {
        console.error('Backup archive error:', err);
        abort(`archive error: ${err.message}`);
    });
    archive.on('warning', (err) => {
        console.warn('Backup archive warning:', err);
    });
    req.on('close', () => {
        if (!res.writableEnded)
            abort('client closed connection');
    });
    archive.pipe(res);
    try {
        // Lighter query: no nested item.documents (multiplies rows)
        const projects = await prisma.project.findMany({
            include: {
                phases: { include: { items: true } },
                draws: true,
                partners: true,
                providers: { include: { quotes: true } },
                notes: true,
                files: true,
                inspections: true,
                tasks: true,
                budgetLines: true,
            },
        });
        const [priceRefs, itemDocuments] = await Promise.all([
            prisma.priceRef.findMany(),
            prisma.itemDocument.findMany(),
        ]);
        const dbSnapshot = JSON.stringify({
            projects,
            priceRefs,
            itemDocuments,
            exportedAt: new Date().toISOString(),
            version: '1.1',
        }, null, 2);
        archive.append(dbSnapshot, { name: 'data/database.json' });
        // Source code (best-effort: only included when files are present in the deploy)
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
        addDirIfExists(path_1.default.join(repoRoot, 'frontend/src'), 'code/frontend/src');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/package.json'), 'code/frontend/package.json');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/tsconfig.json'), 'code/frontend/tsconfig.json');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/vite.config.ts'), 'code/frontend/vite.config.ts');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/tailwind.config.js'), 'code/frontend/tailwind.config.js');
        addFileIfExists(path_1.default.join(repoRoot, 'frontend/index.html'), 'code/frontend/index.html');
        try {
            await archive.finalize();
        }
        catch (err) {
            abort(`finalize failed: ${err?.message ?? String(err)}`);
        }
    }
    catch (e) {
        abort(`prepare failed: ${e?.message ?? String(e)}`);
    }
});
exports.default = router;
