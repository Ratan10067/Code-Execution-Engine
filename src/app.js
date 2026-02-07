const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const executeRoute = require("./routes/execute.route");
const judgeRoute = require("./routes/judge.route");
const healthRoute = require("./routes/health.route");
const { errorHandler } = require("./middleware/error.middleware");

const app = express();

// ─── Security & Parsing ──────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan("short"));

// ─── API Routes ──────────────────────────────
app.use("/api", healthRoute);
app.use("/api", executeRoute);
app.use("/api", judgeRoute);

// ─── 404 Handler ─────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Not Found",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ────────────────────
app.use(errorHandler);

module.exports = app;
