#!/usr/bin/env bash
# Run a Jest test file N times to check for flakiness.
# Each run uses a different faker seed (logged by jest-shared-setup.ts).
#
# Usage:
#   ./scripts/test/jest-repeat.sh [runs] [-j jobs] -- <jest-args...>
#
# Examples:
#   ./scripts/test/jest-repeat.sh -- frontends/main/src/foo.test.tsx
#   ./scripts/test/jest-repeat.sh 50 -- frontends/main/src/foo.test.tsx
#   ./scripts/test/jest-repeat.sh 50 -j 4 -- frontends/main/src/foo.test.tsx
#   ./scripts/test/jest-repeat.sh 50 -- foo.test.tsx bar.test.tsx
#   ./scripts/test/jest-repeat.sh 50 -j 4 -- --testPathPattern=foo
#
# NOTES:
# - This is slower than inserting a .each(new Array(100).fill(null)) call onto a
#   specific test or describe block (reruns jest setup). However, more reliably
#   detects issues related to test ordering or imports. Additionally, the seed
#   is more easily controlled and no code change is required.
#
set -uo pipefail

RUNS=20
JOBS=1

# Optional leading run count.
if [[ "${1:-}" =~ ^[0-9]+$ ]]; then
	RUNS="$1"
	shift
fi

# Script flags; all jest args must follow --.
while [[ $# -gt 0 ]]; do
	case "$1" in
	-j)
		JOBS="${2:?-j requires a number}"
		shift 2
		;;
	--)
		shift
		break
		;;
	*)
		echo "Unknown option: $1 (jest args must follow --)" >&2
		exit 1
		;;
	esac
done

if [[ $# -eq 0 ]]; then
	echo "Usage: $0 [runs] [-j jobs] -- <jest-args...>" >&2
	exit 1
fi

JEST_ARGS=("$@")

echo "Running ${JEST_ARGS[*]} $RUNS times (jobs: $JOBS)..."
echo ""

pids=()
tmpfiles=()
run_nums=()

# Kill any in-flight background jobs and remove their temp files. Runs on EXIT.
cleanup() {
	local pid tmpfile
	for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
	for tmpfile in "${tmpfiles[@]:-}"; do rm -f "$tmpfile"; done
}
trap cleanup EXIT

# Wait for the oldest queued job (FIFO), print its output only on failure,
# then shift it off the front of the pids/run_nums/tmpfiles arrays.
wait_oldest() {
	local oldest_pid="${pids[0]}"
	local oldest_run="${run_nums[0]}"
	local oldest_tmp="${tmpfiles[0]}"
	pids=("${pids[@]:1}")
	run_nums=("${run_nums[@]:1}")
	tmpfiles=("${tmpfiles[@]:1}")

	if wait "$oldest_pid"; then
		echo "  run $oldest_run / $RUNS passed"
	else
		echo ""
		echo "--- FAILED: run $oldest_run / $RUNS ---"
		cat "$oldest_tmp"
		rm -f "$oldest_tmp"
		exit 1
	fi
	rm -f "$oldest_tmp"
}

i=0
while [[ $i -lt $RUNS ]]; do
	while [[ ${#pids[@]} -lt $JOBS && $i -lt $RUNS ]]; do
		i=$((i + 1))
		tmpfile=$(mktemp)
		tmpfiles+=("$tmpfile")
		run_nums+=("$i")
		(yarn test --no-coverage "${JEST_ARGS[@]}" >"$tmpfile" 2>&1) &
		pids+=($!)
	done
	wait_oldest
done

while [[ ${#pids[@]} -gt 0 ]]; do
	wait_oldest
done

echo ""
echo "All $RUNS runs passed."
