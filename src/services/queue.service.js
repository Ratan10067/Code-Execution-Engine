// ─── Execution Queue ─────────────────────────
// Simple in-memory Promise-based queue
// Optimized for 1GB instance — no Redis needed

const config = require("../config");
const logger = require("../utils/logger.util");

class QueueService {
  constructor() {
    this.maxConcurrent = config.MAX_CONCURRENT;
    this.running = 0;
    this.waiting = [];
    this.totalProcessed = 0;
    this.totalFailed = 0;
  }

  /**
   * Enqueue a task for execution.
   * Returns a Promise that resolves with the task result.
   * If max concurrency is reached, the task waits in queue.
   */
  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.waiting.push({ task, resolve, reject, enqueuedAt: Date.now() });
      logger.debug(
        `📋 Queue: ${this.running} running, ${this.waiting.length} waiting`,
      );
      this._process();
    });
  }

  /**
   * Process next task if capacity is available
   */
  async _process() {
    if (this.running >= this.maxConcurrent || this.waiting.length === 0) {
      return;
    }

    const { task, resolve, reject, enqueuedAt } = this.waiting.shift();
    const waitTime = Date.now() - enqueuedAt;
    this.running++;

    if (waitTime > 100) {
      logger.info(`⏳ Task waited ${waitTime}ms in queue`);
    }

    try {
      const result = await task();
      this.totalProcessed++;
      resolve(result);
    } catch (err) {
      this.totalFailed++;
      reject(err);
    } finally {
      this.running--;
      // Schedule next task processing
      setImmediate(() => this._process());
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      running: this.running,
      waiting: this.waiting.length,
      maxConcurrent: this.maxConcurrent,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
    };
  }
}

module.exports = new QueueService();
