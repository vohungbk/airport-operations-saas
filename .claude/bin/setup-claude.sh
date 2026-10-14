#!/usr/bin/env bash
# .claude/bin/setup-claude.sh
#
# One-time per-developer setup. Run: make setup

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo "Setting up Claude Code + worktree governance..."

# 1. Install tracked git hooks (project copies .githooks/* into .git/hooks/)
bash scripts/setup-git-hooks.sh

# 2. Make all scripts executable
chmod +x .githooks/* 2>/dev/null || true
chmod +x .claude/hooks/*.sh 2>/dev/null || true
chmod +x .claude/bin/* 2>/dev/null || true
echo "✓ scripts made executable"

# 3. Sanity check: claude CLI installed?
if ! command -v claude >/dev/null 2>&1; then
    echo "⚠ 'claude' CLI not found. Install: npm install -g @anthropic-ai/claude-code"
fi

# 4. Suggest local settings file
if [[ ! -f .claude/settings.local.json ]]; then
    echo ""
    echo "ℹ Consider creating .claude/settings.local.json for personal overrides."
    echo "  Ensure it's in .gitignore."
fi

echo ""
echo "✓ Setup complete. Usage:"
echo ""
echo "  make worktree-new feat/42-telemetry-capture # create worktree + open IDE"
echo "  make worktree-list                          # show all worktrees"
echo "  make worktree-switch feat/42-telemetry-capture # switch to worktree + open IDE"
echo "  make worktree-current                       # open IDE in current worktree"
echo "  make worktree-rm feat/42-telemetry-capture  # remove worktree"
echo ""
echo "  Then in IDE terminal: claude"
