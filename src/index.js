require("dotenv").config();

const app = require("./app");
const config = require("./config");
const logger = require("./utils/logger.util");
const { ensureDir } = require("./utils/file.util");
const { verifyDocker, buildSandboxImage } = require("./utils/docker.util");

async function bootstrap() {
  logger.info("═══════════════════════════════════════════════");
  logger.info("  🚀 Code Execution Engine — Starting...");
  logger.info("═══════════════════════════════════════════════");

  // Step 1: Check execution mode
  if (config.EXECUTION_MODE === "process") {
    logger.info("🔧 Running in PROCESS mode (no Docker required)");
  } else {
    // Docker mode: verify Docker is available and build sandbox image
    await verifyDocker();
    await buildSandboxImage();
  }

  // Step 2: Ensure temp directory exists
  await ensureDir(config.TEMP_DIR);

  // Step 3: Start HTTP server
  app.listen(config.PORT, "0.0.0.0", () => {
    logger.info("───────────────────────────────────────────────");
    logger.info(`  ✅ Server running on http://0.0.0.0:${config.PORT}`);
    logger.info(`  📋 Environment:    ${config.NODE_ENV}`);
    logger.info(`  🐳 Sandbox image:  ${config.SANDBOX_IMAGE}`);
    logger.info(`  ⚡ Max concurrent: ${config.MAX_CONCURRENT}`);
    logger.info(`  🔒 Memory limit:   ${config.MAX_MEMORY_LIMIT}MB`);
    logger.info(`  ⏱️  Time limit:     ${config.MAX_TIME_LIMIT}s`);
    logger.info(`  🌐 Languages:      C, C++, Python`);
    logger.info("───────────────────────────────────────────────");
    logger.info("  API Endpoints:");
    logger.info("    GET  /api/health      → Health check");
    logger.info("    GET  /api/languages   → Supported languages");
    logger.info("    POST /api/execute     → Run code");
    logger.info("    POST /api/judge       → Judge with test cases");
    logger.info("    POST /api/batch-judge → Batch judge");
    logger.info("═══════════════════════════════════════════════");
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("🛑 SIGTERM received. Shutting down...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("🛑 SIGINT received. Shutting down...");
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection:", reason);
  process.exit(1);
});

bootstrap().catch((err) => {
  logger.error("❌ Failed to start server:", err.message);
  process.exit(1);
});
