# basecamp-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the `basecamp`
CLI to Claude Desktop (and any other MCP client) over HTTP. It runs as a
login-time background service and is reached at a local URL.

It's a thin wrapper: each MCP tool shells out to `basecamp <cmd> --json` and
returns the parsed result. Authentication is handled entirely by the CLI's own
token store — this server never sees your password and holds no credentials.

## Architecture

```
Claude Desktop ──HTTP(/mcp)──▶ basecamp-mcp (bun, :7331) ──spawn──▶ basecamp CLI ──▶ Basecamp API
     custom connector           launchd LaunchAgent, runs at login
```

- **Transport:** MCP Streamable HTTP (Web-standard `Request`/`Response` via `Bun.serve`).
- **Bind address:** `127.0.0.1` only, with DNS-rebinding protection — not reachable off-box.
- **Lifecycle:** a launchd LaunchAgent (`RunAtLoad` + `KeepAlive`) starts it at login and restarts it if it dies.
- **Runtime:** compiled to a single standalone executable with `bun build --compile` — Bun is only needed to build, not to run.

## Quick start (macOS)

You don't need anything installed first — the setup script handles it all
(Homebrew, the basecamp CLI, and Bun).

1. Open **Terminal** and paste this, then press Return:

   ```bash
   git clone https://github.com/jpaoad31/basecamp-mcp.git
   cd basecamp-mcp
   ./setup.sh
   ```

   It installs the prerequisites, builds the server, sets it to start at login,
   and opens a browser to log you into Basecamp. If asked for your Mac
   password, that's Homebrew installing — it's expected.
2. When it finishes it prints a URL. In **Claude Desktop → Settings →
   Connectors → Add custom connector**, paste that URL:

   ```
   http://127.0.0.1:7331/mcp
   ```

That's it. The server runs automatically every time you log in.

To update later: `cd basecamp-mcp && git pull && ./setup.sh`.

### No git? (zip install)

If someone sent you a zip instead: double-click to unzip, drag the
`basecamp-mcp` folder onto a Terminal window, press Return, then run
`./setup.sh`.

## Prerequisites (manual install)

- The `basecamp` CLI installed and on your PATH.
- [Bun](https://bun.sh) (to build).
- You must log the CLI in once: `basecamp auth login`.

## Install

```bash
bun install
./install.sh          # or: bun run install-service
```

## Packaging for someone else

```bash
./package.sh          # or: bun run package
```

Produces `basecamp-mcp.zip` (source + scripts only). Send it; they run
`./setup.sh`. The binary is compiled on *their* machine, which avoids macOS
Gatekeeper quarantine.

This builds `dist/basecamp-mcp`, writes a LaunchAgent to
`~/Library/LaunchAgents/com.basecamp.mcp.plist`, loads it, and health-checks it.

Then in **Claude Desktop → Settings → Connectors → Add custom connector**, use:

```
http://127.0.0.1:7331/mcp
```

## Tools

| Tool | What it does |
| --- | --- |
| `basecamp_auth_status` | Report CLI auth status |
| `basecamp_projects_list` | List projects (optionally by status) |
| `basecamp_search` | Full-text search across all content |
| `basecamp_show` | Show any item by ID or URL |
| `basecamp_todos_list` | List todos in a project |
| `basecamp_todo_create` | Create a todo |
| `basecamp_todo_complete` | Complete todo(s) |
| `basecamp_message_post` | Post to a message board |
| `basecamp_comment_add` | Comment on an item |
| `basecamp_card_create` | Create a card in a card table |
| `basecamp_chat_list` | List chats/campfires |
| `basecamp_chat_messages` | Read recent chat messages |
| `basecamp_chat_post` | Post a chat message |
| `basecamp_cli` | Escape hatch: run any `basecamp` command by argv |

## Development

```bash
bun run dev      # watch mode, http://127.0.0.1:7331/mcp
bun run start    # run once
bun run build    # produce dist/basecamp-mcp
curl -s http://127.0.0.1:7331/health   # liveness
```

Override the port with `PORT=…` and the CLI location with `BASECAMP_BIN=…`.

## Uninstall

```bash
./uninstall.sh   # or: bun run uninstall-service
```

## Notes & caveats

- **Security:** the `basecamp_cli` escape hatch can run *any* CLI command
  (including destructive ones and `auth token`). The server is bound to
  loopback for exactly this reason — anyone who can reach the port acts as you.
- **Claude Desktop connectors:** local `http://` connector URLs work with
  recent Desktop builds. If yours refuses a non-HTTPS URL, either update
  Desktop or fall back to a stdio MCP config pointing at the binary.
- **Logs:** `~/Library/Logs/basecamp-mcp.log`.
