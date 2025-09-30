# Multi-stage build for React Native Mobile App
FROM node:18-alpine as builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY mobile/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY mobile/app ./app
COPY mobile/app.json ./
COPY mobile/babel.config.js ./
COPY mobile/metro.config.js ./
COPY mobile/tsconfig.json ./

# Build the app
RUN npm run build

# Runtime stage for Expo development server
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose Expo development server port
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:19000 || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start Expo development server
CMD ["npx", "expo", "start", "--host", "0.0.0.0"]
