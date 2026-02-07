// ─── Test Script ─────────────────────────────
// Run: node test/test.js
// Make sure the server is running on port 3000

const http = require("http");

const BASE_URL = "http://localhost:3000";

function request(method, path, body = null) {
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

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runTests() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Code Execution Engine — Test Suite");
  console.log("═══════════════════════════════════════════════\n");

  // ─── Health Check ────────────────────────
  console.log("📋 Health & Info:");

  await test("GET /api/health returns ok", async () => {
    const res = await request("GET", "/api/health");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.status === "ok", "Status should be ok");
  });

  await test("GET /api/languages returns supported languages", async () => {
    const res = await request("GET", "/api/languages");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.languages.c, "Should support C");
    assert(res.body.data.languages.cpp, "Should support C++");
    assert(res.body.data.languages.python, "Should support Python");
  });

  // ─── C++ Tests ───────────────────────────
  console.log("\n🔧 C++ Execution:");

  await test("C++ Hello World", async () => {
    const res = await request("POST", "/api/execute", {
      language: "cpp",
      code: '#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
      input: "",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(res.body.data.output.trim() === "Hello, World!", "Output mismatch");
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  await test("C++ with stdin (sum of array)", async () => {
    const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int n; cin >> n;
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int x; cin >> x;
        sum += x;
    }
    cout << sum << endl;
    return 0;
}`;
    const res = await request("POST", "/api/execute", {
      language: "cpp",
      code,
      input: "5\n1 2 3 4 5\n",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(
      res.body.data.output.trim() === "15",
      `Expected 15, got ${res.body.data.output.trim()}`,
    );
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  await test("C++ Compilation Error", async () => {
    const res = await request("POST", "/api/execute", {
      language: "cpp",
      code: '#include <iostream>\nint main() { cout << "test" }',
      input: "",
    });
    assert(
      res.body.data.verdict === "CE",
      `Expected CE, got ${res.body.data.verdict}`,
    );
  });

  await test("C++ Runtime Error (segfault)", async () => {
    const res = await request("POST", "/api/execute", {
      language: "cpp",
      code: "#include <cstdlib>\nint main() { int *p = nullptr; *p = 42; return 0; }",
      input: "",
    });
    assert(
      res.body.data.verdict === "RE",
      `Expected RE, got ${res.body.data.verdict}`,
    );
  });

  await test("C++ Time Limit Exceeded", async () => {
    const res = await request("POST", "/api/execute", {
      language: "cpp",
      code: "#include <iostream>\nint main() { while(true); return 0; }",
      input: "",
      timeLimit: 2,
    });
    assert(
      res.body.data.verdict === "TLE",
      `Expected TLE, got ${res.body.data.verdict}`,
    );
  });

  // ─── C Tests ─────────────────────────────
  console.log("\n🔧 C Execution:");

  await test("C Hello World", async () => {
    const res = await request("POST", "/api/execute", {
      language: "c",
      code: '#include <stdio.h>\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}\n',
      input: "",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(res.body.data.output.trim() === "Hello from C!", "Output mismatch");
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  await test("C with stdin (factorial)", async () => {
    const code = `#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    long long fact = 1;
    for (int i = 2; i <= n; i++) fact *= i;
    printf("%lld\\n", fact);
    return 0;
}`;
    const res = await request("POST", "/api/execute", {
      language: "c",
      code,
      input: "10\n",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(
      res.body.data.output.trim() === "3628800",
      `Expected 3628800, got ${res.body.data.output.trim()}`,
    );
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  // ─── Python Tests ────────────────────────
  console.log("\n🐍 Python Execution:");

  await test("Python Hello World", async () => {
    const res = await request("POST", "/api/execute", {
      language: "python",
      code: 'print("Hello from Python!")\n',
      input: "",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(
      res.body.data.output.trim() === "Hello from Python!",
      "Output mismatch",
    );
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  await test("Python with stdin", async () => {
    const code = `n = int(input())
nums = list(map(int, input().split()))
print(sum(nums))`;
    const res = await request("POST", "/api/execute", {
      language: "python",
      code,
      input: "5\n1 2 3 4 5\n",
    });
    assert(
      res.body.data.verdict === "OK",
      `Expected OK, got ${res.body.data.verdict}`,
    );
    assert(
      res.body.data.output.trim() === "15",
      `Expected 15, got ${res.body.data.output.trim()}`,
    );
    console.log(
      `    → Time: ${res.body.data.executionTime}ms, Memory: ${res.body.data.memoryUsed}KB`,
    );
  });

  await test("Python Syntax Error", async () => {
    const res = await request("POST", "/api/execute", {
      language: "python",
      code: 'def foo(\n  print("broken")',
      input: "",
    });
    assert(
      res.body.data.verdict === "CE",
      `Expected CE, got ${res.body.data.verdict}`,
    );
  });

  await test("Python Runtime Error (division by zero)", async () => {
    const res = await request("POST", "/api/execute", {
      language: "python",
      code: "print(1 / 0)",
      input: "",
    });
    assert(
      res.body.data.verdict === "RE",
      `Expected RE, got ${res.body.data.verdict}`,
    );
  });

  // ─── Judge Tests ─────────────────────────
  console.log("\n⚖️  Judge Mode:");

  await test("Judge: All test cases pass (AC)", async () => {
    const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
    int a, b; cin >> a >> b;
    cout << a + b << endl;
    return 0;
}`;
    const res = await request("POST", "/api/judge", {
      language: "cpp",
      code,
      testCases: [
        { input: "1 2\n", expectedOutput: "3" },
        { input: "10 20\n", expectedOutput: "30" },
        { input: "0 0\n", expectedOutput: "0" },
        { input: "-5 5\n", expectedOutput: "0" },
      ],
    });
    assert(
      res.body.data.overallVerdict === "AC",
      `Expected AC, got ${res.body.data.overallVerdict}`,
    );
    assert(
      res.body.data.passed === 4,
      `Expected 4 passed, got ${res.body.data.passed}`,
    );
    console.log(
      `    → Total time: ${res.body.data.totalTime}ms, Max memory: ${res.body.data.maxMemory}KB`,
    );
  });

  await test("Judge: Wrong Answer (WA)", async () => {
    const code = `#include <iostream>
using namespace std;
int main() {
    int a, b; cin >> a >> b;
    cout << a - b << endl;  // Bug: subtraction instead of addition
    return 0;
}`;
    const res = await request("POST", "/api/judge", {
      language: "cpp",
      code,
      testCases: [
        { input: "5 3\n", expectedOutput: "8" },
        { input: "0 0\n", expectedOutput: "0" },
      ],
    });
    assert(
      res.body.data.overallVerdict === "WA",
      `Expected WA, got ${res.body.data.overallVerdict}`,
    );
  });

  // ─── Validation Tests ────────────────────
  console.log("\n🛡️  Validation:");

  await test("Rejects unsupported language", async () => {
    const res = await request("POST", "/api/execute", {
      language: "java",
      code: 'System.out.println("test");',
      input: "",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Rejects empty code", async () => {
    const res = await request("POST", "/api/execute", {
      language: "python",
      code: "",
      input: "",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  await test("Rejects missing language", async () => {
    const res = await request("POST", "/api/execute", {
      code: 'print("test")',
      input: "",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Tests complete!");
  console.log("═══════════════════════════════════════════════\n");
}

runTests().catch(console.error);
