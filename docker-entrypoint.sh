#!/bin/sh
set -e

# Sync Prisma Schema ke Database (berlaku untuk DB Container maupun DB Eksternal)
echo "[SIGS Entrypoint] Synchronizing database schema..."
npx prisma db push --skip-generate || echo "[SIGS Entrypoint] Warning: DB sync skipped or database unavailable."

echo "[SIGS Entrypoint] Starting Next.js Standalone server..."
exec "$@"
