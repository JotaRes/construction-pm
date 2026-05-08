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
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const drawPdfDir = path_1.default.join(__dirname, '../../uploads/draw-pdfs');
if (!fs_1.default.existsSync(drawPdfDir))
    fs_1.default.mkdirSync(drawPdfDir, { recursive: true });
const ALLOWED_MIME = [
    'application/pdf',
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];
const storage = multer_1.default.diskStorage({
    destination: drawPdfDir,
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        cb(null, `${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.includes(file.mimetype))
            return cb(null, true);
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Use PDF, JPG o PNG.`));
    },
});
function parseMoney(str) {
    return parseFloat(str.replace(/[$,\s]/g, '')) || 0;
}
function normalizeDate(str) {
    if (!str)
        return null;
    // Strip any trailing time portion (e.g. "3/12/2026 9:53 AM" → "3/12/2026")
    const clean = str.trim().split(/\s/)[0];
    const parts = clean.split(/[\/\-]/);
    if (parts.length === 3) {
        const [m, d, y] = parts;
        const year = y.length === 2 ? `20${y}` : y;
        const dt = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
        if (!isNaN(dt.getTime()))
            return dt.toISOString();
    }
    return null;
}
function parseDrawText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    // ── Draw number: "Draw #1", "Draw No. 1", "Draw 1", "Draw#1" ──
    const drawNum = t.match(/Draw\s*(?:#|No\.?)?\s*(\d+)/i);
    if (drawNum)
        result.drawNumber = parseInt(drawNum[1]);
    // ── Trinity dates — label immediately followed by date (no space or with space/colon) ──
    const dp = '(\\d{1,2}/\\d{1,2}/\\d{4})';
    const sep = '[:\\s]*'; // optional colon or spaces between label and date
    const ordered = t.match(new RegExp(`Date\\s*Ordered${sep}${dp}`, 'i'));
    if (ordered)
        result.fechaSolicitud = normalizeDate(ordered[1]);
    const inspected = t.match(new RegExp(`Date\\s*Inspected${sep}${dp}`, 'i'));
    if (inspected)
        result.fechaInspeccion = normalizeDate(inspected[1]);
    // "Date Completed" = Trinity report finish date (closest to wire date)
    const completed = t.match(new RegExp(`Date\\s*Completed${sep}${dp}`, 'i'));
    if (completed)
        result.fechaWire = normalizeDate(completed[1]);
    // ── Fallback dates for non-Trinity PDFs ──
    const dp2 = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})';
    if (!result.fechaSolicitud) {
        const r = t.match(new RegExp(`(?:request(?:ed)?|submit(?:ted)?|date\\s*of\\s*request)\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'));
        if (r)
            result.fechaSolicitud = normalizeDate(r[1]);
    }
    if (!result.fechaInspeccion) {
        const r = t.match(new RegExp(`inspect(?:ion)?\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'));
        if (r)
            result.fechaInspeccion = normalizeDate(r[1]);
    }
    if (!result.fechaWire) {
        const r = t.match(new RegExp(`wire(?:d)?\\s*(?:date)?\\s*:?\\s*${dp2}`, 'i'));
        if (r)
            result.fechaWire = normalizeDate(r[1]);
    }
    // ── Trinity TOTAL row ─────────────────────────────────────
    // The last XX.XX%  $XX,XXX.XX pair in the total row = "This Inspection %" + "Current Available"
    // Values may be space-separated or concatenated. We try several row labels.
    const totalRowCandidates = [
        t.match(/TOTAL\s+DIRECT\s+COSTS[^©\n]*/i)?.[0],
        t.match(/TOTAL\s+ALL\s+COSTS[^©\n]*/i)?.[0],
        t.match(/GRAND\s+TOTAL[^©\n]*/i)?.[0],
        t.match(/TOTALS?[^©\n]{0,30}COSTS?[^©\n]*/i)?.[0],
    ];
    const totalRowStr = totalRowCandidates.find(s => s && s.length > 10) ?? '';
    if (totalRowStr) {
        // Allow optional spaces between % and $ (some PDFs have a space, some don't)
        const pairs = [...totalRowStr.matchAll(/(\d+\.\d{2})\s*%\s*\$\s*([\d,]+\.\d{2})/g)];
        if (pairs.length > 0) {
            const last = pairs[pairs.length - 1];
            result.elegibleTrinity = parseMoney(last[2]);
            result.montoSolicitado = parseMoney(last[2]);
            result.porcentajeFunded = parseFloat(last[1]) / 100;
        }
    }
    // ── Fallback: generic patterns for non-Trinity PDFs ──
    const mp = '\\$?([\\d,]+\\.?\\d*)';
    if (!result.montoSolicitado) {
        const r = t.match(new RegExp(`(?:amount\\s*requested|total\\s*requested|requested\\s*amount)\\s*:?\\s*${mp}`, 'i'));
        if (r)
            result.montoSolicitado = parseMoney(r[1]);
    }
    if (!result.elegibleTrinity) {
        const r = t.match(new RegExp(`(?:eligible|trinity\\s*eligible|approved\\s*amount|amount\\s*eligible)\\s*:?\\s*${mp}`, 'i'));
        if (r)
            result.elegibleTrinity = parseMoney(r[1]);
    }
    if (!result.netWire) {
        const r = t.match(new RegExp(`(?:net\\s*wire|wire\\s*amount|amount\\s*wired|net\\s*amount)\\s*:?\\s*${mp}`, 'i'));
        if (r)
            result.netWire = parseMoney(r[1]);
    }
    if (!result.porcentajeFunded) {
        const r = t.match(/(?:percent(?:age)?\s*funded|funded\s*%)\s*:?\s*(\d+\.?\d*)/i);
        if (r)
            result.porcentajeFunded = parseFloat(r[1]) / 100;
    }
    return result;
}
function parseHUDText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const mp = '\\$?([\\d,]+\\.?\\d*)';
    const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})';
    // Settlement / Closing Date — HUD-1 and Closing Disclosure (CD) both
    const settleDate = t.match(new RegExp(`(?:settlement|closing)\\s*date\\s*:?\\s*${dp}`, 'i')) ??
        t.match(new RegExp(`date\\s*of\\s*(?:settlement|closing)\\s*:?\\s*${dp}`, 'i')) ??
        t.match(new RegExp(`date\\s*issued\\s*:?\\s*${dp}`, 'i'));
    if (settleDate)
        result.settlementDate = normalizeDate(settleDate[1]);
    // Loan Amount
    const loanAmt = t.match(new RegExp(`loan\\s*amount\\s*:?\\s*${mp}`, 'i'));
    if (loanAmt)
        result.loanAmount = parseMoney(loanAmt[1]);
    // Cash at Settlement (HUD-1) / Cash to Close (CD) / Cash from/to Borrower
    const cash = t.match(new RegExp(`cash\\s*(?:at|to|from)?\\s*(?:close|settlement|borrower)\\s*:?\\s*${mp}`, 'i')) ??
        t.match(new RegExp(`(?:total\\s*)?(?:cash|amount)\\s*(?:due\\s*)?(?:from|to)\\s*borrower\\s*:?\\s*${mp}`, 'i'));
    if (cash)
        result.cashAtSettlement = parseMoney(cash[1]);
    // Total Closing Costs / Total Settlement Charges
    const closing = t.match(new RegExp(`(?:total\\s*)?closing\\s*costs?\\s*(?:\\([A-Z]\\)\\s*)?:?\\s*${mp}`, 'i')) ??
        t.match(new RegExp(`(?:total\\s*)?settlement\\s*charges?\\s*:?\\s*${mp}`, 'i'));
    if (closing)
        result.closingCosts = parseMoney(closing[1]);
    // Interest Rate (if present in Closing Disclosure)
    const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i);
    if (rate)
        result.interestRate = parseFloat(rate[1]) / 100;
    // Loan Term
    const term = t.match(/loan\s*term\s*:?\s*(\d+)\s*(?:months?|mo\.?|years?|yr\.?)/i);
    if (term) {
        const termText = term[0].toLowerCase();
        const n = parseInt(term[1]);
        result.loanTermMonths = termText.includes('year') ? n * 12 : n;
    }
    return result;
}
router.get('/:projectId/draws', async (req, res) => {
    try {
        const draws = await prisma.draw.findMany({
            where: { projectId: req.params.projectId },
            orderBy: { drawNumber: 'asc' },
        });
        res.json({ data: draws, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
router.patch('/:id', async (req, res) => {
    try {
        const draw = await prisma.draw.update({
            where: { id: req.params.id },
            data: req.body,
        });
        res.json({ data: draw, error: null });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
// Handle multer errors cleanly
function handleUpload(req, res, next) {
    upload.single('pdf')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            return res.status(400).json({ data: null, error: `Error de archivo: ${err.message}` });
        }
        if (err) {
            return res.status(400).json({ data: null, error: String(err) });
        }
        next();
    });
}
router.post('/:projectId/draws/parse-pdf', handleUpload, async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ data: null, error: 'No se subió ningún archivo' });
        const fileUrl = `/api/uploads/draw-pdfs/${req.file.filename}`;
        const isImage = req.file.mimetype.startsWith('image/');
        if (isImage) {
            // Image uploaded — store and return empty parsed fields for manual entry
            return res.json({
                data: {
                    parsed: { pdfUrl: fileUrl },
                    preview: null,
                    isImage: true,
                    imageUrl: fileUrl,
                },
                error: null,
            });
        }
        // PDF — parse text
        const buffer = fs_1.default.readFileSync(req.file.path);
        const pdfData = await pdfParse(buffer);
        const parsed = parseDrawText(pdfData.text);
        parsed.pdfUrl = fileUrl;
        res.json({
            data: {
                parsed,
                preview: pdfData.text.slice(0, 1500),
                isImage: false,
                imageUrl: null,
            },
            error: null,
        });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
function parseLoanText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const mp = '\\$?([\\d,]+\\.?\\d*)';
    const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})';
    const lenderMatch = t.match(/(?:lender|mortgagee|bank)\s*(?:name)?\s*:?\s*([A-Za-z][A-Za-z0-9\s,\.&]+?)(?=\s{2,}|\s*\n|,|\.|LLC|Inc|Corp|Holdings)/i);
    if (lenderMatch)
        result.lender = lenderMatch[1].trim();
    const loanNum = t.match(/(?:loan\s*(?:number|#|no\.?|num)|commitment\s*(?:number|#|no\.?))\s*:?\s*([A-Z0-9\-]+)/i);
    if (loanNum)
        result.loanNumber = loanNum[1].trim();
    const loanAmt = t.match(new RegExp(`(?:loan|principal|commitment|face|construction)\\s*(?:loan\\s*)?amount\\s*:?\\s*${mp}`, 'i'));
    if (loanAmt)
        result.loanAmount = parseMoney(loanAmt[1]);
    const rate = t.match(/interest\s*rate\s*:?\s*(\d+\.?\d*)\s*%/i);
    if (rate)
        result.interestRate = parseFloat(rate[1]) / 100;
    const term = t.match(/(?:loan\s*)?term\s*:?\s*(\d+)\s*(?:months?|mo\.?)/i);
    if (term)
        result.loanTermMonths = parseInt(term[1]);
    const holdback = t.match(new RegExp(`(?:holdback|retainage|held\\s*back|construction\\s*holdback)\\s*:?\\s*${mp}`, 'i'));
    if (holdback)
        result.holdback = parseMoney(holdback[1]);
    const day1 = t.match(new RegExp(`(?:initial\\s*disbursement|day\\s*1|at\\s*closing|initial\\s*advance|first\\s*draw)\\s*:?\\s*${mp}`, 'i'));
    if (day1)
        result.day1Disbursement = parseMoney(day1[1]);
    const reserve = t.match(new RegExp(`interest\\s*reserve\\s*:?\\s*${mp}`, 'i'));
    if (reserve)
        result.interestReserve = parseMoney(reserve[1]);
    const closingDate = t.match(new RegExp(`(?:commitment|closing|settlement)\\s*date\\s*:?\\s*${dp}`, 'i'));
    if (closingDate)
        result.settlementDate = normalizeDate(closingDate[1]);
    return result;
}
function parseSurveyText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const parcel = t.match(/(?:parcel\s*(?:id|number|#|no\.?)|tax\s*(?:id|map|parcel|pin))\s*:?\s*([A-Z0-9\-\.]+)/i);
    if (parcel)
        result.parcelId = parcel[1].trim();
    const acres = t.match(/(\d+\.?\d*)\s*(?:acres?|ac\.?)\b/i);
    if (acres)
        result.lotAcres = parseFloat(acres[1]);
    const addr = t.match(/(?:property\s*(?:address|location|described\s*as)|located\s*at|premises)\s*:?\s*(\d+[^,\n]{5,60})/i);
    if (addr)
        result.address = addr[1].trim();
    const countyMatch = t.match(/([A-Za-z]+)\s+county/i);
    if (countyMatch)
        result.county = countyMatch[1];
    return result;
}
function parsePlansText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const heated = t.match(/(?:heated|conditioned|living|habitable)\s*(?:area|square\s*feet|sf|sqft|sq\.?\s*ft\.?)\s*:?\s*([\d,]+)/i);
    if (heated)
        result.sfHeated = parseInt(heated[1].replace(/,/g, ''));
    const garage = t.match(/(?:garage|attached\s*garage)\s*(?:area|sf|sqft|sq\.?\s*ft\.?)?\s*:?\s*([\d,]+)/i);
    if (garage)
        result.sfGarage = parseInt(garage[1].replace(/,/g, ''));
    const porch = t.match(/(?:porch|deck|covered\s*porch|screened)\s*(?:area|sf|sqft|sq\.?\s*ft\.?)?\s*:?\s*([\d,]+)/i);
    if (porch)
        result.sfPorches = parseInt(porch[1].replace(/,/g, ''));
    const beds = t.match(/(\d+)\s*(?:bedroom|bed\s*room|br)s?\b/i);
    if (beds)
        result.bedrooms = parseInt(beds[1]);
    const baths = t.match(/(\d+(?:\.\d)?)\s*(?:bathroom|bath\s*room|ba)s?\b/i);
    if (baths)
        result.bathrooms = baths[1];
    const found = t.match(/foundation\s*(?:type|system)?\s*:?\s*(slab|crawl\s*space|basement|pier)/i);
    if (found)
        result.foundationType = found[1].trim();
    return result;
}
function parsePermitText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const dp = '(\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4})';
    const permitNum = t.match(/permit\s*(?:number|#|no\.?|num)\s*:?\s*([A-Z0-9\-]+)/i);
    if (permitNum)
        result.permitNumber = permitNum[1].trim();
    const issued = t.match(new RegExp(`(?:issue[d]?\\s*date|date\\s*issued|permit\\s*date|approved)\\s*:?\\s*${dp}`, 'i'));
    if (issued)
        result.permitIssued = normalizeDate(issued[1]);
    const expires = t.match(new RegExp(`(?:expir(?:es?|ation)\\s*date|valid\\s*(?:through|until|to)|expiration)\\s*:?\\s*${dp}`, 'i'));
    if (expires)
        result.permitExpires = normalizeDate(expires[1]);
    const countyMatch = t.match(/([A-Za-z]+)\s+county/i);
    if (countyMatch)
        result.county = countyMatch[1];
    return result;
}
function parseAppraisalText(text) {
    const result = {};
    const t = text.replace(/\n/g, ' ');
    const mp = '\\$?([\\d,]+\\.?\\d*)';
    const arv = t.match(new RegExp(`(?:market\\s*value|appraised\\s*(?:value|amount)|as\\s*completed\\s*value|after\\s*repair\\s*value|arv|indicated\\s*value)\\s*:?\\s*${mp}`, 'i'));
    if (arv)
        result.arv = parseMoney(arv[1]);
    const gla = t.match(/(?:gla|gross\s*living\s*area|gross\s*livable|net\s*livable)\s*:?\s*([\d,]+)/i);
    if (gla)
        result.sfHeated = parseInt(gla[1].replace(/,/g, ''));
    const target = t.match(new RegExp(`(?:estimated\\s*value|list(?:ing)?\\s*(?:price|value)|as\\s*is\\s*value)\\s*:?\\s*${mp}`, 'i'));
    if (target)
        result.targetListingPrice = parseMoney(target[1]);
    return result;
}
router.post('/:projectId/docs/parse-pdf', handleUpload, async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ data: null, error: 'No se subió ningún archivo' });
        const fileUrl = `/api/uploads/draw-pdfs/${req.file.filename}`;
        const isImage = req.file.mimetype.startsWith('image/');
        if (isImage) {
            return res.json({
                data: { parsed: { pdfUrl: fileUrl }, preview: null, isImage: true, imageUrl: fileUrl },
                error: null,
            });
        }
        const buffer = fs_1.default.readFileSync(req.file.path);
        const pdfData = await pdfParse(buffer);
        const docType = req.query.type || 'HUD';
        const parserMap = {
            HUD: parseHUDText,
            LOAN: parseLoanText,
            SURVEY: parseSurveyText,
            PLANS: parsePlansText,
            PERMIT: parsePermitText,
            APPRAISAL: parseAppraisalText,
        };
        const parser = parserMap[docType.toUpperCase()];
        const parsed = parser ? parser(pdfData.text) : {};
        parsed.pdfUrl = fileUrl;
        res.json({
            data: { parsed, preview: pdfData.text.slice(0, 1500), isImage: false, imageUrl: null },
            error: null,
        });
    }
    catch (e) {
        res.status(500).json({ data: null, error: String(e) });
    }
});
exports.default = router;
