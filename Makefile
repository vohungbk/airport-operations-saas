.PHONY: help setup worktree-new worktree-switch worktree-list worktree-current worktree-rm

help:
	@echo "Available commands:"
	@echo "  make setup                     One-time setup after clone"
	@echo "  make worktree-new <branch>     Create new worktree + open IDE (prompts for mode)"
	@echo "  make worktree-switch <branch>  Switch to existing worktree (prompts for mode)"
	@echo "  make worktree-list             List all worktrees"
	@echo "  make worktree-current          Open IDE in current worktree"
	@echo "  make worktree-rm <branch>      Remove worktree"
	@echo ""
	@echo "Environment variables:"
	@echo "  CC_WORKTREE_IDE_MODE=new       Skip prompt, always open in new window"
	@echo "  CC_WORKTREE_IDE_MODE=reuse     Skip prompt, always replace current window"

setup:
	@.claude/bin/setup-claude.sh
	@echo ""
	@echo "Setting up dependencies..."
	@npm install
	@echo "✅ Setup complete"

# Worktree commands with branch positional argument
worktree-new:
	@if [ -z "$(filter-out $@,$(MAKECMDGOALS))" ]; then \
		echo "Usage: make worktree-new <branch-name>"; \
		echo "Example: make worktree-new feat/42-add-search"; \
		exit 1; \
	fi
	@./.claude/bin/cc-worktree.sh new "$(filter-out $@,$(MAKECMDGOALS))"

worktree-switch:
	@if [ -z "$(filter-out $@,$(MAKECMDGOALS))" ]; then \
		echo "Usage: make worktree-switch <branch-name>"; \
		exit 1; \
	fi
	@./.claude/bin/cc-worktree.sh switch "$(filter-out $@,$(MAKECMDGOALS))"

worktree-list:
	@./.claude/bin/cc-worktree.sh list

worktree-current:
	@./.claude/bin/cc-worktree.sh current

worktree-rm:
	@if [ -z "$(filter-out $@,$(MAKECMDGOALS))" ]; then \
		echo "Usage: make worktree-rm <branch-name>"; \
		exit 1; \
	fi
	@./.claude/bin/cc-worktree.sh rm "$(filter-out $@,$(MAKECMDGOALS))"

# Prevent make from treating branch names as targets
%:
	@:
