#!/usr/bin/env bash
# Runs the release gates and records the result (VI-F08-S01, spec R1).
#
#   npm run release:gates
#
# Four gates, in this order: typecheck, lint, tests, build. It does not stop at
# the first failure: every gate runs, then a table shows each exit code, and the
# same table is written to reports/release-gates.md with the commit and the
# known limitations (docs/known-limitations.md). It exits 0 only when every gate
# passed.
#
# The tests gate needs the local Supabase stack: without it the integration
# tests (RLS, roles, demo data) skip themselves and `npm test` is green without
# having checked them, so the gate is Not run and the release is not ready.
#
# Exit codes: 0 all passed, 1 a gate failed or was not run, 2 refused to start.
set -uo pipefail

cd "$(dirname "$0")/.."

report_dir="${RELEASE_GATES_REPORT_DIR:-reports}"

# `next dev` and `next build` share the .next directory.
if pgrep -f "next dev" > /dev/null 2>&1; then
  echo "Refusing to run: a dev server is running. Stop it first: pkill -f \"next dev\"" >&2
  exit 2
fi

names=()
commands=()
codes=()
results=()
notes=()

record() { # name command code result note
  names+=("$1"); commands+=("$2"); codes+=("$3"); results+=("$4"); notes+=("$5")
}

run_gate() { # name command...
  local name=$1
  shift
  echo "== ${name}: $*"
  "$@"
  local code=$?
  if [ "$code" -eq 0 ]; then
    record "$name" "$*" "$code" "Pass" ""
  else
    record "$name" "$*" "$code" "Fail" ""
  fi
}

run_gate typecheck npm run typecheck
run_gate lint npm run lint

if npx supabase status -o json > /dev/null 2>&1; then
  run_gate tests npm run test
else
  record tests "npm run test" "-" "Not run" "The local Supabase stack is not running, so the integration tests would skip. Start it with: npx supabase start"
fi

run_gate build npm run build

failed=0
summary=$(
  echo "| Gate | Command | Exit code | Result |"
  echo "|---|---|---|---|"
  for i in "${!names[@]}"; do
    echo "| ${names[$i]} | \`${commands[$i]}\` | ${codes[$i]} | ${results[$i]} |"
  done
)
for i in "${!names[@]}"; do
  [ "${results[$i]}" = "Pass" ] || failed=1
done

commit=$(git rev-parse --short HEAD 2> /dev/null || echo unknown)
dirty=""
[ -n "$(git status --porcelain 2> /dev/null)" ] && dirty=" (with uncommitted changes)"

limitations="docs/known-limitations.md"

mkdir -p "$report_dir"
{
  echo "# Release gates"
  echo
  echo "- Run at: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo "- Commit: ${commit}${dirty}"
  echo
  echo "$summary"
  echo
  for i in "${!names[@]}"; do
    [ -n "${notes[$i]}" ] && echo "- ${names[$i]}: ${notes[$i]}"
  done
  echo
  if [ -f "$limitations" ]; then
    cat "$limitations"
  else
    echo "Known limitations: ${limitations} was not found."
  fi
} > "${report_dir}/release-gates.md"

echo
cat "${report_dir}/release-gates.md"
echo
if [ "$failed" -eq 0 ]; then
  echo "All gates passed. Result recorded in ${report_dir}/release-gates.md"
  exit 0
fi
echo "Not release ready: a gate failed or was not run. Result recorded in ${report_dir}/release-gates.md" >&2
exit 1
