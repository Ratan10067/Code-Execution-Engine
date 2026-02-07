FROM node:20-alpine

WORKDIR /app

# Install Docker CLI (to communicate with host Docker via socket mount)
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/
COPY sandbox/ ./sandbox/
COPY .env* ./

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
