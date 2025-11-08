# Insula MCP Production Dockerfile - Community Edition
# Optimized multi-stage build for minimal image size and fast startup

# Stage 1: Dependencies
FROM node:20.11.1-alpine AS deps

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml ./
COPY packages/insula-mcp/package.json ./packages/insula-mcp/

# Install pnpm globally
RUN npm install -g pnpm@9.12.2

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20.11.1-alpine AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/insula-mcp/node_modules ./packages/insula-mcp/node_modules

# Copy source code
COPY packages/insula-mcp ./packages/insula-mcp
COPY tsconfig.base.json ./
COPY package.json pnpm-lock.yaml ./

# Build the application
WORKDIR /app/packages/insula-mcp
RUN npm install -g pnpm@9.12.2 && pnpm build

# Remove dev dependencies and rebuild for production only
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Production Runtime
FROM node:20.11.1-alpine AS runtime

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    ca-certificates \
    tini \
    dumb-init \
    && apk upgrade --no-cache

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S insula && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G insula -g insula insula

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=insula:insula /app/packages/insula-mcp/dist ./dist
COPY --from=builder --chown=insula:insula /app/packages/insula-mcp/package.json ./
COPY --from=builder --chown=insula:insula /app/packages/insula-mcp/node_modules ./node_modules

# Create directories for data persistence with proper permissions
RUN mkdir -p /app/data /app/logs /app/reports /app/config && \
    chown -R insula:insula /app && \
    chmod 755 /app/data /app/logs /app/reports /app/config

# Set environment variables for optimization
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    INSULA_MCP_TIER=community \
    INSULA_MCP_LOG_LEVEL=info

# Switch to non-root user
USER insula

# Expose HTTP port
EXPOSE 3000

# Enhanced health check with faster intervals
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http=require('http');http.get('http://localhost:3000/health',(r)=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>process.exit(r.statusCode===200&&JSON.parse(d).status==='healthy'?0:1))}).on('error',()=>process.exit(1))"

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command with graceful shutdown support
CMD ["node", "--enable-source-maps", "dist/server.js"]

# Labels for metadata
LABEL org.opencontainers.image.title="Insula MCP Community Edition" \
      org.opencontainers.image.description="MCP diagnostic and development assistant - Community tier" \
      org.opencontainers.image.vendor="brAInwav" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="Apache-2.0"
