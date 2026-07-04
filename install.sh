#!/usr/bin/env bash
#
# Build the basecamp-mcp binary and install it as a launchd LaunchAgent so it
# starts at login and stays running. Idempotent — safe to re-run to update.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.basecamp.mcp"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
BINARY="$REPO_DIR/dist/basecamp-mcp"
LOGDIR="$HOME/Library/Logs"

echo "==> Building standalone binary"
cd "$REPO_DIR"
bun install >/dev/null
bun run build

# Resolve the basecamp CLI to an absolute path for the plist.
BASECAMP_BIN="$(command -v basecamp || true)"
if [ -z "$BASECAMP_BIN" ]; then
  echo "!! Could not find 'basecamp' on PATH. Install the CLI first." >&2
  exit 1
fi
echo "==> Using basecamp CLI at: $BASECAMP_BIN"

echo "==> Writing LaunchAgent to $PLIST_DEST"
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|__BINARY__|$BINARY|g" \
    -e "s|__BASECAMP_BIN__|$BASECAMP_BIN|g" \
    -e "s|__LOGDIR__|$LOGDIR|g" \
    "$REPO_DIR/com.basecamp.mcp.plist.template" > "$PLIST_DEST"

echo "==> (Re)loading the LaunchAgent"
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

sleep 1
PORT="$(/usr/bin/grep -A1 '<key>PORT</key>' "$PLIST_DEST" | tail -1 | sed -E 's/.*<string>(.*)<\/string>.*/\1/')"
echo "==> Checking health on port ${PORT}"
if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
  echo "✅ basecamp-mcp is running."
  echo
  echo "Add this URL as a custom connector in Claude Desktop:"
  echo "    http://127.0.0.1:${PORT}/mcp"
  echo
  echo "Logs: $LOGDIR/basecamp-mcp.log"
else
  echo "!! Health check failed. Check the log: $LOGDIR/basecamp-mcp.log" >&2
  exit 1
fi
