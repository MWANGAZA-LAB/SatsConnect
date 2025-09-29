# Multi-stage build for SatsConnect Rust Engine
FROM rust:1.82.0-slim AS builder

# Install system dependencies
RUN apt-get update && apt-get install -y \
    protobuf-compiler \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY rust-toolchain.toml ./

# Copy proto files
COPY proto/ ./proto/

# Copy source code
COPY src/ ./src/
COPY build.rs ./

# Build only the main application (not test clients)
RUN cargo build --release --bin engine_server

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    net-tools \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -r -s /bin/false appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/target/release/engine_server /app/engine_server

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose gRPC port
EXPOSE 50051

# Health check (simple port check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD netstat -an | grep :50051 || exit 1

# Run the application
CMD ["./engine_server"]
