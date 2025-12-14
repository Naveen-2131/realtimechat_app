# Multi-stage build for Node.js backend
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Development dependencies for build
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Production image
FROM base AS runner
WORKDIR /app

# Set environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy dependencies
COPY --from=deps --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app .

# Create uploads directory
RUN mkdir -p uploads && chown expressjs:nodejs uploads

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "server.js"]
