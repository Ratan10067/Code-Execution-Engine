const express = require("express");
const router = express.Router();
const { validateExecution } = require("../middleware/validate.middleware");
const { rateLimiter } = require("../middleware/rateLimit.middleware");
const executorService = require("../services/executor.service");
const queueService = require("../services/queue.service");
const logger = require("../utils/logger.util");

// ─── POST /api/execute ───────────────────────
// Run code with stdin → get stdout, stderr, time, memory, verdict
router.post(
  "/execute",
  rateLimiter,
  validateExecution,
  async (req, res, next) => {
    try {
      const { language, code, input, timeLimit, memoryLimit } = req.body;

      logger.info(
        `📥 Execute request: lang=${language}, codeSize=${code.length}B, timeLimit=${timeLimit}s, memLimit=${memoryLimit}MB`,
      );

      const result = await queueService.enqueue(() =>
        executorService.execute({
          language,
          code,
          input,
          timeLimit,
          memoryLimit,
        }),
      );

      logger.info(
        `📤 Result: verdict=${result.verdict}, time=${result.executionTime}ms, memory=${result.memoryUsed}KB`,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
