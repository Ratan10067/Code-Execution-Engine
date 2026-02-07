#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Code Execution Engine — Setup Script                          ║
# ║  Run: chmod +x scripts/setup.sh && bash scripts/setup.sh       ║
# ║  Target: Oracle Cloud 1GB AMD Instance (Ubuntu/Oracle Linux)   ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}"
echo "══════════════════════════════════════════════════"
echo "  Code Execution Engine — Setup"
echo "  Optimized for 1GB Oracle AMD Instance"
echo "══════════════════════════════════════════════════"
echo -e "${NC}"

# ─── Step 1: Check Docker ─────────────────────
echo -e "${BOLD}[1/5] Checking Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo ""
    echo "Install Docker with:"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker"
    exit 1
fi

if ! docker info &> /dev/null 2>&1; then
    echo -e "${RED}❌ Docker daemon is not running!${NC}"
    echo ""
    echo "Start Docker with:"
    echo "  sudo systemctl start docker"
    echo "  sudo systemctl enable docker"
    exit 1
fi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
echo -e "${GREEN}✅ Docker is available (v${DOCKER_VERSION})${NC}"

# ─── Step 2: Check Node.js ────────────────────
echo -e "\n${BOLD}[2/5] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo ""
    echo "Install Node.js with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js is available (${NODE_VERSION})${NC}"

# ─── Step 3: Install npm dependencies ─────────
echo -e "\n${BOLD}[3/5] Installing npm dependencies...${NC}"
npm install --production
echo -e "${GREEN}✅ Dependencies installed${NC}"

# ─── Step 4: Build sandbox Docker image ───────
echo -e "\n${BOLD}[4/5] Building sandbox Docker image...${NC}"
echo "  This will take 1-2 minutes on first run..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SANDBOX_DIR="$PROJECT_DIR/sandbox"

docker build -t judge-sandbox "$SANDBOX_DIR"
echo -e "${GREEN}✅ Sandbox image built (judge-sandbox)${NC}"

# ─── Step 5: Create .env if not exists ────────
echo -e "\n${BOLD}[5/5] Checking configuration...${NC}"
ENV_FILE="$PROJECT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    cat > "$ENV_FILE" << 'EOF'
# ─── Server ───────────────────────────────────
PORT=3000
NODE_ENV=production

# ─── Execution Limits ─────────────────────────
MAX_CONCURRENT=2
DEFAULT_TIME_LIMIT=5
DEFAULT_MEMORY_LIMIT=256
MAX_TIME_LIMIT=10
MAX_MEMORY_LIMIT=512
MAX_CODE_SIZE=65536

# ─── Docker ───────────────────────────────────
SANDBOX_IMAGE=judge-sandbox
TEMP_DIR=/tmp/judge

# ─── Rate Limiting ────────────────────────────
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=30
EOF
    echo -e "${GREEN}✅ Created .env file with defaults${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# ─── Create temp directory ────────────────────
mkdir -p /tmp/judge

# ─── Done! ────────────────────────────────────
echo -e "\n${BOLD}${CYAN}"
echo "══════════════════════════════════════════════════"
echo "  ✅ Setup Complete!"
echo ""
echo "  Start the server:"
echo "    npm start          (production)"
echo "    npm run dev        (development with auto-reload)"
echo ""
echo "  API Endpoints:"
echo "    GET  /api/health       Health check + metrics"
echo "    GET  /api/languages    Supported languages"
echo "    POST /api/execute      Execute code"
echo "    POST /api/judge        Judge with test cases"
echo "    POST /api/batch-judge  Batch judge"
echo ""
echo "  Quick test:"
echo "    curl http://localhost:3000/api/health"
echo "══════════════════════════════════════════════════"
echo -e "${NC}"
