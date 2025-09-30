# Multi-stage build for Rust Lightning Engine
FROM rust:1.75-slim as builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files first for better caching
COPY backend/rust-engine/Cargo.toml backend/rust-engine/Cargo.lock ./
COPY backend/rust-engine/build.rs ./

# Create proto directory and copy proto files
RUN mkdir -p proto
COPY backend/rust-engine/proto/*.proto proto/

# Copy source code
COPY backend/rust-engine/src ./src

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r satsconnect && useradd -r -g satsconnect satsconnect

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/target/release/satsconnect-rust-engine /app/satsconnect-rust-engine

# Create data directory with proper permissions
RUN mkdir -p /app/data && chown -R satsconnect:satsconnect /app

# Switch to non-root user
USER satsconnect

# Expose gRPC port
EXPOSE 50051

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["./satsconnect-rust-engine"]
