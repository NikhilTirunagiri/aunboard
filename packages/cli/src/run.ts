import { HELP_TEXT, parseCliArgs, type VerifyOptions } from "./args";
import { createPlaywrightDriver } from "./driver";
import { expandGlobs } from "./glob";
import { render } from "./report";
import { loadTourFiles } from "./tours";
import type { VerifyDriver } from "./types";
import { exitCodeFor, verifyTours } from "./verify";
import { readVersion } from "./version";

export interface RunDeps {
  cwd: string;
  /** Injected so unit tests can substitute a fake page driver for Playwright. */
  createDriver: (options: VerifyOptions) => Promise<VerifyDriver>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export const defaultDeps: RunDeps = {
  cwd: process.cwd(),
  createDriver: (options) =>
    createPlaywrightDriver({
      url: options.url,
      timeout: options.timeout,
      storageState: options.storageState,
      headers: options.headers,
      vars: options.vars,
    }),
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

/** Run the CLI end to end and return the process exit code. Never throws. */
export async function runCli(argv: string[], deps: RunDeps = defaultDeps): Promise<number> {
  const parsed = parseCliArgs(argv);

  if (parsed.kind === "help") {
    deps.stdout(HELP_TEXT);
    return 0;
  }
  if (parsed.kind === "version") {
    deps.stdout(readVersion());
    return 0;
  }
  if (parsed.kind === "error") {
    deps.stderr(parsed.message);
    deps.stderr("");
    deps.stderr(HELP_TEXT);
    return 1;
  }

  const options = parsed.options;
  const files = expandGlobs(options.tours, deps.cwd);
  if (files.length === 0) {
    deps.stderr(`aunboard: no tour files matched ${options.tours.map((t) => `"${t}"`).join(", ")}.`);
    return 1;
  }

  const { tours, errors } = loadTourFiles(files, deps.cwd);

  let driver: VerifyDriver;
  try {
    driver = await deps.createDriver(options);
  } catch (err) {
    deps.stderr((err as Error).message);
    return 1;
  }

  try {
    const report = await verifyTours(tours, errors, driver);
    deps.stdout(render(options.reporter, report, { url: options.url }));
    return exitCodeFor(report);
  } catch (err) {
    deps.stderr(`aunboard: ${(err as Error).message}`);
    return 1;
  } finally {
    try {
      await driver.close();
    } catch {
      /* the browser is going away with the process anyway */
    }
  }
}
