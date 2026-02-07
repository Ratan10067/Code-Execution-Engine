---
title: Code Execution Engine
emoji: ⚡
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# Code Execution Engine

A high-performance code execution and judging engine supporting C, C++, and Python. Supports both Docker-based and process-based execution modes.

## Features

- **Multi-language support**: C (GCC 13.x), C++ (G++ 13.x with C++17), Python 3.11
- **Batch execution**: Compile once, run multiple test cases efficiently
- **Dual execution modes**:
  - **Docker mode**: Full isolation using sandbox containers (recommended for production)
  - **Process mode**: Direct subprocess execution (for Hugging Face Spaces)
- **RESTful API**: Simple endpoints for code execution and judging

## API Endpoints

| Endpoint           | Method | Description                      |
| ------------------ | ------ | -------------------------------- |
| `/api/health`      | GET    | Health check                     |
| `/api/languages`   | GET    | List supported languages         |
| `/api/execute`     | POST   | Execute code with single input   |
| `/api/judge`       | POST   | Judge code against test cases    |
| `/api/batch-judge` | POST   | Batch judge multiple submissions |

## Deployment

### Hugging Face Spaces

Deploy using `Dockerfile.huggingface`:

```bash
# The Dockerfile.huggingface is configured for HF Spaces
# Set Space SDK to "Docker" and it will use this file
```

### Self-hosted (Docker)

```bash
docker-compose up -d
```

### Environment Variables

| Variable               | Default | Description                   |
| ---------------------- | ------- | ----------------------------- |
| `PORT`                 | 3000    | Server port                   |
| `EXECUTION_MODE`       | docker  | `docker` or `process`         |
| `MAX_CONCURRENT`       | 2       | Max concurrent executions     |
| `DEFAULT_TIME_LIMIT`   | 5       | Time limit per test (seconds) |
| `DEFAULT_MEMORY_LIMIT` | 256     | Memory limit (MB)             |
| `MAX_TIME_LIMIT`       | 10      | Maximum allowed time limit    |
| `MAX_MEMORY_LIMIT`     | 512     | Maximum allowed memory        |

## Quick Test

```bash
node test/quick-test.js http://localhost:3000
```
