import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { runBasecamp, type BasecampResult } from "./basecamp.ts";

/** Format a BasecampResult as an MCP tool result. */
function toToolResult(res: BasecampResult) {
  const payload = res.ok
    ? { ok: true, summary: res.summary, data: res.data }
    : { ok: false, error: res.error, code: res.code };
  return {
    isError: !res.ok,
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

/** Build the argv for a command, appending flags only when values are given. */
function withFlags(base: string[], flags: Record<string, unknown>): string[] {
  const args = [...base];
  for (const [flag, value] of Object.entries(flags)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "boolean") {
      if (value) args.push(flag);
    } else {
      args.push(flag, String(value));
    }
  }
  return args;
}

export function registerTools(server: McpServer) {
  // ---- Read / browse -----------------------------------------------------

  server.registerTool(
    "basecamp_auth_status",
    {
      title: "Check auth status",
      description:
        "Show whether the basecamp CLI is currently authenticated and which account it's using.",
      inputSchema: {},
    },
    async () => toToolResult(await runBasecamp(["auth", "status"])),
  );

  server.registerTool(
    "basecamp_projects_list",
    {
      title: "List projects",
      description:
        "List Basecamp projects. Use status to filter (active is the default).",
      inputSchema: {
        status: z
          .enum(["active", "archived", "trashed"])
          .optional()
          .describe("Filter by project status (default: active)"),
      },
    },
    async ({ status }) =>
      toToolResult(
        await runBasecamp(withFlags(["projects", "list"], { "--status": status })),
      ),
  );

  server.registerTool(
    "basecamp_search",
    {
      title: "Search Basecamp",
      description:
        "Full-text search across all Basecamp content (todos, messages, cards, docs, comments).",
      inputSchema: {
        query: z.string().describe("Search query"),
        limit: z.number().int().positive().optional().describe("Max results"),
        sort: z
          .enum(["relevance", "created_at", "updated_at"])
          .optional()
          .describe("Sort order (default: relevance)"),
        project: z
          .string()
          .optional()
          .describe("Restrict to a project (ID or name)"),
      },
    },
    async ({ query, limit, sort, project }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["search", query], {
            "--limit": limit,
            "--sort": sort === "relevance" ? undefined : sort,
            "--project": project,
          }),
        ),
      ),
  );

  server.registerTool(
    "basecamp_show",
    {
      title: "Show an item",
      description:
        "Show details of any Basecamp item by numeric ID or full URL. Optionally hint the type (todo, message, card, document, chat, etc.).",
      inputSchema: {
        idOrUrl: z.string().describe("Basecamp item ID or URL"),
        type: z
          .string()
          .optional()
          .describe("Content type hint, e.g. todo, message, card, document"),
      },
    },
    async ({ idOrUrl, type }) =>
      toToolResult(
        await runBasecamp(withFlags(["show", idOrUrl], { "--type": type })),
      ),
  );

  // ---- Todos -------------------------------------------------------------

  server.registerTool(
    "basecamp_todos_list",
    {
      title: "List todos",
      description:
        "List todos in a project. A project (ID or name) is usually required unless a default project is configured.",
      inputSchema: {
        project: z.string().optional().describe("Project ID or name"),
      },
    },
    async ({ project }) =>
      toToolResult(
        await runBasecamp(withFlags(["todos", "list"], { "--project": project })),
      ),
  );

  server.registerTool(
    "basecamp_todo_create",
    {
      title: "Create a todo",
      description:
        "Create a new todo. Content supports Markdown and @mentions (@First.Last).",
      inputSchema: {
        content: z.string().describe("The todo text"),
        project: z.string().optional().describe("Project ID or name"),
        todolist: z
          .string()
          .optional()
          .describe("Todolist ID (required if the project has multiple lists)"),
        assignee: z
          .string()
          .optional()
          .describe("Assignee(s), comma-separated names/emails/IDs"),
        due: z.string().optional().describe("Due date, e.g. 2026-07-15"),
      },
    },
    async ({ content, project, todolist, assignee, due }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["todos", "create", content], {
            "--project": project,
            "--todolist": todolist,
            "--assignee": assignee,
            "--due": due,
          }),
        ),
      ),
  );

  server.registerTool(
    "basecamp_todo_complete",
    {
      title: "Complete todo(s)",
      description: "Mark one or more todos complete by ID (comma-separated for many).",
      inputSchema: {
        ids: z.string().describe("Todo ID, or comma-separated IDs"),
        project: z.string().optional().describe("Project ID or name"),
      },
    },
    async ({ ids, project }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["todos", "complete", ids], { "--project": project }),
        ),
      ),
  );

  // ---- Messages / comments ----------------------------------------------

  server.registerTool(
    "basecamp_message_post",
    {
      title: "Post a message",
      description:
        "Post a message to a project's message board. Body supports Markdown and @mentions.",
      inputSchema: {
        title: z.string().describe("Message title"),
        body: z.string().optional().describe("Message body (Markdown)"),
        project: z.string().optional().describe("Project ID or name"),
        messageBoard: z
          .string()
          .optional()
          .describe("Message board ID (required if the project has multiple)"),
        draft: z.boolean().optional().describe("Create as an unpublished draft"),
      },
    },
    async ({ title, body, project, messageBoard, draft }) => {
      const base = body ? ["message", title, body] : ["message", title];
      return toToolResult(
        await runBasecamp(
          withFlags(base, {
            "--project": project,
            "--message-board": messageBoard,
            "--draft": draft,
          }),
        ),
      );
    },
  );

  server.registerTool(
    "basecamp_comment_add",
    {
      title: "Add a comment",
      description:
        "Add a comment to a Basecamp item (todo, message, card, etc.) by ID or URL. Supports Markdown and @mentions.",
      inputSchema: {
        idOrUrl: z
          .string()
          .describe("Item ID or URL (comma-separated IDs to comment on several)"),
        content: z.string().describe("Comment text (Markdown)"),
        project: z.string().optional().describe("Project ID or name"),
      },
    },
    async ({ idOrUrl, content, project }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["comment", idOrUrl, content], { "--project": project }),
        ),
      ),
  );

  // ---- Cards -------------------------------------------------------------

  server.registerTool(
    "basecamp_card_create",
    {
      title: "Create a card",
      description: "Create a card in a project's card table.",
      inputSchema: {
        title: z.string().describe("Card title"),
        body: z.string().optional().describe("Card body (Markdown)"),
        project: z.string().optional().describe("Project ID or name"),
        column: z
          .string()
          .optional()
          .describe("Column ID or name (defaults to the first column)"),
        cardTable: z
          .string()
          .optional()
          .describe("Card table ID (required if the project has multiple)"),
        assignee: z.string().optional().describe("Assignee ID or name"),
      },
    },
    async ({ title, body, project, column, cardTable, assignee }) => {
      const base = body ? ["card", title, body] : ["card", title];
      return toToolResult(
        await runBasecamp(
          withFlags(base, {
            "--project": project,
            "--column": column,
            "--card-table": cardTable,
            "--assignee": assignee,
          }),
        ),
      );
    },
  );

  // ---- Chat --------------------------------------------------------------

  server.registerTool(
    "basecamp_chat_list",
    {
      title: "List chats",
      description: "List the chats/campfire rooms in a project.",
      inputSchema: {
        project: z.string().optional().describe("Project ID or name"),
      },
    },
    async ({ project }) =>
      toToolResult(
        await runBasecamp(withFlags(["chat", "list"], { "--project": project })),
      ),
  );

  server.registerTool(
    "basecamp_chat_messages",
    {
      title: "View chat messages",
      description: "View recent messages from a project's chat.",
      inputSchema: {
        project: z.string().optional().describe("Project ID or name"),
        room: z.string().optional().describe("Campfire room ID"),
      },
    },
    async ({ project, room }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["chat", "messages"], { "--project": project, "--room": room }),
        ),
      ),
  );

  server.registerTool(
    "basecamp_chat_post",
    {
      title: "Post a chat message",
      description: "Post a message to a project's chat.",
      inputSchema: {
        message: z.string().describe("The message to post"),
        project: z.string().optional().describe("Project ID or name"),
        room: z.string().optional().describe("Campfire room ID"),
      },
    },
    async ({ message, project, room }) =>
      toToolResult(
        await runBasecamp(
          withFlags(["chat", "post", message], {
            "--project": project,
            "--room": room,
          }),
        ),
      ),
  );

  // ---- Escape hatch ------------------------------------------------------

  server.registerTool(
    "basecamp_cli",
    {
      title: "Run any basecamp command",
      description:
        "Escape hatch: run an arbitrary basecamp CLI command. Pass args as an array, e.g. [\"todos\", \"list\", \"--project\", \"123\"]. --json is added automatically. Use this for anything the dedicated tools don't cover.",
      inputSchema: {
        args: z
          .array(z.string())
          .describe("Argv passed to the basecamp binary (excluding the binary itself)"),
      },
    },
    async ({ args }) => toToolResult(await runBasecamp(args)),
  );
}
