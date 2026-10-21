#!/usr/bin/env bash
# Shows that the demo data is the same on every load (VI-F07-S02, spec R2).
#
#   npm run demo:determinism
#
# It resets the LOCAL database twice, and after each reset takes a fingerprint
# of every table (scripts/demo-fingerprint.sql: the row count and an md5 of every
# column of every row, nothing left out). The two fingerprints must be equal.
# Anything that was in the local database is lost. It refuses to run against a
# database that is not local. It takes about a minute, so it is not part of
# `npm test`; the checks that are, are in src/lib/demo.
set -euo pipefail

cd "$(dirname "$0")/.."

# shellcheck source=scripts/lib/require-local.sh
source scripts/lib/require-local.sh

project_id=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml | head -n 1)
container="supabase_db_${project_id}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fingerprint() {
  docker exec -i "$container" psql -U postgres -d postgres -q -f - < scripts/demo-fingerprint.sql
}

for run in 1 2; do
  echo "Load ${run} of 2: resetting the local database at ${api_url}."
  npx supabase db reset > "$work/reset-${run}.log" 2>&1 || { cat "$work/reset-${run}.log" >&2; exit 1; }
  fingerprint > "$work/fingerprint-${run}.txt"
  echo "  $(wc -l < "$work/fingerprint-${run}.txt" | tr -d ' ') tables fingerprinted."
done

if diff "$work/fingerprint-1.txt" "$work/fingerprint-2.txt" > "$work/diff.txt"; then
  echo "The two loads are the same data in every column of every table."
else
  echo "The two loads differ. Tables (table|rows|fingerprint), first load then second:" >&2
  cat "$work/diff.txt" >&2
  exit 1
fi
