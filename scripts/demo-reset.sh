#!/usr/bin/env bash
# Loads the demo data from a clean start (VI-F07-S01).
#
#   npm run demo:reset
#
# It resets the LOCAL database (every migration, then supabase/seed.sql and
# supabase/seeds/demo.sql, in that order) and then checks that the demo data is
# coherent and that every role can sign in. Anything that was in the local
# database is lost. It refuses to run against a database that is not local.
#
# If a load fails halfway, run it again: a reset always returns to a clean state.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! status_json=$(npx supabase status -o json 2>/dev/null); then
  echo "The local Supabase stack is not running. Start it with: npx supabase start" >&2
  exit 1
fi

api_url=$(printf '%s' "$status_json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).API_URL||""))')

case "$api_url" in
  http://127.0.0.1:* | http://localhost:* | "http://[::1]:"*) ;;
  *)
    echo "Refusing to reset: the database is not local (API URL: ${api_url:-unknown})." >&2
    exit 1
    ;;
esac

echo "Resetting the local database at ${api_url}. Everything in it will be replaced."
npx supabase db reset

echo "Checking the demo data."
npx vitest run src/lib/demo

echo "Demo data is loaded and checked. The demo accounts are listed in docs/database.md (Demo data)."
