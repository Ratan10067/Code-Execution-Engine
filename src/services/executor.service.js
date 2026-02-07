// ─── Executor Service ────────────────────────
// Core engine: creates Docker sandbox, runs code, collects metrics
// BATCH MODE: compile once, run all test cases in ONE container

const { execFile } = require("child_process");
const { exec: execCb } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const config = require("../config");
const {
  createWorkDir,
  writeFile,
  readFile,
  cleanup,
  ensureDir,
} = require("../utils/file.util");
const logger = require("../utils/logger.util");

const execFileAsync = promisify(execFile);
const execAsync = promisify(execCb);

class ExecutorService {
  /**
   * Execute code with a SINGLE input (used by /api/execute)
   * Wraps batchExecute with 1 test case
   */
  async execute({ language, code, input = "", timeLimit, memoryLimit }) {
    const results = await this.batchExecute({
      language,
      code,
      inputs: [input],
      timeLimit,
      memoryLimit,
    });
    return results[0];
  }

  /**
   * Execute code against MULTIPLE inputs in ONE Docker container.
   * This is the core method — compile once, run N times.
   *
   * Flow:
   *  1. Create temp dir with code + all input files
   *  2. ONE Docker container compiles + runs all test cases
   *  3. Read all results from mounted volume
   *  4. Cleanup
   *
   * @param {Object} params
   * @param {string} params.language - c | cpp | python
   * @param {string} params.code - Source code
   * @param {string[]} params.inputs - Array of stdin inputs
   * @param {number} params.timeLimit - Time limit per test case (seconds)
   * @param {number} params.memoryLimit - Memory limit (MB)
   * @returns {Object[]} Array of execution results
   */
  async batchExecute({ language, code, inputs = [], timeLimit, memoryLimit }) {
    const langConfig = config.LANGUAGES[language];
    if (!langConfig) {
      throw new Error(`Unsupported language: ${language}`);
    }

    timeLimit = Math.min(
      timeLimit || config.DEFAULT_TIME_LIMIT,
      config.MAX_TIME_LIMIT,
    );
    memoryLimit = Math.min(
      memoryLimit || config.DEFAULT_MEMORY_LIMIT,
      config.MAX_MEMORY_LIMIT,
    );

    const numCases = inputs.length;
    const workDir = await createWorkDir();
    const codeDir = path.join(workDir, "code");
    const tcDir = path.join(workDir, "testcases");
    const resDir = path.join(workDir, "results");

    try {
      // Create directories
      await Promise.all([ensureDir(tcDir), ensureDir(resDir)]);

      // Write code file + all input files in parallel
      const writeOps = [
        writeFile(path.join(codeDir, langConfig.fileName), code),
      ];
      for (let i = 0; i < numCases; i++) {
        writeOps.push(
          writeFile(path.join(tcDir, `${i + 1}.in`), inputs[i] || ""),
        );
      }
      await Promise.all(writeOps);

      // Make everything writable by container
      await execAsync(`chmod -R 777 ${workDir}`);

      // ─── Run ONE Docker container for ALL test cases ───
      const startTime = process.hrtime.bigint();
      const dockerResult = await this._runDocker(
        workDir,
        language,
        timeLimit,
        memoryLimit,
        numCases,
      );
      const wallTimeNs = process.hrtime.bigint() - startTime;
      const wallTimeMs = Number(wallTimeNs / 1_000_000n);

      logger.info(
        `🐳 Container finished: ${numCases} test cases in ${wallTimeMs}ms`,
      );

      // ─── Read ALL results in parallel ───
      const readOps = [];
      for (let i = 0; i < numCases; i++) {
        const idx = i + 1;
        readOps.push(
          Promise.all([
            readFile(path.join(resDir, `${idx}.out`)),
            readFile(path.join(resDir, `${idx}.err`)),
            readFile(path.join(resDir, `${idx}.meta`)),
          ]),
        );
      }
      const allResults = await Promise.all(readOps);

      // ─── Parse each result ───
      const results = allResults.map(([output, stderr, metaRaw], i) => {
        const meta = this._parseMeta(metaRaw);

        if (!meta.verdict) {
          if (dockerResult.oomKilled) meta.verdict = "MLE";
          else if (dockerResult.exitCode === 137) meta.verdict = "MLE";
          else if (dockerResult.exitCode !== 0) meta.verdict = "RE";
          else meta.verdict = "IE";
        }

        return {
          verdict: meta.verdict,
          output: this._truncate(output, 10000),
          error: this._truncate(stderr, 5000),
          executionTime: meta.time || 0,
          memoryUsed: meta.memory || 0,
          exitCode: meta.exitCode ?? dockerResult.exitCode,
          wallTime: wallTimeMs,
          language,
          timeLimit,
          memoryLimit,
        };
      });

      return results;
    } catch (err) {
      logger.error(`Execution failed: ${err.message}`);
      return inputs.map(() => ({
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
      }));
    } finally {
      await cleanup(workDir);
    }
  }

  /**
   * Launch Docker container — batch mode
   * run.sh <language> <time_limit> <num_test_cases>
   */
  async _runDocker(workDir, language, timeLimit, memoryLimit, numCases) {
    // Total timeout = time_limit * numCases + 20s overhead (compile + Docker)
    const totalTimeout = timeLimit * numCases + 20;

    const args = [
      "run",
      "--rm",
      "--network=none",
      `--memory=${memoryLimit}m`,
      `--memory-swap=${memoryLimit}m`,
      "--cpus=1",
      "--pids-limit=64",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--ulimit",
      "fsize=10485760:10485760",
      "--ulimit",
      "nofile=64:64",
      "-v",
      `${workDir}:/sandbox`,
      config.SANDBOX_IMAGE,
      language,
      String(timeLimit),
      String(numCases),
    ];

    try {
      const { stdout, stderr } = await execFileAsync("docker", args, {
        timeout: totalTimeout * 1000,
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
          stderr: "Timed out",
          oomKilled: false,
        };
      }

      return {
        exitCode,
        stdout: err.stdout || "",
        stderr: err.stderr || "",
        oomKilled,
      };
    }
  }

  /**
   * Parse key=value metadata from run.sh
   */
  _parseMeta(raw) {
    const meta = {};
    if (!raw || !raw.trim()) return meta;
    for (const line of raw.trim().split("\n")) {
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.substring(0, eq).trim();
      const val = line.substring(eq + 1).trim();
      if (key === "verdict") meta.verdict = val;
      else if (key === "time") meta.time = parseInt(val) || 0;
      else if (key === "memory") meta.memory = parseInt(val) || 0;
      else if (key === "exitCode") meta.exitCode = parseInt(val) || 0;
    }
    return meta;
  }

  _truncate(str, maxLen) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + `\n... (truncated)`;
  }
}

module.exports = new ExecutorService();
