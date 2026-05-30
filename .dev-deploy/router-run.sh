#!/usr/bin/env bash
# Run an arbitrary command (or a script piped on stdin) on the dev router
# defined in .dev-deploy/target.env. Reuses the project SSH key.
#
# Usage:
#   .dev-deploy/router-run.sh 'uptime; echo hi'        # run a command
#   .dev-deploy/router-run.sh < some_script.sh         # pipe a script to remote sh -s
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET_ENV_FILE="$SCRIPT_DIR/target.env"
KEY="$SCRIPT_DIR/.ssh/id_ed25519"

[[ -f "$TARGET_ENV_FILE" ]] || { echo "ERROR: missing $TARGET_ENV_FILE" >&2; exit 1; }
[[ -f "$KEY" ]] || { echo "ERROR: missing SSH key $KEY" >&2; exit 1; }

# shellcheck source=/dev/null
source "$TARGET_ENV_FILE"
ROUTER_HOST="${ROUTER_HOST:-}"
ROUTER_USER="${ROUTER_USER:-root}"
ROUTER_PORT="${ROUTER_PORT:-22}"
[[ -n "$ROUTER_HOST" ]] || { echo "ERROR: ROUTER_HOST is required in target.env" >&2; exit 1; }

# Copy the key to a private temp file with strict perms (repo key is often 644
# on Windows/NTFS, which OpenSSH rejects).
RT="$(mktemp)"
cp "$KEY" "$RT"
chmod 600 "$RT"
trap 'rm -f "$RT"' EXIT

SSH_OPTS=(
  -i "$RT"
  -p "$ROUTER_PORT"
  -o BatchMode=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=10
  -o ConnectionAttempts=1
)

if [[ "$#" -gt 0 ]]; then
  ssh "${SSH_OPTS[@]}" "$ROUTER_USER@$ROUTER_HOST" "$*"
else
  # No args: read a script from stdin and run it on the remote shell.
  ssh "${SSH_OPTS[@]}" "$ROUTER_USER@$ROUTER_HOST" 'sh -s'
fi
