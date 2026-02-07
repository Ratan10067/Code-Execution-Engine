// ─── Judge Service ───────────────────────────
// Runs code against test cases, compares output, returns verdicts
// NOW USES BATCH MODE: 1 container for ALL test cases

const executorService = require("./executor.service");
const logger = require("../utils/logger.util");

class JudgeService {
  /**
   * Judge code against multiple test cases in ONE container.
   *
   * Flow:
   *  1. Extract all inputs from test cases
   *  2. Send to batchExecute (ONE Docker container)
   *  3. Compare each output with expected
   *  4. Return detailed results
   */
  async judge({ language, code, testCases, timeLimit, memoryLimit }) {
    logger.info(
      `  ⚖️  Judging ${testCases.length} test cases in ONE container...`,
    );

    // Extract all inputs
    const inputs = testCases.map((tc) => tc.input);

    // Execute ALL test cases in a single container
    const execResults = await executorService.batchExecute({
      language,
      code,
      inputs,
      timeLimit,
      memoryLimit,
    });

    // Build results
    let overallVerdict = "AC";
    let totalTime = 0;
    let maxMemory = 0;
    let firstFailedTestCase = null;
    const results = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = execResults[i];
      const verdict = this._getVerdict(result, tc.expectedOutput);

      results.push({
        testCase: i + 1,
        verdict,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        input: this._truncate(tc.input, 1000),
        expectedOutput: this._truncate(tc.expectedOutput, 1000),
        actualOutput: this._truncate(result.output, 1000),
        error: result.error,
        exitCode: result.exitCode,
      });

      totalTime += result.executionTime;
      maxMemory = Math.max(maxMemory, result.memoryUsed);

      if (verdict !== "AC" && overallVerdict === "AC") {
        overallVerdict = verdict;
        firstFailedTestCase = i + 1;
      }
    }

    return {
      overallVerdict,
      totalTime,
      maxMemory,
      totalTestCases: testCases.length,
      passed: results.filter((r) => r.verdict === "AC").length,
      failed: results.filter((r) => r.verdict !== "AC").length,
      skipped: 0,
      firstFailedTestCase,
      results,
    };
  }

  /**
   * Determine verdict by comparing actual output to expected.
   *
   * Priority:
   *  1. If executor verdict is not OK → return that (CE, TLE, MLE, RE)
   *  2. Normalize both outputs and compare
   *  3. AC if match, WA if mismatch
   */
  _getVerdict(result, expectedOutput) {
    // Non-OK verdicts take priority
    if (result.verdict !== "OK") {
      return result.verdict; // CE, TLE, MLE, RE, IE
    }

    // Compare normalized outputs
    const actual = this._normalize(result.output);
    const expected = this._normalize(expectedOutput);

    if (actual === expected) {
      return "AC";
    }

    return "WA";
  }

  /**
   * Normalize output for comparison:
   *  - Trim trailing whitespace from each line
   *  - Remove trailing empty lines
   *  - Consistent line endings
   */
  _normalize(str) {
    if (!str) return "";
    return str
      .replace(/\r\n/g, "\n") // Normalize CRLF → LF
      .split("\n")
      .map((line) => line.trimEnd()) // Trim trailing whitespace per line
      .join("\n")
      .trimEnd(); // Remove trailing empty lines
  }

  /**
   * Truncate for response size control
   */
  _truncate(str, maxLen) {
    if (!str) return "";
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + "...";
  }
}

module.exports = new JudgeService();
