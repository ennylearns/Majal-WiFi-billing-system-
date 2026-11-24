# Use Node.js 18 Alpine image
FROM node:18-alpine

# Install curl for health check and openssl for WireGuard key generation
RUN apk add --no-cache curl openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (dev needed for prisma CLI and tsc build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Remove dev dependencies to slim the image
RUN npm prune --production

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Run migrations then start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]