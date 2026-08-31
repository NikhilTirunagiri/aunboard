import { parseArgs } from "node:util";

export type Reporter = "pretty" | "json" | "github";

export const REPORTERS: Reporter[] = ["pretty", "json", "github"];
/** Where tours land by default when the recorder saves them into the host repo. */
export const DEFAULT_TOURS_GLOB = "./tours/*.tour.json";
/** Matches the runtime's own `resolveLocatorWhenReady` default, so CI waits exactly as long. */
export const DEFAULT_TIMEOUT_MS = 8000;

export interface VerifyOptions {
  url: string;
  tours: string[];
  timeout: number;
  reporter: Reporter;
}

export type ParsedArgs =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "verify"; options: VerifyOptions }
  | { kind: "error"; message: string };

export const HELP_TEXT = `aunboard — verify recorded tours still resolve against a running app

Usage
  aunboard verify --url <url> [options]

Options
  --url <url>          Base URL of the running app (required), e.g. http://localhost:3000
  --tours <glob>       Tour files to verify. Repeatable.
                       Default: ${DEFAULT_TOURS_GLOB}
  --timeout <ms>       How long to wait for each element to appear. Default: ${DEFAULT_TIMEOUT_MS}
  --reporter <name>    pretty | json | github. Default: pretty
  --json               Shorthand for --reporter json
  -h, --help           Show this help
  -v, --version        Show the version

Exit codes
  0  every step in every tour resolved
  1  at least one step failed to resolve (or a tour file was unreadable)

Requires Playwright (peer dependency):
  npm i -D playwright && npx playwright install chromium

Examples
  aunboard verify --url http://localhost:3000
  aunboard verify --url http://localhost:3000 --tours "src/**/*.tour.json"
  aunboard verify --url http://localhost:3000 --reporter github
`;

/** Parse `process.argv.slice(2)`. Never throws — bad input comes back as `{ kind: "error" }`. */
export function parseCliArgs(argv: string[]): ParsedArgs {
  let values: Record<string, unknown>;
  let positionals: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        url: { type: "string" },
        tours: { type: "string", multiple: true },
        timeout: { type: "string" },
        reporter: { type: "string" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
    values = parsed.values as Record<string, unknown>;
    positionals = parsed.positionals;
  } catch (err) {
    return { kind: "error", message: `aunboard: ${(err as Error).message}` };
  }

  if (values.help) return { kind: "help" };
  if (values.version) return { kind: "version" };

  const command = positionals[0];
  if (!command) {
    return { kind: "error", message: 'aunboard: missing command. Try "aunboard verify --url <url>" or "aunboard --help".' };
  }
  if (command !== "verify") {
    return { kind: "error", message: `aunboard: unknown command "${command}". The only command is "verify".` };
  }
  if (positionals.length > 1) {
    return { kind: "error", message: `aunboard: unexpected argument "${positionals[1]}".` };
  }

  const url = values.url;
  if (typeof url !== "string" || url.length === 0) {
    return { kind: "error", message: "aunboard: --url is required, e.g. --url http://localhost:3000" };
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { kind: "error", message: `aunboard: --url "${url}" is not a valid absolute URL (e.g. http://localhost:3000).` };
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { kind: "error", message: `aunboard: --url "${url}" must be an http(s) URL (e.g. http://localhost:3000).` };
  }

  let timeout = DEFAULT_TIMEOUT_MS;
  if (values.timeout !== undefined) {
    const n = Number(values.timeout);
    if (!Number.isFinite(n) || n <= 0) {
      return { kind: "error", message: `aunboard: --timeout must be a positive number of milliseconds (got "${String(values.timeout)}").` };
    }
    timeout = n;
  }

  let reporter: Reporter = "pretty";
  if (values.reporter !== undefined) {
    if (!REPORTERS.includes(values.reporter as Reporter)) {
      return { kind: "error", message: `aunboard: unknown --reporter "${String(values.reporter)}". Expected one of: ${REPORTERS.join(", ")}.` };
    }
    reporter = values.reporter as Reporter;
  }
  // --json is sugar for --reporter json and wins if both are given.
  if (values.json) reporter = "json";

  const tours = Array.isArray(values.tours) && values.tours.length > 0 ? (values.tours as string[]) : [DEFAULT_TOURS_GLOB];

  return { kind: "verify", options: { url, tours, timeout, reporter } };
}
