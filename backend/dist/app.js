"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = __importDefault(require("./routes/auth"));
const projects_1 = __importDefault(require("./routes/projects"));
const phases_1 = __importDefault(require("./routes/phases"));
const items_1 = __importDefault(require("./routes/items"));
const draws_1 = __importDefault(require("./routes/draws"));
const providers_1 = __importDefault(require("./routes/providers"));
const inspections_1 = __importDefault(require("./routes/inspections"));
const notes_1 = __importDefault(require("./routes/notes"));
const files_1 = __importDefault(require("./routes/files"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const budgetLines_1 = __importDefault(require("./routes/budgetLines"));
const priceRefs_1 = __importDefault(require("./routes/priceRefs"));
const itemDocuments_1 = __importDefault(require("./routes/itemDocuments"));
const seed_1 = require("./seed");
const backup_1 = __importDefault(require("./routes/backup"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/projects', phases_1.default);
app.use('/api/projects', draws_1.default);
app.use('/api/projects', providers_1.default);
app.use('/api/projects', inspections_1.default);
app.use('/api/projects', notes_1.default);
app.use('/api/projects', files_1.default);
app.use('/api/projects', alerts_1.default);
app.use('/api/projects', tasks_1.default);
app.use('/api/projects', budgetLines_1.default);
app.use('/api/price-refs', priceRefs_1.default);
app.use('/api/items', itemDocuments_1.default);
app.use('/api/items', items_1.default);
app.use('/api/draws', draws_1.default);
app.use('/api/backup', backup_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Serve React frontend from dist/public (production build)
const frontendPath = path_1.default.join(__dirname, '../public');
if (fs_1.default.existsSync(frontendPath)) {
    app.use(express_1.default.static(frontendPath));
    // All non-API routes → React app (client-side routing)
    app.get('*', (_req, res) => {
        res.sendFile(path_1.default.join(frontendPath, 'index.html'));
    });
}
;
(async () => {
    const { PrismaClient } = await Promise.resolve().then(() => __importStar(require('@prisma/client')));
    const prisma = new PrismaClient();
    try {
        await (0, seed_1.seedDatabase)(prisma);
    }
    catch (e) {
        console.error('❌ Seed failed:', e);
    }
    finally {
        await prisma.$disconnect();
    }
    app.listen(PORT, () => {
        console.log(`Construction PM API running on http://localhost:${PORT}`);
    });
})();
exports.default = app;
