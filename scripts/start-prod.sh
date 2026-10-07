#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is empty. In Render: Environment → Add from Database → umbrella-db → Internal Database URL."
  exit 1
fi

# Clear a failed baseline from a corrupted migration.sql deploy (safe on empty DB).
status_out="$(npx prisma migrate status 2>&1 || true)"
if printf '%s\n' "$status_out" | grep -q '20261007000000_baseline'; then
  if printf '%s\n' "$status_out" | grep -qi 'failed'; then
    echo "Resolving failed baseline migration before retry..."
    npx prisma migrate resolve --rolled-back "20261007000000_baseline"
  fi
fi

npx prisma migrate deploy
exec node dist/src/main.js
