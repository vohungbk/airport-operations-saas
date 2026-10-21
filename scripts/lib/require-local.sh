# Sourced by the demo scripts. Stops unless the Supabase stack is running and
# its API is on this machine; sets $api_url. These scripts replace a database,
# so they must never reach one that is shared or remote (VI-F07-S01, spec E1).

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
