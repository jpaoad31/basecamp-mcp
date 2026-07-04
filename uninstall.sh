#!/usr/bin/env bash
# Stop and remove the basecamp-mcp LaunchAgent.
set -euo pipefail
LABEL="com.basecamp.mcp"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ -f "$PLIST_DEST" ]; then
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
  rm -f "$PLIST_DEST"
  echo "✅ Removed $PLIST_DEST and stopped the service."
else
  echo "Nothing to do — $PLIST_DEST not found."
fi
