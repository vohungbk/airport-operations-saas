#!/usr/bin/env bash
# PreToolUse hook for Bash: blocks rm -rf, git push --force, and overwriting .env* files.
# Logs every blocked attempt to .claude/logs/hooks.log.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_FILE="$REPO_ROOT/.claude/logs/hooks.log"
mkdir -p "$(dirname "$LOG_FILE")"

INPUT="$(cat)"
COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"

if [ -z "$COMMAND" ]; then
  exit 0
fi

REASON=""

# rm -rf (any flag order/combination: -rf, -fr, -Rf, -r -f, --recursive --force, ...)
if printf '%s' "$COMMAND" | grep -qE '(^|[;&|]|\s)rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-r(\s+\S+)*\s+-f|-f(\s+\S+)*\s+-r|--recursive(\s+\S+)*\s+--force|--force(\s+\S+)*\s+--recursive)'; then
  REASON="rm -rf (recursive force delete)"
fi

# git push --force / -f / --force-with-lease
if [ -z "$REASON" ] && printf '%s' "$COMMAND" | grep -qE '\bgit\s+push\b[^;&|]*(--force\b|--force-with-lease\b|\s-f\b)'; then
  REASON="git push --force"
fi

# Overwriting .env* files via redirection or cp/mv/tee
if [ -z "$REASON" ] && printf '%s' "$COMMAND" | grep -qE '(>{1,2}\s*[^;&|]*\.env[a-zA-Z0-9_.\-]*|\b(cp|mv|tee)\b[^;&|]*\.env[a-zA-Z0-9_.\-]*)'; then
  REASON="overwriting .env* file"
fi

if [ -n "$REASON" ]; then
  TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf '[%s] BLOCKED: %s | command: %s\n' "$TIMESTAMP" "$REASON" "$COMMAND" >> "$LOG_FILE"

  jq -n --arg reason "Blocked by pre-tool-use hook: $REASON" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
fi

exit 0
