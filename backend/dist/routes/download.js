"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const router = (0, express_1.Router)();
const ALLOWED_HOSTS = ['res.cloudinary.com', 'cloudinary.com'];
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const isAllowedHost = (hostname) => ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
const fetchWithRedirects = (url, res, disposition, redirectsLeft) => {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        if (!res.headersSent)
            res.status(400).json({ error: 'Invalid upstream URL' });
        return;
    }
    const client = parsed.protocol === 'http:' ? http_1.default : https_1.default;
    const upstream = client.get(url, (proxyRes) => {
        const status = proxyRes.statusCode ?? 0;
        if (status >= 300 && status < 400 && proxyRes.headers.location) {
            proxyRes.resume();
            if (redirectsLeft <= 0) {
                if (!res.headersSent)
                    res.status(508).json({ error: 'Too many redirects' });
                return;
            }
            const next = new URL(proxyRes.headers.location, url).toString();
            fetchWithRedirects(next, res, disposition, redirectsLeft - 1);
            return;
        }
        if (status < 200 || status >= 400) {
            console.error(`Download proxy upstream ${status} for ${parsed.hostname}${parsed.pathname}`);
            proxyRes.resume();
            if (!res.headersSent)
                res.status(502).json({ error: `Upstream responded ${status}` });
            return;
        }
        const ct = proxyRes.headers['content-type'];
        const cl = proxyRes.headers['content-length'];
        if (ct)
            res.setHeader('Content-Type', ct);
        if (cl)
            res.setHeader('Content-Length', cl);
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.status(200);
        proxyRes.pipe(res);
    });
    upstream.setTimeout(REQUEST_TIMEOUT_MS, () => {
        upstream.destroy(new Error('Upstream timeout'));
    });
    upstream.on('error', (err) => {
        console.error(`Download proxy error for ${parsed.hostname}${parsed.pathname}:`, err.message);
        if (!res.headersSent)
            res.status(502).json({ error: `Upstream error: ${err.message}` });
        else
            res.destroy();
    });
};
router.get('/', (req, res) => {
    const rawUrl = req.query.url;
    const inline = req.query.inline === '1';
    if (!rawUrl) {
        res.status(400).json({ error: 'Missing url parameter' });
        return;
    }
    let parsed;
    try {
        parsed = new URL(rawUrl);
    }
    catch {
        res.status(400).json({ error: 'Invalid URL' });
        return;
    }
    if (!isAllowedHost(parsed.hostname)) {
        res.status(403).json({ error: 'URL host not allowed' });
        return;
    }
    const rawName = decodeURIComponent(parsed.pathname.split('/').pop() ?? 'download');
    const safeName = rawName.replace(/"/g, '');
    const disposition = inline
        ? `inline; filename="${safeName}"`
        : `attachment; filename="${safeName}"`;
    req.on('close', () => {
        if (!res.writableEnded)
            res.destroy();
    });
    fetchWithRedirects(rawUrl, res, disposition, MAX_REDIRECTS);
});
exports.default = router;
