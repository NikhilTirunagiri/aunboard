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
  /** Playwright storageState JSON (cookies + localStorage) — for an app behind a login. */
  storageState?: string;
  /** Extra HTTP headers sent with every request, e.g. an Authorization bearer token. */
  headers: Record<string, string>;
  /** Substituted into step routes: `:name` and `{name}` both become the value. */
  vars: Record<string, string>;
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

Authenticated apps
  --storage-state <p>  Playwright storageState JSON (cookies + localStorage). Produce one
                       with a Playwright script that logs in, then storageState({path}).
  --header "K: V"      Extra header on every request. Repeatable.

Routes with runtime ids
  --var name=value     Substitutes :name and {name} in step routes. Repeatable.
                       e.g. route "/workspace/:ws/project/:proj" with
                            --var ws=abc --var proj=xyz
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
  aunboard verify --url http://localhost:3000 --storage-state .auth/state.json
  aunboard verify --url http://localhost:3000 --var ws=demo-ws --var proj=demo-proj
`;

/** `--header "Name: Value"` (or "Name=Value") into a header map. */
export function parseHeaders(raw: string[]): { headers: Record<string, string>; error?: string } {
  const headers: Record<string, string> = {};
  for (const item of raw) {
    const at = item.search(/[:=]/);
    if (at <= 0) {
      return { headers, error: `--header must look like "Name: Value" (got ${JSON.stringify(item)})` };
    }
    headers[item.slice(0, at).trim()] = item.slice(at + 1).trim();
  }
  return { headers };
}

/** `--var name=value` into a substitution map. */
export function parseVars(raw: string[]): { vars: Record<string, string>; error?: string } {
  const vars: Record<string, string> = {};
  for (const item of raw) {
    const at = item.indexOf("=");
    if (at <= 0) {
      return { vars, error: `--var must look like name=value (got ${JSON.stringify(item)})` };
    }
    vars[item.slice(0, at).trim()] = item.slice(at + 1);
  }
  return { vars };
}

/**
 * Substitute `:name` / `{name}` tokens in a route.
 *
 * Routes in a committed tour can carry runtime ids — `/workspace/:ws/project/:proj` — because
 * the instance a tour was authored against is not the instance CI verifies. An unsubstituted
 * token is left alone rather than silently blanked, so the resulting 404 names the problem.
 */
export function applyRouteVars(route: string | undefined, vars: Record<string, string>): string | undefined {
  if (!route) return route;
  // ONE pass. Replacing var-by-var would rescan text that was just substituted, so a value
  // containing ":other" would be replaced again by a later variable — a quietly wrong URL.
  // A single regex pass never looks at its own output.
  return route.replace(/:([A-Za-z_][\w-]*)|\{([A-Za-z_][\w-]*)\}/g, (match, colonName, braceName) => {
    const name = colonName ?? braceName;
    // An unknown token is left verbatim rather than blanked: a blanked segment yields a
    // plausible-looking wrong URL, while the token makes the resulting 404 self-explanatory.
    return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name]! : match;
  });
}

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
        "storage-state": { type: "string" },
        header: { type: "string", multiple: true },
        var: { type: "string", multiple: true },
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

  const { headers, error: headerError } = parseHeaders((values.header as string[] | undefined) ?? []);
  if (headerError) return { kind: "error", message: `aunboard: ${headerError}` };

  const { vars, error: varError } = parseVars((values.var as string[] | undefined) ?? []);
  if (varError) return { kind: "error", message: `aunboard: ${varError}` };

  const storageState = typeof values["storage-state"] === "string" ? (values["storage-state"] as string) : undefined;

  return { kind: "verify", options: { url, tours, timeout, reporter, storageState, headers, vars } };
}
