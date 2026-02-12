# ---- Stage 1: Dependencies ----
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/

RUN npm ci

# ---- Stage 2: Builder ----
FROM deps AS builder
WORKDIR /app

COPY . .

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build all workspaces (db, web, api)
RUN npm run build --workspace=@sleepassured/db
RUN npm run build --workspace=@sleepassured/web
RUN npm run build --workspace=@sleepassured/api

# Point db package to compiled JS so the runner doesn't need .ts
RUN node -e "\
const fs = require('fs');\
const p = JSON.parse(fs.readFileSync('./packages/db/package.json', 'utf8'));\
p.main = './dist/index.js';\
p.exports = { '.': './dist/index.js' };\
fs.writeFileSync('./packages/db/package.json', JSON.stringify(p, null, 2));"

# ---- Stage 3: Runner ----
FROM node:22-slim AS runner

# Prisma needs OpenSSL for database connections
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the full node_modules with workspace symlinks from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy db package (compiled JS + patched package.json + prisma)
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Copy compiled API
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy built web frontend
COPY --from=builder /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production

EXPOSE ${PORT:-3000}

CMD npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma && node apps/api/dist/index.js
