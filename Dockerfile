FROM node:20-slim

# Install compilers, Python, and required utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3 \
    coreutils \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create temp directory for code execution
RUN mkdir -p /tmp/judge && chmod 777 /tmp/judge

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source code
COPY src/ ./src/

# Environment variables for Hugging Face Spaces
ENV NODE_ENV=production
ENV EXECUTION_MODE=process
ENV PORT=7860
ENV TEMP_DIR=/tmp/judge
ENV MAX_CONCURRENT=2
ENV DEFAULT_TIME_LIMIT=5
ENV DEFAULT_MEMORY_LIMIT=256
ENV MAX_TIME_LIMIT=10
ENV MAX_MEMORY_LIMIT=512
ENV MAX_CODE_SIZE=65536
ENV RATE_LIMIT_WINDOW=60000
ENV RATE_LIMIT_MAX=30

EXPOSE 7860

# Health check using curl (simpler than wget)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

CMD ["node", "src/index.js"]
