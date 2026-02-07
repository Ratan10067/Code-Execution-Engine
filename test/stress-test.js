// ╔══════════════════════════════════════════════════════════════════╗
// ║  Stress Test — 5 Problems × 10 Test Cases — All Simultaneous  ║
// ║  Run: node test/stress-test.js                                ║
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

// ═══════════════════════════════════════════════
//  5 PROBLEMS WITH 10 TEST CASES EACH
// ═══════════════════════════════════════════════

const problems = [
  // ─── Problem 1: Two Sum (C++) ───
  {
    name: "P1: Two Sum (C++)",
    language: "cpp",
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`,
    timeLimit: 2,
    memoryLimit: 256,
    testCases: [
      { input: "1 2\n", expectedOutput: "3" },
      { input: "0 0\n", expectedOutput: "0" },
      { input: "-5 5\n", expectedOutput: "0" },
      { input: "100 200\n", expectedOutput: "300" },
      { input: "999999 1\n", expectedOutput: "1000000" },
      { input: "-100 -200\n", expectedOutput: "-300" },
      { input: "2147483 0\n", expectedOutput: "2147483" },
      { input: "50 50\n", expectedOutput: "100" },
      { input: "1 -1\n", expectedOutput: "0" },
      { input: "12345 67890\n", expectedOutput: "80235" },
    ],
  },

  // ─── Problem 2: Factorial (C) ───
  {
    name: "P2: Factorial (C)",
    language: "c",
    code: `#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    long long fact = 1;
    for (int i = 2; i <= n; i++) fact *= i;
    printf("%lld\\n", fact);
    return 0;
}`,
    timeLimit: 2,
    memoryLimit: 256,
    testCases: [
      { input: "0\n", expectedOutput: "1" },
      { input: "1\n", expectedOutput: "1" },
      { input: "5\n", expectedOutput: "120" },
      { input: "10\n", expectedOutput: "3628800" },
      { input: "12\n", expectedOutput: "479001600" },
      { input: "15\n", expectedOutput: "1307674368000" },
      { input: "20\n", expectedOutput: "2432902008176640000" },
      { input: "3\n", expectedOutput: "6" },
      { input: "7\n", expectedOutput: "5040" },
      { input: "2\n", expectedOutput: "2" },
    ],
  },

  // ─── Problem 3: Fibonacci (Python) ───
  {
    name: "P3: Fibonacci (Python)",
    language: "python",
    code: `n = int(input())
a, b = 0, 1
for _ in range(n):
    a, b = b, a + b
print(a)`,
    timeLimit: 3,
    memoryLimit: 256,
    testCases: [
      { input: "0\n", expectedOutput: "0" },
      { input: "1\n", expectedOutput: "1" },
      { input: "2\n", expectedOutput: "1" },
      { input: "5\n", expectedOutput: "5" },
      { input: "10\n", expectedOutput: "55" },
      { input: "15\n", expectedOutput: "610" },
      { input: "20\n", expectedOutput: "6765" },
      { input: "30\n", expectedOutput: "832040" },
      { input: "40\n", expectedOutput: "102334155" },
      { input: "50\n", expectedOutput: "12586269025" },
    ],
  },

  // ─── Problem 4: Reverse Array (C++) ───
  {
    name: "P4: Reverse Array (C++)",
    language: "cpp",
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    int n; cin >> n;
    vector<int> v(n);
    for (int i = 0; i < n; i++) cin >> v[i];
    reverse(v.begin(), v.end());
    for (int i = 0; i < n; i++) {
        if (i) cout << " ";
        cout << v[i];
    }
    cout << endl;
    return 0;
}`,
    timeLimit: 2,
    memoryLimit: 256,
    testCases: [
      { input: "5\n1 2 3 4 5\n", expectedOutput: "5 4 3 2 1" },
      { input: "1\n42\n", expectedOutput: "42" },
      { input: "3\n10 20 30\n", expectedOutput: "30 20 10" },
      { input: "4\n-1 -2 -3 -4\n", expectedOutput: "-4 -3 -2 -1" },
      { input: "6\n1 1 1 1 1 1\n", expectedOutput: "1 1 1 1 1 1" },
      { input: "2\n100 200\n", expectedOutput: "200 100" },
      { input: "7\n7 6 5 4 3 2 1\n", expectedOutput: "1 2 3 4 5 6 7" },
      { input: "3\n0 0 0\n", expectedOutput: "0 0 0" },
      { input: "5\n9 8 7 6 5\n", expectedOutput: "5 6 7 8 9" },
      { input: "4\n1 3 5 7\n", expectedOutput: "7 5 3 1" },
    ],
  },

  // ─── Problem 5: Prime Check (C++) ───
  {
    name: "P5: Prime Check (C++)",
    language: "cpp",
    code: `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    if (n < 2) { cout << "NO" << endl; return 0; }
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) { cout << "NO" << endl; return 0; }
    }
    cout << "YES" << endl;
    return 0;
}`,
    timeLimit: 2,
    memoryLimit: 256,
    testCases: [
      { input: "2\n", expectedOutput: "YES" },
      { input: "3\n", expectedOutput: "YES" },
      { input: "4\n", expectedOutput: "NO" },
      { input: "17\n", expectedOutput: "YES" },
      { input: "1\n", expectedOutput: "NO" },
      { input: "100\n", expectedOutput: "NO" },
      { input: "97\n", expectedOutput: "YES" },
      { input: "0\n", expectedOutput: "NO" },
      { input: "49\n", expectedOutput: "NO" },
      { input: "7919\n", expectedOutput: "YES" },
    ],
  },
];

// ═══════════════════════════════════════════════
//  RUN ALL 5 SIMULTANEOUSLY
// ═══════════════════════════════════════════════

async function run() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  🚀 STRESS TEST — 5 Problems × 10 Test Cases           ║");
  console.log("║  All 5 fired SIMULTANEOUSLY                            ║");
  console.log(`║  Target: ${BASE_URL.padEnd(44)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const totalStart = Date.now();

  // Fire ALL 5 judge requests at the same time
  const promises = problems.map((problem, idx) =>
    new Promise((resolve) => setTimeout(resolve, idx * 500)).then(() =>
      request("POST", "/api/judge", {
        language: problem.language,
        code: problem.code,
        testCases: problem.testCases,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
      }),
    ),
  );

  console.log(
    "⏳ All 5 requests fired (staggered 500ms apart for 1GB instance)...\n",
  );

  const results = await Promise.all(promises);

  const totalEnd = Date.now();
  const totalTime = totalEnd - totalStart;

  // ─── Display Results ───
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════\n");

  let totalPassed = 0;
  let totalTests = 0;

  results.forEach((res, i) => {
    const p = problems[i];
    const d = res.body.data;

    if (!d) {
      console.log(`  ❌ ${p.name}: ERROR — ${JSON.stringify(res.body)}\n`);
      return;
    }

    const icon = d.overallVerdict === "AC" ? "✅" : "❌";
    totalPassed += d.passed;
    totalTests += d.totalTestCases;

    console.log(`  ${icon} ${p.name}`);
    console.log(`     Verdict:  ${d.overallVerdict}`);
    console.log(`     Passed:   ${d.passed}/${d.totalTestCases}`);
    console.log(`     Time:     ${d.totalTime}ms`);
    console.log(
      `     Memory:   ${d.maxMemory}KB (${(d.maxMemory / 1024).toFixed(1)}MB)`,
    );

    // Show failed test cases
    if (d.overallVerdict !== "AC") {
      d.results
        .filter((r) => r.verdict !== "AC")
        .slice(0, 3)
        .forEach((r) => {
          console.log(`     ── TC #${r.testCase}: ${r.verdict}`);
          if (r.verdict === "WA") {
            console.log(
              `        Expected: ${r.expectedOutput.substring(0, 50)}`,
            );
            console.log(`        Got:      ${r.actualOutput.substring(0, 50)}`);
          }
          if (r.error)
            console.log(`        Error: ${r.error.substring(0, 100)}`);
        });
    }

    console.log("");
  });

  // ─── Summary ───
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Total test cases:    ${totalTests}`);
  console.log(`  Passed:              ${totalPassed}/${totalTests}`);
  console.log(
    `  Total wall time:     ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`,
  );
  console.log(`  Avg per problem:     ${(totalTime / 5).toFixed(0)}ms`);
  console.log(`  Concurrency:         5 simultaneous requests`);
  console.log(
    `  Throughput:          ${((totalTests / totalTime) * 1000).toFixed(1)} test cases/sec`,
  );
  console.log("═══════════════════════════════════════════════════════════\n");
}

run().catch((err) => {
  console.error("❌ Test failed:", err.message);
});
