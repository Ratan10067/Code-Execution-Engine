// ─── Executor Service Facade ────────────────────────
// Delegates to Docker or Process executor based on EXECUTION_MODE config
// This allows seamless switching between Docker (local/server) and Process (Hugging Face)

const config = require("../config");

let executor;

if (config.EXECUTION_MODE === "process") {
  executor = require("./process.executor");
} else {
  executor = require("./docker.executor");
}

module.exports = executor;
