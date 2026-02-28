#!/usr/bin/env bash
# auto-push.sh
#
# Bash entry-point for the po-npr conflict resolver.
# Builds the TypeScript source (if needed) then runs it.
#
# Usage:
#   ./scripts/auto-push.sh [--strategy ours|theirs] [--remote <name>]
#
# Environment variables (all optional):
#   CONFLICT_STRATEGY  ours | theirs   (default: ours)
#   GIT_REMOTE         remote name     (default: origin)
#   COMMIT_MESSAGE     custom message  (default: chore: auto-resolve conflicts [skip ci])

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse optional CLI flags (override env vars)
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strategy)
      export CONFLICT_STRATEGY="${2:?'--strategy requires a value (ours|theirs)'}"
      shift 2
      ;;
    --remote)
      export GIT_REMOTE="${2:?'--remote requires a value'}"
      shift 2
      ;;
    --message)
      export COMMIT_MESSAGE="${2:?'--message requires a value'}"
      shift 2
      ;;
    *)
      echo "[po-npr] Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Ensure we are inside a git repository
# ---------------------------------------------------------------------------
if ! git -C "${REPO_ROOT}" rev-parse --git-dir > /dev/null 2>&1; then
  echo "[po-npr] ERROR: Not inside a git repository." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Build the TypeScript source if dist/ is missing or stale
# ---------------------------------------------------------------------------
DIST="${REPO_ROOT}/dist/resolve-conflicts.js"

if [[ ! -f "${DIST}" ]] || \
   [[ "${REPO_ROOT}/src/resolve-conflicts.ts" -nt "${DIST}" ]]; then
  echo "[po-npr] Building TypeScript…"
  cd "${REPO_ROOT}"
  # Install dependencies if node_modules is absent
  if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
    npm install --silent
  fi
  npm run build
fi

# ---------------------------------------------------------------------------
# Run the resolver
# ---------------------------------------------------------------------------
echo "[po-npr] Running conflict resolver…"
node "${DIST}"
