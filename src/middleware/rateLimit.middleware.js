// ─── Rate Limiting Middleware ─────────────────
// Protects the 1GB instance from abuse

const rateLimit = require("express-rate-limit");
const config = require("../config");

const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW,
  max: config.RATE_LIMIT_MAX,
  message: {
    success: false,
    error: "Too Many Requests",
    message: `Rate limit exceeded. Maximum ${config.RATE_LIMIT_MAX} requests per ${config.RATE_LIMIT_WINDOW / 1000} seconds.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind a proxy, otherwise IP
    return req.headers["x-forwarded-for"] || req.ip;
  },
});

module.exports = { rateLimiter };
