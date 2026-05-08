"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const quoteDir = path_1.default.join(__dirname, '../../uploads/provider-quotes');
if (!fs_1.default.existsSync(quoteDir))
    fs_1.default.mkdirSync(quoteDir, { recursive: true });
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const upload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: quoteDir,
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path_1.default.extname(file.originalname)}`),
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype))
            return cb(null, true);
        cb(new Error(`Tipo no permitido: ${file.mimetype}`));
    },
});
// ── Providers CRUD ──────────────────────────────────────────────
router.get('/:projectId/providers', async (req, res) => {
    try {
        const providers = await prisma.provider.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { name: 'asc' },
            include: { quotes: { orderBy: { createdAt: 'desc' } } },
        });
        res.json({ data: providers, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:projectId/providers', async (req, res) => {
    try {
        const { name, type, phone, email, license, notes } = req.body;
        if (!name?.trim())
            return res.status(400).json({ data: null, error: 'Nombre requerido' });
        const provider = await prisma.provider.create({
            data: {
                projectId: req.params.projectId,
                name: name.trim(),
                type: type?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                license: license?.trim() || null,
                notes: notes?.trim() || null,
            },
            include: { quotes: true },
        });
        res.json({ data: provider, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:projectId/providers/:id', async (req, res) => {
    try {
        const { name, type, phone, email, license, notes } = req.body;
        const provider = await prisma.provider.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(type !== undefined && { type: type?.trim() || null }),
                ...(phone !== undefined && { phone: phone?.trim() || null }),
                ...(email !== undefined && { email: email?.trim() || null }),
                ...(license !== undefined && { license: license?.trim() || null }),
                ...(notes !== undefined && { notes: notes?.trim() || null }),
            },
            include: { quotes: true },
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
// ── Provider Quotes ─────────────────────────────────────────────
router.get('/:projectId/providers/:providerId/quotes', async (req, res) => {
    try {
        const quotes = await prisma.providerQuote.findMany({
            where: { providerId: req.params.providerId },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ data: quotes, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:projectId/providers/:providerId/quotes', upload.single('file'), async (req, res) => {
    try {
        const { description, amount, date, notes } = req.body;
        const fileUrl = req.file ? `/api/uploads/provider-quotes/${req.file.filename}` : null;
        const quote = await prisma.providerQuote.create({
            data: {
                providerId: req.params.providerId,
                description: description || 'Cotización',
                amount: parseFloat(amount) || 0,
                date: date ? new Date(date) : null,
                fileUrl,
                notes: notes || null,
            },
        });
        res.json({ data: quote, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:projectId/providers/:providerId/quotes/:quoteId', async (req, res) => {
    try {
        const quote = await prisma.providerQuote.findUnique({ where: { id: req.params.quoteId } });
        if (quote?.fileUrl) {
            const relative = quote.fileUrl.startsWith('/api/uploads/')
                ? quote.fileUrl.slice('/api/uploads/'.length)
                : quote.fileUrl;
            const fp = path_1.default.join(__dirname, '../../uploads', relative);
            if (fs_1.default.existsSync(fp))
                fs_1.default.unlinkSync(fp);
        }
        await prisma.providerQuote.delete({ where: { id: req.params.quoteId } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
