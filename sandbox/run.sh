#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Sandbox Runner — Compiles and executes user code safely       ║
# ║  Usage: run.sh <language> <time_limit_seconds>                 ║
# ║  Supports: c, cpp, python                                     ║
# ╚══════════════════════════════════════════════════════════════════╝

LANG="$1"
TIME_LIMIT="${2:-5}"
COMPILE_TIMEOUT=10

WORKDIR="/sandbox"
CODE_DIR="$WORKDIR/code"
INPUT="$WORKDIR/input.txt"
OUTPUT="$WORKDIR/output.txt"
STDERR_FILE="$WORKDIR/stderr.txt"
META="$WORKDIR/meta.txt"

# ─── Initialize output files ───
echo "" > "$OUTPUT"
echo "" > "$STDERR_FILE"
echo "" > "$META"

# ─── Helper: write meta and exit ───
write_meta() {
    echo "verdict=$1" > "$META"
    echo "time=$2" >> "$META"
    echo "memory=$3" >> "$META"
    echo "exitCode=$4" >> "$META"
}

# ═══════════════════════════════════════════════
#  PHASE 1: COMPILATION
# ═══════════════════════════════════════════════

compile_result=0

case "$LANG" in
    c)
        timeout $COMPILE_TIMEOUT gcc -O2 -Wall -o /tmp/solution "$CODE_DIR/solution.c" -lm 2>"$STDERR_FILE"
        compile_result=$?
        EXEC_CMD="/tmp/solution"
        ;;
    cpp)
        timeout $COMPILE_TIMEOUT g++ -O2 -std=c++17 -Wall -o /tmp/solution "$CODE_DIR/solution.cpp" -lm 2>"$STDERR_FILE"
        compile_result=$?
        EXEC_CMD="/tmp/solution"
        ;;
    python)
        timeout $COMPILE_TIMEOUT python3 -m py_compile "$CODE_DIR/solution.py" 2>"$STDERR_FILE"
        compile_result=$?
        EXEC_CMD="python3 $CODE_DIR/solution.py"
        ;;
    *)
        write_meta "IE" "0" "0" "1"
        echo "Unsupported language: $LANG" > "$STDERR_FILE"
        exit 0
        ;;
esac

if [ $compile_result -ne 0 ]; then
    write_meta "CE" "0" "0" "$compile_result"
    exit 0
fi

# ═══════════════════════════════════════════════
#  PHASE 2: EXECUTION (simple & reliable)
# ═══════════════════════════════════════════════

echo "" > "$STDERR_FILE"

# Get memory before execution from cgroup (Docker sets this)
CGROUP_MEM_BEFORE=0
if [ -f /sys/fs/cgroup/memory.current ]; then
    CGROUP_MEM_BEFORE=$(cat /sys/fs/cgroup/memory.current 2>/dev/null || echo 0)
elif [ -f /sys/fs/cgroup/memory/memory.usage_in_bytes ]; then
    CGROUP_MEM_BEFORE=$(cat /sys/fs/cgroup/memory/memory.usage_in_bytes 2>/dev/null || echo 0)
fi

# Record start time in milliseconds
START_MS=$(date +%s%3N)

# Run directly with timeout — simple and reliable
timeout "$TIME_LIMIT" sh -c "$EXEC_CMD < \"$INPUT\" > \"$OUTPUT\" 2>\"$STDERR_FILE\""
RUN_EXIT=$?

# Record end time in milliseconds
END_MS=$(date +%s%3N)

# Calculate execution time
EXEC_TIME_MS=$((END_MS - START_MS))

# ═══════════════════════════════════════════════
#  PHASE 3: MEMORY MEASUREMENT
# ═══════════════════════════════════════════════

PEAK_MEMORY=0

# Try cgroup v2 peak (Docker on modern kernels)
if [ -f /sys/fs/cgroup/memory.peak ]; then
    PEAK_BYTES=$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0)
    PEAK_MEMORY=$((PEAK_BYTES / 1024))
# Try cgroup v1 peak
elif [ -f /sys/fs/cgroup/memory/memory.max_usage_in_bytes ]; then
    PEAK_BYTES=$(cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes 2>/dev/null || echo 0)
    PEAK_MEMORY=$((PEAK_BYTES / 1024))
# Fallback: estimate from current usage
elif [ -f /sys/fs/cgroup/memory.current ]; then
    CURRENT_BYTES=$(cat /sys/fs/cgroup/memory.current 2>/dev/null || echo 0)
    PEAK_MEMORY=$(( (CURRENT_BYTES - CGROUP_MEM_BEFORE) / 1024 ))
    [ "$PEAK_MEMORY" -lt 0 ] 2>/dev/null && PEAK_MEMORY=0
fi

# ═══════════════════════════════════════════════
#  PHASE 4: DETERMINE VERDICT
# ═══════════════════════════════════════════════

if [ $RUN_EXIT -eq 124 ]; then
    VERDICT="TLE"
elif [ $RUN_EXIT -eq 137 ]; then
    VERDICT="MLE"
elif [ $RUN_EXIT -eq 139 ]; then
    echo "Segmentation fault (SIGSEGV)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -eq 136 ]; then
    echo "Floating point exception (SIGFPE)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -eq 134 ]; then
    echo "Aborted (SIGABRT)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -ne 0 ]; then
    VERDICT="RE"
else
    VERDICT="OK"
fi

# ═══════════════════════════════════════════════
#  PHASE 5: WRITE METADATA
# ═══════════════════════════════════════════════

write_meta "$VERDICT" "$EXEC_TIME_MS" "$PEAK_MEMORY" "$RUN_EXIT"

exit 0
