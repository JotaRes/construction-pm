#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  Construction PM — Arranque local completo
#  Ejecutar desde cualquier lugar:  bash ~/Desktop/CLAUDE/construction-pm/_setup/INICIO_LOCAL.sh
# ─────────────────────────────────────────────────────────────

ROOT="$HOME/Desktop/CLAUDE/construction-pm"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Construction PM — Restrepo Acosta"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Backend ──────────────────────────────────────
echo ""
echo "▶  Iniciando backend (puerto 3001)..."
osascript -e "tell application \"Terminal\"
  do script \"cd \\\"$ROOT/backend\\\" && npm run dev\"
end tell"

sleep 2

# ── 2. Frontend ─────────────────────────────────────
echo "▶  Iniciando frontend (puerto 5173)..."
osascript -e "tell application \"Terminal\"
  do script \"cd \\\"$ROOT/frontend\\\" && npm run dev\"
end tell"

sleep 3

# ── 3. Abrir en navegador ───────────────────────────
echo "▶  Abriendo navegador..."
open "http://localhost:5173"

echo ""
echo "  Backend  → http://localhost:3001"
echo "  Frontend → http://localhost:5173"
echo ""
echo "  Contraseña actual: ver _setup/CONTRASENA.txt"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
