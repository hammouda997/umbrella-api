#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL is empty. In Render: Environment → Add from Database → umbrella-db → Internal Database URL."
  exit 1
fi

npx prisma migrate deploy
exec node dist/src/main.js
