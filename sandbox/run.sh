#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║  Sandbox Runner — BATCH MODE                                   ║
# ║  Compiles ONCE, runs ALL test cases in one container           ║
# ║  Usage: run.sh <language> <time_limit> <num_test_cases>        ║
# ║  Supports: c, cpp, python                                     ║
# ╚══════════════════════════════════════════════════════════════════╝

LANG="$1"
TIME_LIMIT="${2:-5}"
NUM_CASES="${3:-1}"
COMPILE_TIMEOUT=10

WORKDIR="/sandbox"
CODE_DIR="$WORKDIR/code"
TC_DIR="$WORKDIR/testcases"
RES_DIR="$WORKDIR/results"

# ─── Ensure results directory exists ───
mkdir -p "$RES_DIR"

# ─── Helper: write meta for a specific test case ───
write_meta() {
    local idx="$1" verdict="$2" time_ms="$3" memory="$4" exit_code="$5"
    echo "verdict=$verdict" > "$RES_DIR/$idx.meta"
    echo "time=$time_ms" >> "$RES_DIR/$idx.meta"
    echo "memory=$memory" >> "$RES_DIR/$idx.meta"
    echo "exitCode=$exit_code" >> "$RES_DIR/$idx.meta"
}

# ─── Helper: write CE for all remaining test cases ───
write_ce_all() {
    local stderr_msg="$1"
    for i in $(seq 1 "$NUM_CASES"); do
        write_meta "$i" "CE" "0" "0" "1"
        echo "" > "$RES_DIR/$i.out"
        echo "$stderr_msg" > "$RES_DIR/$i.err"
    done
}

# ═══════════════════════════════════════════════
#  PHASE 1: COMPILATION (once for all test cases)
# ═══════════════════════════════════════════════

compile_result=0
COMPILE_STDERR=""

case "$LANG" in
    c)
        COMPILE_STDERR=$(timeout $COMPILE_TIMEOUT gcc -O2 -Wall -o /tmp/solution "$CODE_DIR/solution.c" -lm 2>&1)
        compile_result=$?
        EXEC_CMD="/tmp/solution"
        ;;
    cpp)
        COMPILE_STDERR=$(timeout $COMPILE_TIMEOUT g++ -O2 -std=c++17 -Wall -o /tmp/solution "$CODE_DIR/solution.cpp" -lm 2>&1)
        compile_result=$?
        EXEC_CMD="/tmp/solution"
        ;;
    python)
        COMPILE_STDERR=$(timeout $COMPILE_TIMEOUT python3 -m py_compile "$CODE_DIR/solution.py" 2>&1)
        compile_result=$?
        EXEC_CMD="python3 $CODE_DIR/solution.py"
        ;;
    *)
        for i in $(seq 1 "$NUM_CASES"); do
            write_meta "$i" "IE" "0" "0" "1"
            echo "" > "$RES_DIR/$i.out"
            echo "Unsupported language: $LANG" > "$RES_DIR/$i.err"
        done
        exit 0
        ;;
esac

if [ $compile_result -ne 0 ]; then
    write_ce_all "$COMPILE_STDERR"
    exit 0
fi

# ═══════════════════════════════════════════════
#  PHASE 2: RUN EACH TEST CASE
# ═══════════════════════════════════════════════

for i in $(seq 1 "$NUM_CASES"); do
    INPUT_FILE="$TC_DIR/$i.in"
    OUTPUT_FILE="$RES_DIR/$i.out"
    STDERR_FILE="$RES_DIR/$i.err"

    # Initialize output files
    echo -n "" > "$OUTPUT_FILE"
    echo -n "" > "$STDERR_FILE"

    # Default input if file missing
    if [ ! -f "$INPUT_FILE" ]; then
        INPUT_FILE="/dev/null"
    fi

    # Record start time
    START_MS=$(date +%s%3N)

    # Run with timeout
    timeout "$TIME_LIMIT" sh -c "$EXEC_CMD < \"$INPUT_FILE\" > \"$OUTPUT_FILE\" 2>\"$STDERR_FILE\""
    RUN_EXIT=$?

    # Record end time
    END_MS=$(date +%s%3N)
    EXEC_TIME_MS=$((END_MS - START_MS))

    # ─── Memory measurement ───
    PEAK_MEMORY=0
    if [ -f /sys/fs/cgroup/memory.peak ]; then
        PEAK_BYTES=$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0)
        PEAK_MEMORY=$((PEAK_BYTES / 1024))
    elif [ -f /sys/fs/cgroup/memory/memory.max_usage_in_bytes ]; then
        PEAK_BYTES=$(cat /sys/fs/cgroup/memory/memory.max_usage_in_bytes 2>/dev/null || echo 0)
        PEAK_MEMORY=$((PEAK_BYTES / 1024))
    elif [ -f /sys/fs/cgroup/memory.current ]; then
        PEAK_BYTES=$(cat /sys/fs/cgroup/memory.current 2>/dev/null || echo 0)
        PEAK_MEMORY=$((PEAK_BYTES / 1024))
    fi

    # ─── Determine verdict ───
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

    # Write metadata for this test case
    write_meta "$i" "$VERDICT" "$EXEC_TIME_MS" "$PEAK_MEMORY" "$RUN_EXIT"
done

exit 0
