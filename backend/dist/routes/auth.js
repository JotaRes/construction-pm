"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
function getValidToken() {
    const password = process.env.APP_PASSWORD || 'construction2024';
    const secret = process.env.JWT_SECRET || 'pm-secret';
    return crypto_1.default.createHmac('sha256', secret).update(password).digest('hex');
}
router.post('/login', (req, res) => {
    const { password } = req.body;
    if (!password)
        return res.status(400).json({ error: 'Contraseña requerida' });
    if (password !== (process.env.APP_PASSWORD || 'construction2024')) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    res.json({ token: getValidToken() });
});
router.get('/verify', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token)
        return res.status(401).json({ valid: false });
    res.json({ valid: token === getValidToken() });
});
exports.default = router;
