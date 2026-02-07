// ─── File Utility ────────────────────────────
// Manages temp directories for each execution

const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");

/**
 * Ensure directory exists (mkdir -p)
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Create a unique working directory for an execution.
 * Structure:
 *   /tmp/judge/<uuid>/
 *     code/          ← source files go here
 *     input.txt      ← stdin
 *     output.txt     ← stdout (written by runner)
 *     stderr.txt     ← stderr (written by runner)
 *     meta.txt       ← metadata (written by runner)
 */
async function createWorkDir() {
  const id = uuidv4();
  const workDir = path.join(config.TEMP_DIR, id);
  await ensureDir(workDir);
  await ensureDir(path.join(workDir, "code"));
  return workDir;
}

/**
 * Write content to a file (creating parent dirs if needed)
 */
async function writeFile(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Read file content (returns empty string on failure)
 */
async function readFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

/**
 * Recursively delete a directory and its contents
 */
async function cleanup(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors — temp dirs will be cleaned eventually
  }
}

module.exports = { ensureDir, createWorkDir, writeFile, readFile, cleanup };
