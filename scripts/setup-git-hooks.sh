#!/usr/bin/env bash
#
# Cai dat git hooks cho du an (chi co pre-commit hien tai).
# Chay tu dong khi `npm install` (xem "prepare" script trong package.json),
# hoac chay thu cong: bash scripts/setup-git-hooks.sh
#
# Cach lam: copy cac hook da duoc version-control trong .githooks/ vao
# .git/hooks/ va cap quyen thuc thi. Dung cach copy (thay vi core.hooksPath)
# de .git/hooks/pre-commit luon la ban duoc cai dat that su tren may dev,
# giong nhu khi lam thu cong theo huong dan trong docs/git-hooks.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/.githooks"
DEST_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "Khong tim thay .git — bo qua cai dat git hooks (co the dang chay trong CI/checkout khong day du)."
  exit 0
fi

mkdir -p "$DEST_DIR"

for hook_path in "$SRC_DIR"/*; do
  [ -f "$hook_path" ] || continue
  hook_name="$(basename "$hook_path")"
  cp "$hook_path" "$DEST_DIR/$hook_name"
  chmod +x "$DEST_DIR/$hook_name"
  echo "Da cai dat hook: $hook_name"
done

echo "Xong. Git hooks da san sang tai .git/hooks/."
