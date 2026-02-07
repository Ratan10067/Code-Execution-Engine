// ─── Judge Service ───────────────────────────
// Runs code against test cases, compares output, returns verdicts

const executorService = require("./executor.service");
const logger = require("../utils/logger.util");

class JudgeService {
  /**
   * Judge code against multiple test cases.
   *
   * Flow:
   *  1. For each test case: execute code with that input
   *  2. Compare actual output with expected output
   *  3. Assign verdict: AC, WA, TLE, MLE, RE, CE
   *  4. Stop early on CE (same binary for all test cases)
   *  5. Return detailed results for each test case
   *
   * @param {Object} params
   * @param {string} params.language
   * @param {string} params.code
   * @param {Array} params.testCases - [{input, expectedOutput}]
   * @param {number} params.timeLimit
   * @param {number} params.memoryLimit
   */
  async judge({ language, code, testCases, timeLimit, memoryLimit }) {
    const results = [];
    let overallVerdict = "AC";
    let totalTime = 0;
    let maxMemory = 0;
    let firstFailedTestCase = null;

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];

      logger.info(`  📝 Test case ${i + 1}/${testCases.length}...`);

      // Execute code with this test case's input
      const result = await executorService.execute({
        language,
        code,
        input: tc.input,
        timeLimit,
        memoryLimit,
      });

      // Determine verdict for this test case
      const verdict = this._getVerdict(result, tc.expectedOutput);

      const testResult = {
        testCase: i + 1,
        verdict,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        input: this._truncate(tc.input, 1000),
        expectedOutput: this._truncate(tc.expectedOutput, 1000),
        actualOutput: this._truncate(result.output, 1000),
        error: result.error,
        exitCode: result.exitCode,
      };

      results.push(testResult);
      totalTime += result.executionTime;
      maxMemory = Math.max(maxMemory, result.memoryUsed);

      // Track first failure
      if (verdict !== "AC" && overallVerdict === "AC") {
        overallVerdict = verdict;
        firstFailedTestCase = i + 1;
      }

      // Stop on Compilation Error (same for all test cases)
      if (verdict === "CE") {
        for (let j = i + 1; j < testCases.length; j++) {
          results.push({
            testCase: j + 1,
            verdict: "SKIPPED",
            executionTime: 0,
            memoryUsed: 0,
            input: this._truncate(testCases[j].input, 1000),
            expectedOutput: this._truncate(testCases[j].expectedOutput, 1000),
            actualOutput: "",
            error: "Skipped — compilation error in earlier test case",
            exitCode: 0,
          });
        }
        break;
      }
    }

    return {
      overallVerdict,
      totalTime,
      maxMemory,
      totalTestCases: testCases.length,
      passed: results.filter((r) => r.verdict === "AC").length,
      failed: results.filter(
        (r) => r.verdict !== "AC" && r.verdict !== "SKIPPED",
      ).length,
      skipped: results.filter((r) => r.verdict === "SKIPPED").length,
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
