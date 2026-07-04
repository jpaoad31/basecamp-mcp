import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerTools } from "./tools.ts";

const PORT = Number(process.env.PORT || 7331);
// Bind to loopback only — this exposes your Basecamp account, so it must not
// be reachable from the network.
const HOSTNAME = process.env.HOST || "127.0.0.1";
const MCP_PATH = "/mcp";

// Active sessions: sessionId -> { server, transport }.
const sessions = new Map<
  string,
  { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }
>();

function makeServer(): McpServer {
  const server = new McpServer({
    name: "basecamp-mcp",
    version: "0.1.0",
  });
  registerTools(server);
  return server;
}

async function handleMcp(req: Request): Promise<Response> {
  const sessionId = req.headers.get("mcp-session-id") ?? undefined;

  // Existing session — route to its transport.
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!.transport.handleRequest(req);
  }

  // New session: must be an initialize request (only meaningful for POST).
  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.clone().json();
    } catch {
      body = undefined;
    }

    if (!sessionId && isInitializeRequest(body)) {
      const server = makeServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        // DNS-rebinding protection: only accept Host headers we expect.
        enableDnsRebindingProtection: true,
        allowedHosts: [
          `127.0.0.1:${PORT}`,
          `localhost:${PORT}`,
          `[::1]:${PORT}`,
        ],
        onsessioninitialized: (id) => {
          sessions.set(id, { server, transport });
        },
        onsessionclosed: (id) => {
          sessions.delete(id);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      // Pass the already-parsed body so the transport doesn't re-read it.
      return transport.handleRequest(req, { parsedBody: body });
    }
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: no valid session" },
      id: null,
    }),
    { status: 400, headers: { "content-type": "application/json" } },
  );
}

const bunServer = Bun.serve({
  port: PORT,
  hostname: HOSTNAME,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        sessions: sessions.size,
        name: "basecamp-mcp",
      });
    }

    if (url.pathname === MCP_PATH) {
      return handleMcp(req);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.error(
  `basecamp-mcp listening on http://${bunServer.hostname}:${bunServer.port}${MCP_PATH}`,
);
