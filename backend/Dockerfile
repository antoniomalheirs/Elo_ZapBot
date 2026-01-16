# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files from backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
COPY backend/prisma.config.ts ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy backend source code
COPY backend/ .

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

# Install production dependencies (ffmpeg for audio, openssl for Prisma, curl for healthcheck)
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install production deps only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma/
COPY backend/prisma.config.ts ./
RUN npx prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create directory for WhatsApp session (will be persisted via Railway volume)
RUN mkdir -p /app/.baileys_auth

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
