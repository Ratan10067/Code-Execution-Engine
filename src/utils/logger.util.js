// ─── Logger Utility ──────────────────────────
// Lightweight colored logger — no external deps

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

class Logger {
  _timestamp() {
    return new Date().toISOString();
  }

  info(...args) {
    console.log(
      `${COLORS.gray}[${this._timestamp()}]${COLORS.reset} ${COLORS.green}INFO ${COLORS.reset}`,
      ...args,
    );
  }

  warn(...args) {
    console.warn(
      `${COLORS.gray}[${this._timestamp()}]${COLORS.reset} ${COLORS.yellow}WARN ${COLORS.reset}`,
      ...args,
    );
  }

  error(...args) {
    console.error(
      `${COLORS.gray}[${this._timestamp()}]${COLORS.reset} ${COLORS.red}ERROR${COLORS.reset}`,
      ...args,
    );
  }

  debug(...args) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `${COLORS.gray}[${this._timestamp()}]${COLORS.reset} ${COLORS.cyan}DEBUG${COLORS.reset}`,
        ...args,
      );
    }
  }
}

module.exports = new Logger();
