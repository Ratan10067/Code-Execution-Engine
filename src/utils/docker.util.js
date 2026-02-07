// ─── Docker Utility ──────────────────────────
// Verifies Docker availability and builds sandbox image

const { exec } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const config = require("../config");
const logger = require("./logger.util");

const execAsync = promisify(exec);

/**
 * Verify Docker daemon is installed and running
 */
async function verifyDocker() {
  try {
    const { stdout } = await execAsync(
      'docker info --format "{{.ServerVersion}}"',
    );
    logger.info(`🐳 Docker available (v${stdout.trim()})`);
  } catch (err) {
    logger.error("❌ Docker is not available!");
    logger.error("   Make sure Docker is installed and the daemon is running.");
    logger.error("   Install: https://docs.docker.com/engine/install/");
    throw new Error("Docker is required but not available");
  }
}

/**
 * Build the sandbox Docker image if it doesn't already exist
 */
async function buildSandboxImage() {
  try {
    // Check if image already exists
    await execAsync(
      `docker image inspect ${config.SANDBOX_IMAGE} > /dev/null 2>&1`,
    );
    logger.info(`🐳 Sandbox image '${config.SANDBOX_IMAGE}' already exists`);
  } catch {
    // Image doesn't exist — build it
    logger.info(`🔨 Building sandbox image '${config.SANDBOX_IMAGE}'...`);
    logger.info("   This may take 1-2 minutes on first run...");

    const sandboxDir = path.join(__dirname, "..", "..", "sandbox");

    try {
      await execAsync(`docker build -t ${config.SANDBOX_IMAGE} ${sandboxDir}`, {
        timeout: 300000, // 5 minute timeout for build
      });
      logger.info("✅ Sandbox image built successfully");
    } catch (buildErr) {
      logger.error("❌ Failed to build sandbox image:", buildErr.message);
      throw new Error("Failed to build sandbox Docker image");
    }
  }
}

module.exports = { verifyDocker, buildSandboxImage };
