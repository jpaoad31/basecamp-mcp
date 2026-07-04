/**
 * Thin wrapper around the `basecamp` CLI.
 *
 * Every command is invoked with `--json` so we get the standard envelope:
 *   { "ok": true,  "data": ..., "summary": "..." }
 *   { "ok": false, "error": "...", "code": "..." }
 *
 * We never pass args through a shell — they go straight to spawn as an argv
 * array, so there's no quoting/injection surface.
 */

export const BASECAMP_BIN = process.env.BASECAMP_BIN || "basecamp";

export interface BasecampResult {
  ok: boolean;
  /** Parsed `data` field from the JSON envelope, when present. */
  data?: unknown;
  /** Human-readable summary the CLI includes on success. */
  summary?: string;
  /** Error message from the envelope, or a transport-level failure. */
  error?: string;
  code?: string;
  /** Exit code of the process. */
  exitCode: number;
  /** Raw stdout, in case a caller wants the unparsed payload. */
  raw: string;
}

/**
 * Run a basecamp command. `args` is the argv after the binary name, e.g.
 * ["todos", "list", "--project", "123"]. `--json` is appended automatically
 * unless the caller already asked for a different output format.
 */
export async function runBasecamp(args: string[]): Promise<BasecampResult> {
  const wantsFormat = args.some((a) =>
    ["-j", "--json", "-m", "--md", "-q", "--quiet"].includes(a),
  );
  const finalArgs = wantsFormat ? args : [...args, "--json"];

  const proc = Bun.spawn([BASECAMP_BIN, ...finalArgs], {
    stdout: "pipe",
    stderr: "pipe",
    // Inherit the login environment so the CLI finds its stored token/config.
    env: process.env,
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  // Try to parse the JSON envelope from stdout.
  const trimmed = stdout.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object" && "ok" in parsed) {
        return {
          ok: Boolean((parsed as any).ok),
          data: (parsed as any).data,
          summary: (parsed as any).summary,
          error: (parsed as any).error,
          code: (parsed as any).code,
          exitCode,
          raw: stdout,
        };
      }
      // Valid JSON but not the envelope shape — hand it back as data.
      return { ok: exitCode === 0, data: parsed, exitCode, raw: stdout };
    } catch {
      // fall through to non-JSON handling
    }
  }

  // Non-JSON output (or empty). Treat exit code as source of truth.
  return {
    ok: exitCode === 0,
    data: trimmed || undefined,
    error: exitCode === 0 ? undefined : stderr.trim() || trimmed || "command failed",
    exitCode,
    raw: stdout || stderr,
  };
}
