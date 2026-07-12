#!/bin/sh
# ============================================================
# CREAR UNA MIGRACIÓN NUEVA (sin necesidad de Postgres local)
# Uso:  ./scripts/new-migration.sh nombre_descriptivo
# Genera el SQL diff entre las migraciones existentes y el schema actual.
# Requiere una URL de Postgres "sombra" solo si el diff lo pide; con
# Docker local: docker compose up -d y ya funciona.
# ============================================================
set -e
if [ -z "$1" ]; then
  echo "Uso: ./scripts/new-migration.sh nombre_descriptivo"
  exit 1
fi
STAMP=$(date +%Y%m%d%H%M%S)
DIR="prisma/migrations/${STAMP}_$1"
mkdir -p "$DIR"
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "${SHADOW_DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/shadow}" \
  --script > "$DIR/migration.sql"
echo "✓ Migración creada: $DIR/migration.sql"
echo "  Revísala ANTES de commitear. Si contiene DROP TABLE o DROP COLUMN,"
echo "  verifica que sea intencional — en producción eso elimina datos."
