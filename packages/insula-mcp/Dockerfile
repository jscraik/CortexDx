# Insula MCP Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20.11.1-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/insula-mcp/package.json ./packages/insula-mcp/

# Install pnpm
RUN npm install -g pnpm@9.12.2

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/insula-mcp ./packages/insula-mcp
COPY tsconfig.base.json ./

# Build the application
WORKDIR /app/packages/insula-mcp
RUN pnpm build

# Stage 2: Production
FROM node:20.11.1-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tini

# Create non-root user
RUN addgroup -g 1001 -S insula && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G insula -g insula insula

WORKDIR /app

# Copy built application
COPY --from=builder --chown=insula:insula /app/packages/insula-mcp/dist ./dist
COPY --from=builder --chown=insula:insula /app/packages/insula-mcp/package.json ./

# Install production dependencies only
RUN npm install -g pnpm@9.12.2 && \
    pnpm install --prod --frozen-lockfile && \
    npm uninstall -g pnpm && \
    rm -rf /root/.npm /root/.pnpm-store

# Create directories for data persistence
RUN mkdir -p /app/data /app/logs /app/models && \
    chown -R insula:insula /app

# Switch to non-root user
USER insula

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Default command
CMD ["node", "dist/server.js"]
