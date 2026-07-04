#!/usr/bin/env bash
#
# One-shot setup for basecamp-mcp on a fresh Mac.
#
# Installs everything that's missing (Homebrew, the basecamp CLI, Bun), builds
# the server, installs it as a login service, logs you into Basecamp, and
# prints the URL to paste into Claude Desktop.
#
# Safe to re-run — every step checks before doing anything.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONNECTOR_URL="http://127.0.0.1:7331/mcp"

say()  { printf "\n\033[1;34m==>\033[0m %s\n" "$1"; }
ok()   { printf "\033[1;32m✅ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m⚠️  %s\033[0m\n" "$1"; }

# macOS tags everything extracted from a downloaded zip with a "quarantine"
# flag. Clear it on our own folder so the scripts run without nagging.
say "Clearing macOS quarantine flag on this folder"
xattr -dr com.apple.quarantine "$REPO_DIR" 2>/dev/null || true

# Load Homebrew into PATH if it's already installed, so we can see a
# brew-installed basecamp CLI. We do NOT install brew here — only later, and
# only if it turns out we actually need it.
load_brew() {
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}
load_brew

# --- 1. basecamp CLI ----------------------------------------------------
# Only install it (via Homebrew) if it isn't already on the PATH. If you
# installed it another way — e.g. Basecamp's own install script — this is
# skipped entirely and Homebrew is never touched.
if command -v basecamp >/dev/null 2>&1; then
  ok "basecamp CLI already installed ($(basecamp --version 2>/dev/null || echo present))"
else
  if ! command -v brew >/dev/null 2>&1; then
    say "Installing Homebrew (needed to install the basecamp CLI — you may be asked for your Mac password)"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    load_brew
  fi
  say "Installing the basecamp CLI"
  brew install --cask basecamp/tap/basecamp-cli
  ok "basecamp CLI ready ($(basecamp --version 2>/dev/null || echo installed))"
fi

# --- 2. Bun -------------------------------------------------------------
if ! command -v bun >/dev/null 2>&1; then
  say "Installing Bun"
  curl -fsSL https://bun.sh/install | bash
fi
# Bun installs to ~/.bun/bin; make sure it's on PATH for this run.
export PATH="$HOME/.bun/bin:$PATH"
if ! command -v bun >/dev/null 2>&1; then
  warn "Bun was installed but isn't on PATH. Open a new Terminal and re-run ./setup.sh"
  exit 1
fi
ok "Bun ready ($(bun --version))"

# --- 3. Build + install the login service -------------------------------
say "Building the server and installing the login service"
"$REPO_DIR/install.sh"

# --- 4. Log into Basecamp ----------------------------------------------
say "Checking Basecamp login"
if basecamp auth status --json 2>/dev/null | grep -q '"authenticated": true'; then
  ok "Already logged into Basecamp"
else
  warn "Not logged in yet — opening the Basecamp login flow"
  basecamp auth login
fi

# --- Done ---------------------------------------------------------------
cat <<EOF

────────────────────────────────────────────────────────────
🎉 All set!

In Claude Desktop:
  Settings → Connectors → Add custom connector

  Name:  Basecamp
  URL:   ${CONNECTOR_URL}

The server starts automatically every time you log in.
Logs: ~/Library/Logs/basecamp-mcp.log

To remove it later, run:  ./uninstall.sh
────────────────────────────────────────────────────────────
EOF
