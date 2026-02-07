// ─── Configuration ────────────────────────────────────────────
// All settings loaded from environment with sensible defaults
// optimized for 1GB Oracle AMD instance

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  // Execution constraints
  MAX_CONCURRENT: parseInt(process.env.MAX_CONCURRENT) || 2,
  DEFAULT_TIME_LIMIT: parseInt(process.env.DEFAULT_TIME_LIMIT) || 5,
  DEFAULT_MEMORY_LIMIT: parseInt(process.env.DEFAULT_MEMORY_LIMIT) || 256,
  MAX_TIME_LIMIT: parseInt(process.env.MAX_TIME_LIMIT) || 10,
  MAX_MEMORY_LIMIT: parseInt(process.env.MAX_MEMORY_LIMIT) || 512,
  MAX_CODE_SIZE: parseInt(process.env.MAX_CODE_SIZE) || 65536,

  // Docker
  SANDBOX_IMAGE: process.env.SANDBOX_IMAGE || "judge-sandbox",
  TEMP_DIR: process.env.TEMP_DIR || "/tmp/judge",

  // Rate limiting
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000,
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 30,

  // Supported languages
  LANGUAGES: {
    c: {
      name: "C",
      extension: ".c",
      fileName: "solution.c",
      compiler: "GCC",
      version: "GCC 13.x",
      boilerplate:
        '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
    },
    cpp: {
      name: "C++",
      extension: ".cpp",
      fileName: "solution.cpp",
      compiler: "G++",
      version: "G++ 13.x (C++17)",
      boilerplate:
        '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
    },
    python: {
      name: "Python 3",
      extension: ".py",
      fileName: "solution.py",
      interpreter: "Python 3",
      version: "Python 3.11.x",
      boilerplate: 'print("Hello, World!")\n',
    },
  },

  // Verdict descriptions
  VERDICTS: {
    AC: {
      code: "AC",
      name: "Accepted",
      description: "Output matches expected output",
    },
    WA: {
      code: "WA",
      name: "Wrong Answer",
      description: "Output does not match expected output",
    },
    TLE: {
      code: "TLE",
      name: "Time Limit Exceeded",
      description: "Program exceeded the time limit",
    },
    MLE: {
      code: "MLE",
      name: "Memory Limit Exceeded",
      description: "Program exceeded the memory limit",
    },
    RE: {
      code: "RE",
      name: "Runtime Error",
      description: "Program crashed during execution",
    },
    CE: {
      code: "CE",
      name: "Compilation Error",
      description: "Program failed to compile",
    },
    IE: {
      code: "IE",
      name: "Internal Error",
      description: "Judge system error",
    },
  },
};
