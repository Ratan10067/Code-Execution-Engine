const express = require("express");
const router = express.Router();
const config = require("../config");
const queueService = require("../services/queue.service");

// ─── GET /api/health ─────────────────────────
router.get("/health", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: "ok",
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(mem.external / 1024 / 1024)}MB`,
      },
      queue: queueService.getStatus(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  });
});

// ─── GET /api/languages ──────────────────────
router.get("/languages", (req, res) => {
  res.json({
    success: true,
    data: {
      languages: config.LANGUAGES,
      limits: {
        maxTimeLimit: config.MAX_TIME_LIMIT,
        maxMemoryLimit: config.MAX_MEMORY_LIMIT,
        maxCodeSize: config.MAX_CODE_SIZE,
        defaultTimeLimit: config.DEFAULT_TIME_LIMIT,
        defaultMemoryLimit: config.DEFAULT_MEMORY_LIMIT,
      },
      verdicts: config.VERDICTS,
    },
  });
});

module.exports = router;
