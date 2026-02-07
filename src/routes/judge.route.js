const express = require("express");
const router = express.Router();
const { validateJudge } = require("../middleware/validate.middleware");
const { rateLimiter } = require("../middleware/rateLimit.middleware");
const judgeService = require("../services/judge.service");
const queueService = require("../services/queue.service");
const logger = require("../utils/logger.util");

// ─── POST /api/judge ─────────────────────────
// Run code against multiple test cases and compare outputs
router.post("/judge", rateLimiter, validateJudge, async (req, res, next) => {
  try {
    const { language, code, testCases, timeLimit, memoryLimit } = req.body;

    logger.info(
      `⚖️  Judge request: lang=${language}, testCases=${testCases.length}, timeLimit=${timeLimit}s, memLimit=${memoryLimit}MB`,
    );

    const result = await queueService.enqueue(() =>
      judgeService.judge({ language, code, testCases, timeLimit, memoryLimit }),
    );

    logger.info(
      `📊 Judge result: verdict=${result.overallVerdict}, passed=${result.passed}/${result.totalTestCases}, totalTime=${result.totalTime}ms, maxMemory=${result.maxMemory}KB`,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/batch-judge ───────────────────
// Run multiple submissions (useful for problem testing)
router.post("/batch-judge", rateLimiter, async (req, res, next) => {
  try {
    const { submissions } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        details: ["submissions must be a non-empty array"],
      });
    }

    if (submissions.length > 10) {
      return res.status(400).json({
        success: false,
        error: "Validation Error",
        details: ["Maximum 10 submissions per batch"],
      });
    }

    logger.info(`📦 Batch judge: ${submissions.length} submissions`);

    const results = [];
    for (const submission of submissions) {
      const result = await queueService.enqueue(() =>
        judgeService.judge(submission),
      );
      results.push(result);
    }

    res.json({
      success: true,
      data: {
        total: results.length,
        results,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
