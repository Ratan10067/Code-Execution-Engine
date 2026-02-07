// ─── Executor Service ────────────────────────
// Core engine: creates Docker sandbox, runs code, collects metrics

const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const config = require("../config");
const {
  createWorkDir,
  writeFile,
  readFile,
  cleanup,
} = require("../utils/file.util");
const logger = require("../utils/logger.util");

const execFileAsync = promisify(execFile);

class ExecutorService {
  /**
   * Execute code in a Docker sandbox container.
   *
   * Flow:
   *  1. Create temp directory with code + input files
   *  2. Spin up Docker container with resource limits
   *  3. Container compiles (C/C++) and runs code via run.sh
   *  4. Read output, stderr, and metadata from mounted volume
   *  5. Cleanup temp directory
   *  6. Return structured result
   *
   * @param {Object} params
   * @param {string} params.language - c | cpp | python
   * @param {string} params.code - Source code
   * @param {string} params.input - Stdin input
   * @param {number} params.timeLimit - Time limit in seconds
   * @param {number} params.memoryLimit - Memory limit in MB
   * @returns {Object} Execution result with verdict, output, time, memory
   */
  async execute({ language, code, input = "", timeLimit, memoryLimit }) {
    const langConfig = config.LANGUAGES[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Clamp limits
    timeLimit = Math.min(
      timeLimit || config.DEFAULT_TIME_LIMIT,
      config.MAX_TIME_LIMIT,
    );
    memoryLimit = Math.min(
      memoryLimit || config.DEFAULT_MEMORY_LIMIT,
      config.MAX_MEMORY_LIMIT,
    );

    // Create isolated working directory
    const workDir = await createWorkDir();
    const codeDir = path.join(workDir, "code");

    try {
      // Write source code and input to temp directory
      await Promise.all([
        writeFile(path.join(codeDir, langConfig.fileName), code),
        writeFile(path.join(workDir, "input.txt"), input || ""),
        writeFile(path.join(workDir, "output.txt"), ""),
        writeFile(path.join(workDir, "stderr.txt"), ""),
        writeFile(path.join(workDir, "meta.txt"), ""),
      ]);

      // Make the work directory and all files writable by the container
      const { exec: execCb } = require("child_process");
      const { promisify: pfy } = require("util");
      await pfy(execCb)(`chmod -R 777 ${workDir}`);

      // ─── Run in Docker Sandbox ───
      const startTime = process.hrtime.bigint();
      const dockerResult = await this._runDocker(
        workDir,
        language,
        timeLimit,
        memoryLimit,
      );
      const wallTimeNs = process.hrtime.bigint() - startTime;
      const wallTimeMs = Number(wallTimeNs / 1_000_000n);

      // ─── Read Results ───
      const [output, stderr, metaRaw] = await Promise.all([
        readFile(path.join(workDir, "output.txt")),
        readFile(path.join(workDir, "stderr.txt")),
        readFile(path.join(workDir, "meta.txt")),
      ]);

      // ─── Parse Metadata ───
      logger.info(`📄 meta.txt raw: [${metaRaw.trim()}]`);
      logger.info(`📄 output.txt length: ${output.length}`);
      logger.info(`📄 stderr.txt: [${stderr.trim()}]`);
      logger.info(`📄 docker exitCode: ${dockerResult.exitCode}`);

      const meta = this._parseMeta(metaRaw);

      // Handle Docker OOM kill (container killed, no meta written)
      if (dockerResult.oomKilled && !meta.verdict) {
        meta.verdict = "MLE";
      }

      // Handle case where container died before writing meta
      if (!meta.verdict) {
        if (dockerResult.exitCode === 137) {
          meta.verdict = "MLE";
        } else if (dockerResult.exitCode !== 0) {
          meta.verdict = "RE";
        } else {
          meta.verdict = "IE";
        }
      }

      // ─── Build Response ───
      return {
        verdict: meta.verdict,
        output: this._truncate(output, 10000),
        error: this._truncate(stderr, 5000),
        executionTime: meta.time || wallTimeMs,
        memoryUsed: meta.memory || 0,
        exitCode: meta.exitCode ?? dockerResult.exitCode,
        wallTime: wallTimeMs,
        language,
        timeLimit,
        memoryLimit,
      };
    } catch (err) {
      logger.error(`Execution failed: ${err.message}`);
      return {
        verdict: "IE",
        output: "",
        error: `Internal Error: ${err.message}`,
        executionTime: 0,
        memoryUsed: 0,
        exitCode: -1,
        wallTime: 0,
        language,
        timeLimit,
        memoryLimit,
      };
    } finally {
      // Always cleanup temp directory
      await cleanup(workDir);
    }
  }

  /**
   * Launch Docker container with security restrictions and resource limits
   */
  async _runDocker(workDir, language, timeLimit, memoryLimit) {
    const args = [
      "run",
      "--rm",

      // ─── Network isolation ───
      "--network=none",

      // ─── Memory limits ───
      `--memory=${memoryLimit}m`,
      `--memory-swap=${memoryLimit}m`, // No swap allowed

      // ─── CPU limits ───
      "--cpus=1",

      // ─── Process limits ───
      "--pids-limit=64",

      // ─── Security hardening ───
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",

      // ─── File size limit (10MB) ───
      "--ulimit",
      "fsize=10485760:10485760",

      // ─── Open file limit ───
      "--ulimit",
      "nofile=64:64",

      // ─── Volume mount ───
      "-v",
      `${workDir}:/sandbox`,

      // ─── Sandbox image and args ───
      config.SANDBOX_IMAGE,
      language,
      String(timeLimit),
    ];

    logger.debug(`🐳 Docker args: ${args.join(" ")}`);

    try {
      const { stdout, stderr } = await execFileAsync("docker", args, {
        // Give extra time for Docker overhead + compilation
        timeout: (timeLimit + 20) * 1000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { exitCode: 0, stdout, stderr, oomKilled: false };
    } catch (err) {
      const exitCode = err.code || 1;
      const oomKilled = exitCode === 137;

      if (err.killed) {
        logger.warn("⚠️  Docker container killed by Node.js timeout");
        return {
          exitCode: 124,
          stdout: "",
          stderr: "Execution timed out (Docker overhead)",
          oomKilled: false,
        };
      }

      logger.debug(
        `🐳 Docker exited with code ${exitCode}${oomKilled ? " (OOM)" : ""}`,
      );
      return {
        exitCode,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        oomKilled,
      };
    }
  }

  /**
   * Parse the metadata file written by run.sh
   * Format: key=value per line
   */
  _parseMeta(raw) {
    const meta = {};
    if (!raw || !raw.trim()) return meta;

    const lines = raw.trim().split("\n");
    for (const line of lines) {
      const eqIndex = line.indexOf("=");
      if (eqIndex === -1) continue;

      const key = line.substring(0, eqIndex).trim();
      const value = line.substring(eqIndex + 1).trim();

      switch (key) {
        case "verdict":
          meta.verdict = value;
          break;
        case "time":
          meta.time = parseInt(value) || 0;
          break;
        case "memory":
          meta.memory = parseInt(value) || 0;
          break;
        case "exitCode":
          meta.exitCode = parseInt(value) || 0;
          break;
      }
    }

    return meta;
  }

  /**
   * Truncate string to prevent huge responses
   */
  _truncate(str, maxLen) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return (
      str.substring(0, maxLen) + `\n... (truncated, ${str.length} total chars)`
    );
  }
}

module.exports = new ExecutorService();
