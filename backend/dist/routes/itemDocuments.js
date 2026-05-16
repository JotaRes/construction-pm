"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("../lib/cloudinary");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
        let fileUrl = null;
        if (req.file) {
            const { url } = await (0, cloudinary_1.uploadToCloudinary)(req.file.buffer, 'construction-pm/item-docs', (0, cloudinary_1.resourceTypeFor)(req.file.mimetype));
            fileUrl = url;
        }
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
            const publicId = (0, cloudinary_1.extractPublicId)(doc.fileUrl);
            if (publicId)
                await (0, cloudinary_1.deleteFromCloudinary)(publicId).catch(() => { });
        }
        await prisma.itemDocument.delete({ where: { id: req.params.docId } });
        res.json({ data: { ok: true }, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
