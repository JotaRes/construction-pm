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
const uploadDir = path_1.default.join(__dirname, '../../uploads/item-docs');
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
const storage = multer_1.default.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype))
            return cb(null, true);
        cb(new Error(`Tipo no permitido: ${file.mimetype}. Use PDF, JPG o PNG.`));
    },
});
router.get('/:itemId/documents', async (req, res) => {
    try {
        const docs = await prisma.itemDocument.findMany({
            where: { itemId: req.params.itemId },
            orderBy: { createdAt: 'asc' },
        });
        res.json({ data: docs, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.post('/:itemId/documents', upload.single('file'), async (req, res) => {
    try {
        const { type = 'OTRO', name, vendor, amount, notes } = req.body;
        const fileUrl = req.file ? `/api/uploads/item-docs/${req.file.filename}` : null;
        const doc = await prisma.itemDocument.create({
            data: {
                itemId: req.params.itemId,
                type,
                name: name || req.file?.originalname || 'Documento',
                vendor: vendor || null,
                amount: amount ? parseFloat(amount) : null,
                fileUrl,
                notes: notes || null,
            },
        });
        res.json({ data: doc, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.delete('/:itemId/documents/:docId', async (req, res) => {
    try {
        const doc = await prisma.itemDocument.findUnique({ where: { id: req.params.docId } });
        if (doc?.fileUrl) {
            const filePath = path_1.default.join(__dirname, '../../uploads', doc.fileUrl.replace('/api/uploads/', ''));
            if (fs_1.default.existsSync(filePath))
                fs_1.default.unlinkSync(filePath);
        }
        await prisma.itemDocument.delete({ where: { id: req.params.docId } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
