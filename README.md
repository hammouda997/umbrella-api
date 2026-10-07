# Umbrella API

NestJS + Prisma + Socket.IO. Port `3011`.

## Local

```bash
docker compose up -d postgres
npm install
npx prisma generate
npm run db:migrate
npm run db:bootstrap-admin   # set BOOTSTRAP_ADMIN_* env
npm run start:dev
```

Demo seed (local only — truncates): `npm run seed`

## Production

Always-on host required (Socket.IO). Not serverless.

1. Managed Postgres
2. Deploy this Docker image (`Dockerfile`)
3. `npx prisma migrate deploy`
4. `npm run db:bootstrap-admin` (never seed)
5. Env: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `SWAGGER_ENABLED=false`, `NODE_ENV=production`

Optional: `NAVEX_ENABLED=true` + Navex credentials; `TURN_*` for WebRTC; `SENTRY_DSN`.

Health: `GET /health`

See `../DEPLOY.md` for the full matrix. Render Blueprint: `render.yaml`.
