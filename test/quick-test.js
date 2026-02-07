// ╔══════════════════════════════════════════════════════════════════╗
// ║  Quick Test — 1 Problem, 5 Test Cases                         ║
// ║  Run: node test/quick-test.js                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

const http = require("http");
const BASE_URL = process.argv[2] || "http://140.245.240.6:3000";

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log("\n⚡ Quick Test — Single Problem\n");

  const start = Date.now();

  const res = await request("POST", "/api/judge", {
    language: "cpp",
    code: [
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "int main() {",
      "    int a, b; cin >> a >> b;",
      "    cout << a + b << endl;",
      "    return 0;",
      "}",
    ].join("\n"),
    testCases: [
      { input: "1 2\n", expectedOutput: "3" },
      { input: "0 0\n", expectedOutput: "0" },
      { input: "-5 5\n", expectedOutput: "0" },
      { input: "100 200\n", expectedOutput: "300" },
      { input: "999 1\n", expectedOutput: "1000" },
    ],
    timeLimit: 2,
    memoryLimit: 256,
  });

  const wallTime = Date.now() - start;
  const d = res.body.data;

  console.log(`  Verdict:      ${d.overallVerdict}`);
  console.log(`  Passed:       ${d.passed}/${d.totalTestCases}`);
  console.log(`  Total Time:   ${d.totalTime}ms (execution only)`);
  console.log(
    `  Max Memory:   ${d.maxMemory}KB (${(d.maxMemory / 1024).toFixed(1)}MB)`,
  );
  console.log(`  Wall Time:    ${wallTime}ms (includes network + Docker)`);
  console.log("");

  d.results.forEach((r) => {
    const icon = r.verdict === "AC" ? "✅" : "❌";
    console.log(
      `  ${icon} TC#${r.testCase}  ${r.verdict.padEnd(4)} ${r.executionTime}ms  ${r.memoryUsed}KB`,
    );
  });

  console.log(
    `\n  📊 Avg per test case: ${(wallTime / d.totalTestCases).toFixed(0)}ms wall, ${(d.totalTime / d.totalTestCases).toFixed(0)}ms execution\n`,
  );
}

run().catch((err) => console.error("❌", err.message));
