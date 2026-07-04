#!/usr/bin/env bash
#
# Build the distributable zip to hand to someone else.
# Produces basecamp-mcp.zip containing only source + scripts — no node_modules,
# no compiled binary (those get built on the recipient's machine by setup.sh).
#
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$REPO_DIR/basecamp-mcp.zip"
STAGE="$(mktemp -d)/basecamp-mcp"

mkdir -p "$STAGE"
# Files that make up the shippable project.
cp -R \
  "$REPO_DIR/src" \
  "$REPO_DIR/index.ts" \
  "$REPO_DIR/package.json" \
  "$REPO_DIR/bun.lock" \
  "$REPO_DIR/tsconfig.json" \
  "$REPO_DIR/setup.sh" \
  "$REPO_DIR/install.sh" \
  "$REPO_DIR/uninstall.sh" \
  "$REPO_DIR/com.basecamp.mcp.plist.template" \
  "$REPO_DIR/README.md" \
  "$STAGE/"

chmod +x "$STAGE"/*.sh

rm -f "$OUT"
( cd "$(dirname "$STAGE")" && zip -r -X "$OUT" "basecamp-mcp" >/dev/null )
rm -rf "$(dirname "$STAGE")"

echo "✅ Built $OUT"
echo "   Send it to your sister. She unzips it and runs ./setup.sh"
ls -lh "$OUT"
