#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Sandbox Runner — Compiles and executes user code safely       ║
# ║  Usage: run.sh <language> <time_limit_seconds>                 ║
# ║  Supports: c, cpp, python                                     ║
# ╚══════════════════════════════════════════════════════════════════╝

set -o pipefail

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
> "$OUTPUT"
> "$STDERR_FILE"
> "$META"

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
        echo "verdict=IE" > "$META"
        echo "time=0" >> "$META"
        echo "memory=0" >> "$META"
        echo "exitCode=1" >> "$META"
        echo "Unsupported language: $LANG" > "$STDERR_FILE"
        exit 0
        ;;
esac

# Check compilation result
if [ $compile_result -ne 0 ]; then
    echo "verdict=CE" > "$META"
    echo "time=0" >> "$META"
    echo "memory=0" >> "$META"
    echo "exitCode=$compile_result" >> "$META"
    exit 0
fi

# ═══════════════════════════════════════════════
#  PHASE 2: EXECUTION
# ═══════════════════════════════════════════════

# Clear stderr for execution phase
> "$STDERR_FILE"

# Record start time (nanoseconds via GNU coreutils)
START_NS=$(/usr/bin/date +%s%N 2>/dev/null || echo $(($(date +%s) * 1000000000)))

# Run the program in background so we can monitor /proc for memory
timeout "$TIME_LIMIT" \
    sh -c "$EXEC_CMD < \"$INPUT\" > \"$OUTPUT\" 2>\"$STDERR_FILE\"" &

CHILD_PID=$!
PEAK_MEMORY=0

# Monitor memory usage via /proc while process is alive
while kill -0 $CHILD_PID 2>/dev/null; do
    if [ -f "/proc/$CHILD_PID/status" ]; then
        CURRENT_MEM=$(grep VmRSS /proc/$CHILD_PID/status 2>/dev/null | awk '{print $2}')
        if [ -n "$CURRENT_MEM" ] && [ "$CURRENT_MEM" -gt "$PEAK_MEMORY" ] 2>/dev/null; then
            PEAK_MEMORY=$CURRENT_MEM
        fi
    fi
    sleep 0.05
done

# Get exit code of the background process
wait $CHILD_PID
RUN_EXIT=$?

# Record end time
END_NS=$(/usr/bin/date +%s%N 2>/dev/null || echo $(($(date +%s) * 1000000000)))

# Calculate execution time in milliseconds
EXEC_TIME_MS=$(( (END_NS - START_NS) / 1000000 ))

# ═══════════════════════════════════════════════
#  PHASE 3: PARSE RESULTS
# ═══════════════════════════════════════════════

# PEAK_MEMORY is already set from /proc monitoring (in KB)

# ═══════════════════════════════════════════════
#  PHASE 4: DETERMINE VERDICT
# ═══════════════════════════════════════════════

if [ $RUN_EXIT -eq 124 ]; then
    # timeout command returned 124 → Time Limit Exceeded
    VERDICT="TLE"
elif [ $RUN_EXIT -eq 137 ]; then
    # SIGKILL (128 + 9) → likely OOM / Docker memory limit
    VERDICT="MLE"
elif [ $RUN_EXIT -eq 139 ]; then
    # SIGSEGV (128 + 11) → Segmentation fault
    echo "Segmentation fault (SIGSEGV)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -eq 136 ]; then
    # SIGFPE (128 + 8) → Floating point exception
    echo "Floating point exception (SIGFPE)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -eq 134 ]; then
    # SIGABRT (128 + 6) → Abort
    echo "Aborted (SIGABRT)" >> "$STDERR_FILE"
    VERDICT="RE"
elif [ $RUN_EXIT -ne 0 ]; then
    # Any other non-zero → Runtime Error
    VERDICT="RE"
else
    # Exit 0 → execution succeeded
    VERDICT="OK"
fi

# ═══════════════════════════════════════════════
#  PHASE 5: WRITE METADATA
# ═══════════════════════════════════════════════

echo "verdict=$VERDICT" > "$META"
echo "time=$EXEC_TIME_MS" >> "$META"
echo "memory=$PEAK_MEMORY" >> "$META"
echo "exitCode=$RUN_EXIT" >> "$META"

exit 0
