# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r umbrella && useradd -r -g umbrella umbrella
COPY --from=build --chown=umbrella:umbrella /app/package.json /app/package-lock.json ./
COPY --from=build --chown=umbrella:umbrella /app/node_modules ./node_modules
COPY --from=build --chown=umbrella:umbrella /app/dist ./dist
COPY --from=build --chown=umbrella:umbrella /app/prisma ./prisma
COPY --from=build --chown=umbrella:umbrella /app/scripts/start-prod.sh ./scripts/start-prod.sh
RUN chmod +x ./scripts/start-prod.sh
USER umbrella
EXPOSE 3011
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3011)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "./scripts/start-prod.sh"]
