#!/usr/bin/env bash
# Prevent modifications to ejected library code in TiptapEditor vendor directory
# Can be run directly as a git hook or executed to install itself

PROTECTED_DIR="frontends/ol-components/src/components/TiptapEditor/vendor"

# If run with --install flag, configure git to use tracked hooks via include.path
if [ "$1" = "--install" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
    TRACKED_HOOKS_DIR="$REPO_ROOT/scripts/git-hooks/hooks"
    GITCONFIG_FILE="$REPO_ROOT/.gitconfig"

    if [ ! -d "$REPO_ROOT/.git" ]; then
        echo "Error: .git directory not found. Are you in a git repository?"
        exit 1
    fi

    if [ ! -d "$TRACKED_HOOKS_DIR" ]; then
        echo "Error: Tracked hooks directory not found at $TRACKED_HOOKS_DIR"
        exit 1
    fi

    if [ ! -f "$GITCONFIG_FILE" ]; then
        echo "Error: .gitconfig file not found at $GITCONFIG_FILE"
        exit 1
    fi

    # Configure git to include the tracked .gitconfig file
    # This makes hooks work automatically for everyone without manual installation
    if ! git config --local include.path ../.gitconfig 2>/dev/null; then
        echo "Warning: Could not configure git hooks (not in a git repository?)"
        echo "  Hooks are available at: $TRACKED_HOOKS_DIR"
        echo "  Run this script again after initializing git to enable protection."
        exit 0  # Don't fail - this might be CI/CD or non-git environment
    fi

    echo "Git hooks configured successfully!"
    echo "  Git will now use hooks from: $TRACKED_HOOKS_DIR"
    echo "  Configuration is tracked in: $GITCONFIG_FILE"
    echo "  The TiptapEditor vendor directory is now protected from modifications."
    exit 0
fi

# Otherwise, run the protection check
# Get list of files being staged/modified
changed_files=$(git diff --cached --name-only --diff-filter=ACM)

# Check if any protected files are being modified
protected_changes=$(echo "$changed_files" | grep "^${PROTECTED_DIR}/" || true)

if [ -n "$protected_changes" ]; then
    echo "Error: Attempted to modify protected library code in ${PROTECTED_DIR}/"
    echo ""
    echo "The following files are protected and cannot be modified:"
    echo "$protected_changes" | sed 's/^/  - /'
    echo ""
    echo "This directory contains ejected library code that should not be changed."
    echo ""
    echo "To unstage these files, run:"
    echo "$protected_changes" | sed 's/^/  git reset HEAD /'
    exit 1
fi

exit 0
