# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

# Install all dependencies
RUN npm ci --workspace=@sleepassured/api --workspace=@sleepassured/db --include-workspace-root

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy source
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api/ ./apps/api/
COPY packages/db/ ./packages/db/

# Generate Prisma client
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma

# Build TypeScript
RUN npm run build --workspace=@sleepassured/api

# Stage 3: Production runtime
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built output and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/package.json ./

# Copy Prisma schema and migrations for runtime migrate
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
