#!/usr/bin/env bash
# .claude/bin/cc-worktree
#
# Worktree manager with governance checks. Creates / switches / removes git
# worktrees and opens them in the engineer's IDE. Does NOT auto-launch Claude
# Code — the engineer starts Claude themselves in the IDE's integrated terminal.
#
# Usage:
#   cc-worktree list                                  List worktrees + orphan branches
#   cc-worktree new <type>/<issue#>-<slug>            Create + open new worktree
#                  [--force-new-branch]
#                  [--ide <name> | --no-ide]
#                  [--ide-mode reuse|new|add]
#   cc-worktree switch <branch-or-path> [ide flags]   Open existing worktree
#   cc-worktree rm <branch-or-path> [--delete-branch] Remove worktree
#   cc-worktree prune                                 Clean stale references
#   cc-worktree open [ide flags]                      Open current worktree in IDE
#
# IDE selection priority (first match wins):
#   1. --ide <name>
#   2. $CC_WORKTREE_IDE env var
#   3. $TERM_PROGRAM (auto-detect when running inside IDE's integrated terminal)
#   4. $EDITOR
#   5. Interactive prompt if multiple IDEs are on PATH
#   6. First IDE CLI found on PATH (if exactly one)
#
# IDE mode priority (how to open the worktree):
#   1. --ide-mode <reuse|new|add>
#   2. $CC_WORKTREE_IDE_MODE env var
#   3. Interactive prompt (asks user each time)
#   4. Per-IDE default (if prompt skipped in non-interactive mode):
#        VS Code / Cursor / Windsurf:  new    (new window, keep current open)
#        Zed:                          new    (new window — Zed has no reuse semantics)
#        Sublime Text:                 add    (multi-root workspace)
#        JetBrains:                    new
#
# Set CC_WORKTREE_IDE=none (or pass --no-ide) to skip the IDE step entirely.
# Set CC_WORKTREE_IDE_MODE=new (or reuse/add) to skip the interactive prompt.

set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -z "$REPO_ROOT" ]]; then
    echo "✗ Not inside a git repository." >&2
    exit 1
fi

COMMON_DIR=$(git rev-parse --git-common-dir)
PRIMARY_ROOT=$(cd "$COMMON_DIR/.." && pwd)
WORKTREE_BASE="$PRIMARY_ROOT/../worktrees"

# ─────────────────────────────────────────────────────────
# IDE detection
# ─────────────────────────────────────────────────────────

KNOWN_IDES=(code cursor code-insiders windsurf zed subl idea webstorm phpstorm pycharm rubymine goland rider clion appcode datagrip)

term_program_to_cli() {
    case "${TERM_PROGRAM:-}" in
        vscode)   echo "code" ;;
        cursor*)  echo "cursor" ;;
        Windsurf) echo "windsurf" ;;
        zed)      echo "zed" ;;
        *)        echo "" ;;
    esac
}

editor_to_cli() {
    case "${EDITOR:-}" in
        *code*)     echo "code" ;;
        *cursor*)   echo "cursor" ;;
        *windsurf*) echo "windsurf" ;;
        *zed*)      echo "zed" ;;
        *subl*)     echo "subl" ;;
        *)          echo "" ;;
    esac
}

ide_display_name() {
    case "$1" in
        code)            echo "VS Code" ;;
        code-insiders)   echo "VS Code Insiders" ;;
        cursor)          echo "Cursor" ;;
        windsurf)        echo "Windsurf" ;;
        zed)             echo "Zed" ;;
        subl)            echo "Sublime Text" ;;
        idea)            echo "IntelliJ IDEA" ;;
        webstorm)        echo "WebStorm" ;;
        phpstorm)        echo "PhpStorm" ;;
        pycharm)         echo "PyCharm" ;;
        rubymine)        echo "RubyMine" ;;
        goland)          echo "GoLand" ;;
        rider)           echo "Rider" ;;
        clion)           echo "CLion" ;;
        appcode)         echo "AppCode" ;;
        datagrip)        echo "DataGrip" ;;
        *)               echo "$1" ;;
    esac
}

list_available_ides() {
    local found=()
    for c in "${KNOWN_IDES[@]}"; do
        if command -v "$c" >/dev/null 2>&1; then
            found+=("$c")
        fi
    done
    printf '%s\n' "${found[@]+"${found[@]}"}"
}

prompt_for_ide() {
    local available=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && available+=("$line")
    done < <(list_available_ides)

    if [[ ${#available[@]} -eq 0 ]]; then
        echo ""
        return
    fi

    if [[ ${#available[@]} -eq 1 ]]; then
        echo "${available[0]}"
        return
    fi

    {
        echo ""
        echo "Multiple IDEs detected. Pick one:"
        local i=1
        for ide in "${available[@]}"; do
            echo "  $i) $(ide_display_name "$ide")  ($ide)"
            i=$((i + 1))
        done
        echo "  s) skip (don't open an IDE)"
        echo ""
        printf "Choice [1-%d / s]: " "${#available[@]}"
    } >&2

    local choice
    read -r choice </dev/tty

    if [[ "$choice" == "s" || "$choice" == "S" ]]; then
        echo "none"
        return
    fi

    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#available[@]} )); then
        echo "${available[$((choice - 1))]}"
        return
    fi

    echo "✗ Invalid choice. Skipping IDE." >&2
    echo "none"
}

detect_ide() {
    local override="${1:-}"

    if [[ -n "$override" ]]; then
        echo "$override"; return
    fi

    if [[ -n "${CC_WORKTREE_IDE:-}" ]]; then
        echo "$CC_WORKTREE_IDE"; return
    fi

    local from_term; from_term=$(term_program_to_cli)
    if [[ -n "$from_term" ]] && command -v "$from_term" >/dev/null 2>&1; then
        echo "$from_term"; return
    fi

    local from_editor; from_editor=$(editor_to_cli)
    if [[ -n "$from_editor" ]] && command -v "$from_editor" >/dev/null 2>&1; then
        echo "$from_editor"; return
    fi

    prompt_for_ide
}

default_mode_for_ide() {
    case "$1" in
        code|code-insiders|cursor|windsurf) echo "new" ;;
        zed)                                echo "new" ;;
        subl)                               echo "add" ;;
        idea|webstorm|phpstorm|pycharm|rubymine|goland|rider|clion|appcode|datagrip) echo "new" ;;
        *)                                  echo "new" ;;
    esac
}

resolve_mode_for_ide() {
    local ide="$1"
    local requested="$2"

    case "$ide" in
        zed)
            case "$requested" in
                reuse)
                    echo "ℹ Zed has no --reuse-window equivalent. Using 'new' instead." >&2
                    echo "  (To add as multi-root folder, use --ide-mode add.)" >&2
                    echo "new"
                    ;;
                new|add) echo "$requested" ;;
                *)       echo "new" ;;
            esac
            ;;
        code|code-insiders|cursor|windsurf)
            case "$requested" in
                reuse|new) echo "$requested" ;;
                add)
                    echo "ℹ VS Code-family IDEs don't support 'add' mode. Using 'new'." >&2
                    echo "new"
                    ;;
                *) echo "new" ;;
            esac
            ;;
        subl)
            case "$requested" in
                add|new) echo "$requested" ;;
                *)       echo "add" ;;
            esac
            ;;
        *)
            echo "new"
            ;;
    esac
}

open_in_ide() {
    local ide="$1"
    local path="$2"
    local mode="$3"

    if [[ -z "$ide" || "$ide" == "none" ]]; then return 0; fi

    if ! command -v "$ide" >/dev/null 2>&1; then
        echo "⚠ IDE CLI '$ide' not found on PATH. Skipping IDE open." >&2
        case "$ide" in
            code|code-insiders) echo "  Install: Cmd+Shift+P → 'Shell Command: Install code command in PATH'" >&2 ;;
            cursor)             echo "  Install: Cmd+Shift+P → 'Shell Command: Install cursor command'" >&2 ;;
            windsurf)           echo "  Install: Cmd+Shift+P → 'Windsurf: Install Shell Command'" >&2 ;;
            zed)                echo "  Install: Cmd+Shift+P → 'cli: install'" >&2 ;;
        esac
        return 1
    fi

    mode=$(resolve_mode_for_ide "$ide" "$mode")

    case "$ide" in
        code|code-insiders|cursor|windsurf)
            if [[ "$mode" == "reuse" ]]; then
                "$ide" --reuse-window "$path" >/dev/null 2>&1 &
            else
                "$ide" --new-window "$path" >/dev/null 2>&1 &
            fi
            ;;
        zed)
            case "$mode" in
                add) "$ide" --add "$path" >/dev/null 2>&1 & ;;
                *)   "$ide" --new "$path" >/dev/null 2>&1 & ;;
            esac
            ;;
        subl)
            case "$mode" in
                add) "$ide" --add "$path" >/dev/null 2>&1 & ;;
                new) "$ide" --new-window "$path" >/dev/null 2>&1 & ;;
                *)   "$ide" "$path" >/dev/null 2>&1 & ;;
            esac
            ;;
        idea|webstorm|phpstorm|pycharm|rubymine|goland|rider|clion|appcode|datagrip)
            "$ide" "$path" >/dev/null 2>&1 &
            ;;
        *)
            "$ide" "$path" >/dev/null 2>&1 &
            ;;
    esac

    sleep 0.3
    echo "✓ IDE: $(ide_display_name "$ide") ($mode) → $path"
    return 0
}

# ─────────────────────────────────────────────────────────
# Branch helpers
# ─────────────────────────────────────────────────────────
validate_branch_name() {
    local branch="$1"
    local pattern='^(feat|fix|hotfix|refactor|perf|test|docs|chore|security)/([A-Z]+-[0-9]+-)?[a-z0-9][a-z0-9-]*[a-z0-9]$'
    if [[ ! "$branch" =~ $pattern ]]; then
        cat >&2 <<EOF
✗ Invalid branch name: $branch

Per .claude/rules/00-git-workflow.md, branches must match:
  feat/<issue#>-<slug>       e.g. feat/42-telemetry-capture
  fix/<issue#>-<slug>
  hotfix/<issue#>-<slug>
  security/<issue#>-<slug>
  chore/<slug>
EOF
        return 1
    fi
    return 0
}

branch_to_dirname() { echo "$1" | tr '/' '-'; }
branch_exists() { git show-ref --verify --quiet "refs/heads/$1"; }

worktree_path_for_branch() {
    git worktree list --porcelain | awk -v b="refs/heads/$1" '
        /^worktree / { wt = $2 }
        /^branch / { if ($2 == b) print wt }
    '
}

pick_base_branch() {
    if [[ "$1" =~ ^hotfix/ ]]; then
        echo "main"
    elif git show-ref --verify --quiet refs/heads/develop; then
        echo "develop"
    else
        echo "main"
    fi
}

# ─────────────────────────────────────────────────────────
# IDE-flag parsing — bash 3.2-safe
# ─────────────────────────────────────────────────────────
IDE_OVERRIDE=""
IDE_MODE=""
NO_IDE=0
REMAINING=()

parse_ide_flags() {
    local args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --ide)      IDE_OVERRIDE="$2"; shift 2 ;;
            --no-ide)   NO_IDE=1; shift ;;
            --ide-mode) IDE_MODE="$2"; shift 2 ;;
            *)          args+=("$1"); shift ;;
        esac
    done
    REMAINING=("${args[@]+"${args[@]}"}")
}

# ─────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────
cmd_list() {
    echo "Active worktrees:"
    git worktree list

    local orphans=()
    while IFS= read -r b; do
        b="${b## }"; b="${b#\* }"
        case "$b" in main|master|develop|"") continue ;; esac
        local pattern='^(feat|fix|hotfix|refactor|perf|test|docs|chore|security)/'
        [[ "$b" =~ $pattern ]] || continue
        local wt; wt=$(worktree_path_for_branch "$b")
        [[ -z "$wt" ]] && orphans+=("$b")
    done < <(git branch --format='%(refname:short)')

    if [[ ${#orphans[@]} -gt 0 ]]; then
        echo ""
        echo "Orphan branches (no worktree attached):"
        for b in "${orphans[@]+"${orphans[@]}"}"; do echo "  $b"; done
        echo ""
        echo "  Re-attach:  make worktree-new <branch>"
        echo "  Delete:     git branch -D <branch>"
    fi
}

cmd_new() {
    local branch="${1:-}"
    [[ -n "$branch" ]] || { echo "Usage: make worktree-new <type>/<issue#>-<slug>"; exit 1; }
    shift || true

    local force_new=0
    parse_ide_flags "$@"
    set -- "${REMAINING[@]+"${REMAINING[@]}"}"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force-new-branch) force_new=1; shift ;;
            *) echo "Unknown flag: $1" >&2; exit 1 ;;
        esac
    done

    validate_branch_name "$branch" || exit 1
    git worktree prune

    local dirname; dirname=$(branch_to_dirname "$branch")
    local path="$WORKTREE_BASE/$dirname"

    if [[ -e "$path" ]]; then
        echo "✗ Path already exists: $path" >&2
        echo "  Run: make worktree-rm $branch" >&2
        exit 1
    fi

    local existing; existing=$(worktree_path_for_branch "$branch")
    if [[ -n "$existing" ]]; then
        echo "ℹ Branch '$branch' is already checked out at: $existing"
        cd "$existing"
        finish_in_worktree
        return
    fi

    mkdir -p "$WORKTREE_BASE"

    if branch_exists "$branch"; then
        if [[ "$force_new" == "1" ]]; then
            git branch -D "$branch"
            local base; base=$(pick_base_branch "$branch")
            git worktree add -b "$branch" "$path" "$base"
        else
            echo "ℹ Branch '$branch' already exists. Attaching new worktree."
            git worktree add "$path" "$branch"
        fi
    else
        local base; base=$(pick_base_branch "$branch")
        echo "Creating worktree: $branch ← $base → $path"
        git worktree add -b "$branch" "$path" "$base"
    fi

    cd "$path"
    finish_in_worktree
}

cmd_switch() {
    local target="${1:-}"
    [[ -n "$target" ]] || { echo "Usage: make worktree-switch <branch>"; exit 1; }
    shift || true
    parse_ide_flags "$@"

    git worktree prune

    local path=""
    if [[ -d "$target" ]]; then
        path=$(cd "$target" && pwd)
    else
        path=$(worktree_path_for_branch "$target")
    fi

    if [[ -z "$path" || ! -d "$path" ]]; then
        if branch_exists "$target"; then
            echo "✗ Branch '$target' exists but has no active worktree." >&2
            echo "  Attach one:  make worktree-new $target" >&2
        else
            echo "✗ No branch or worktree found for: $target" >&2
            echo ""
            cmd_list
        fi
        exit 1
    fi

    cd "$path"
    finish_in_worktree
}

cmd_rm() {
    local target="${1:-}"
    local delete_branch=0
    [[ -n "$target" ]] || { echo "Usage: make worktree-rm <branch>"; exit 1; }

    shift || true
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --delete-branch) delete_branch=1; shift ;;
            *) echo "Unknown flag: $1" >&2; exit 1 ;;
        esac
    done

    local path="" branch=""
    if [[ -d "$target" ]]; then
        path=$(cd "$target" && pwd)
        branch=$(git -C "$path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    else
        path=$(worktree_path_for_branch "$target")
        branch="$target"
    fi

    if [[ -z "$path" ]]; then
        if branch_exists "$branch"; then
            echo "ℹ No worktree attached to branch '$branch'."
            if [[ "$delete_branch" == "1" ]]; then git branch -D "$branch"; fi
            git worktree prune
            return
        fi
        echo "✗ Not found: $target" >&2
        exit 1
    fi

    git worktree remove "$path"
    if [[ "$delete_branch" == "1" && -n "$branch" ]]; then
        git branch -D "$branch"
    fi
    git worktree prune
}

cmd_prune() {
    git worktree prune -v
}

cmd_open() {
    parse_ide_flags "$@"
    finish_in_worktree
}

# Core handoff. Open IDE → exit. No claude launch.
finish_in_worktree() {
    cd "$(git rev-parse --show-toplevel)"
    local path; path=$(pwd)

    if [[ "$NO_IDE" == "1" ]]; then
        echo ""
        echo "✓ Worktree ready: $path"
        echo ""
        echo "  To work on it:"
        echo "    cd $path"
        echo "    claude"
        return 0
    fi

    local ide; ide=$(detect_ide "$IDE_OVERRIDE")

    if [[ -z "$ide" || "$ide" == "none" ]]; then
        echo ""
        echo "✓ Worktree ready: $path"
        echo ""
        echo "  No IDE selected. To work on it:"
        echo "    cd $path"
        echo "    claude"
        return 0
    fi

    # User preference: IDE mode set during harness setup
    local requested_mode="${IDE_MODE:-${CC_WORKTREE_IDE_MODE:-new}}"

    open_in_ide "$ide" "$path" "$requested_mode" || true

    echo ""
    echo "✓ Worktree ready: $path"
    echo ""
    echo "  Next steps in the IDE:"
    case "$ide" in
        code|cursor|windsurf|code-insiders) echo "    1. Open the integrated terminal  (Cmd+\` on macOS, Ctrl+\` elsewhere)" ;;
        zed)                                 echo "    1. Open the integrated terminal  (Ctrl+\`)" ;;
        subl)                                echo "    1. Open a terminal (Sublime needs the Terminus plugin or external terminal)" ;;
        idea|webstorm|phpstorm|pycharm|rubymine|goland|rider|clion|appcode|datagrip)
                                             echo "    1. Open the integrated terminal  (View → Tool Windows → Terminal, or Alt+F12)" ;;
        *)                                   echo "    1. Open the integrated terminal in $(ide_display_name "$ide")" ;;
    esac
    echo "    2. Run: claude"
    echo ""
}

# ─────────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────────
CMD="${1:-open}"
shift || true

case "$CMD" in
    list|ls)         cmd_list "$@" ;;
    new|create)      cmd_new "$@" ;;
    switch|sw|use)   cmd_switch "$@" ;;
    rm|remove)       cmd_rm "$@" ;;
    prune)           cmd_prune "$@" ;;
    open|.|current)  cmd_open "$@" ;;
    -h|--help|help)
        sed -n '4,33p' "$0"
        ;;
    *)
        echo "Unknown command: $CMD" >&2
        sed -n '4,33p' "$0" >&2
        exit 1
        ;;
esac
