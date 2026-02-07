// ─── Process Executor Service ────────────────────────
// Core engine: runs code directly via child_process (no Docker)
// For Hugging Face Spaces and environments without Docker-in-Docker
// BATCH MODE: compile once, run all test cases sequentially

const { spawn } = require("child_process");
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

class ProcessExecutor {
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
   * Execute code against MULTIPLE inputs sequentially.
   * Compile once, run N times — just like Docker version but using subprocess.
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

    try {
      // Write code file
      const codeFile = path.join(codeDir, langConfig.fileName);
      await writeFile(codeFile, code);

      // ─── Phase 1: Compilation ───
      const startCompile = process.hrtime.bigint();
      const compileResult = await this._compile(language, codeDir, workDir);
      const compileTimeMs = Number(
        (process.hrtime.bigint() - startCompile) / 1_000_000n,
      );

      if (compileResult.error) {
        // Compilation failed — return CE for all test cases
        return inputs.map(() => ({
          verdict: "CE",
          output: "",
          error: this._truncate(compileResult.error, 5000),
          executionTime: 0,
          memoryUsed: 0,
          exitCode: 1,
          wallTime: compileTimeMs,
          language,
          timeLimit,
          memoryLimit,
        }));
      }

      logger.info(`🔨 Compiled ${language} in ${compileTimeMs}ms`);

      // ─── Phase 2: Run each test case ───
      const results = [];
      const overallStart = process.hrtime.bigint();

      for (let i = 0; i < numCases; i++) {
        const result = await this._runTestCase(
          language,
          compileResult.execCmd,
          inputs[i] || "",
          timeLimit,
          memoryLimit,
          workDir,
        );
        results.push({
          ...result,
          language,
          timeLimit,
          memoryLimit,
        });
      }

      const wallTimeMs = Number(
        (process.hrtime.bigint() - overallStart) / 1_000_000n,
      );
      logger.info(`⚡ Executed ${numCases} test cases in ${wallTimeMs}ms`);

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
   * Compile code based on language
   * Returns { execCmd } on success or { error } on failure
   */
  async _compile(language, codeDir, workDir) {
    const binaryPath = path.join(workDir, "solution");

    switch (language) {
      case "c": {
        const sourceFile = path.join(codeDir, "solution.c");
        const result = await this._runProcess(
          "gcc",
          ["-O2", "-Wall", "-o", binaryPath, sourceFile, "-lm"],
          { timeout: 10000 },
        );
        if (result.exitCode !== 0) {
          return {
            error: result.stderr || result.stdout || "Compilation failed",
          };
        }
        return { execCmd: [binaryPath] };
      }

      case "cpp": {
        const sourceFile = path.join(codeDir, "solution.cpp");
        const result = await this._runProcess(
          "g++",
          ["-O2", "-std=c++17", "-Wall", "-o", binaryPath, sourceFile, "-lm"],
          { timeout: 10000 },
        );
        if (result.exitCode !== 0) {
          return {
            error: result.stderr || result.stdout || "Compilation failed",
          };
        }
        return { execCmd: [binaryPath] };
      }

      case "python": {
        const sourceFile = path.join(codeDir, "solution.py");
        // Syntax check only
        const result = await this._runProcess(
          "python3",
          ["-m", "py_compile", sourceFile],
          { timeout: 10000 },
        );
        if (result.exitCode !== 0) {
          return { error: result.stderr || result.stdout || "Syntax error" };
        }
        return { execCmd: ["python3", sourceFile] };
      }

      default:
        return { error: `Unsupported language: ${language}` };
    }
  }

  /**
   * Run a single test case
   */
  async _runTestCase(
    language,
    execCmd,
    input,
    timeLimit,
    memoryLimit,
    workDir,
  ) {
    const startTime = process.hrtime.bigint();

    const result = await this._runProcess(execCmd[0], execCmd.slice(1), {
      timeout: timeLimit * 1000,
      input,
      memoryLimit,
    });

    const executionTime = Number(
      (process.hrtime.bigint() - startTime) / 1_000_000n,
    );

    // Determine verdict
    let verdict = "OK";
    if (result.timedOut) {
      verdict = "TLE";
    } else if (result.exitCode === 137) {
      verdict = "MLE";
    } else if (result.exitCode === 139 || result.signal === "SIGSEGV") {
      verdict = "RE";
      result.stderr = (result.stderr || "") + "\nSegmentation fault (SIGSEGV)";
    } else if (result.exitCode === 136 || result.signal === "SIGFPE") {
      verdict = "RE";
      result.stderr =
        (result.stderr || "") + "\nFloating point exception (SIGFPE)";
    } else if (result.exitCode === 134 || result.signal === "SIGABRT") {
      verdict = "RE";
      result.stderr = (result.stderr || "") + "\nAborted (SIGABRT)";
    } else if (result.exitCode !== 0) {
      verdict = "RE";
    }

    return {
      verdict,
      output: this._truncate(result.stdout, 10000),
      error: this._truncate(result.stderr, 5000),
      executionTime,
      memoryUsed: result.memoryUsed || 0,
      exitCode: result.exitCode,
      wallTime: executionTime,
    };
  }

  /**
   * Run a process with timeout and optional stdin input
   */
  _runProcess(cmd, args, options = {}) {
    return new Promise((resolve) => {
      const { timeout = 30000, input = "", memoryLimit = 256 } = options;

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let memoryUsed = 0;

      const proc = spawn(cmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        timeout,
      });

      // Set up timeout
      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGKILL");
      }, timeout);

      // Write input
      if (input) {
        proc.stdin.write(input);
      }
      proc.stdin.end();

      // Collect stdout
      proc.stdout.on("data", (data) => {
        if (stdout.length < 100000) {
          stdout += data.toString();
        }
      });

      // Collect stderr
      proc.stderr.on("data", (data) => {
        if (stderr.length < 50000) {
          stderr += data.toString();
        }
      });

      proc.on("close", (code, signal) => {
        clearTimeout(timer);

        // Try to get memory usage (best effort, may not be accurate)
        try {
          if (proc.memoryUsage) {
            memoryUsed = Math.round(proc.memoryUsage().rss / 1024);
          }
        } catch {
          // Ignore memory measurement errors
        }

        resolve({
          exitCode: code ?? (timedOut ? 124 : -1),
          signal,
          stdout,
          stderr,
          timedOut,
          memoryUsed,
        });
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: -1,
          stdout: "",
          stderr: err.message,
          timedOut: false,
          memoryUsed: 0,
        });
      });
    });
  }

  _truncate(str, maxLen) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + `\n... (truncated)`;
  }
}

module.exports = new ProcessExecutor();
