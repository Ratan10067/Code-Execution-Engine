// ─── Error Handling Middleware ────────────────

const logger = require("../utils/logger.util");

function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.originalUrl} →`, err.message);

  // JSON parse error
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON",
      message: "Request body contains invalid JSON",
    });
  }

  // Body too large
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: "Payload Too Large",
      message: "Request body exceeds the size limit",
    });
  }

  // Default 500 error
  res.status(err.status || 500).json({
    success: false,
    error: err.status ? err.message : "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong. Please try again.",
  });
}

module.exports = { errorHandler };
