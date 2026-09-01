import { loadInjectScript } from "./inject-bundle";
import { applyRouteVars } from "./args";
import type { StepProbe, TourStep, VerifyDriver } from "./types";

export const MISSING_PLAYWRIGHT_MESSAGE = [
  "aunboard: Playwright is required to verify tours but was not found.",
  "",
  "  npm i -D playwright   (or: pnpm add -D playwright)",
  "  npx playwright install chromium",
  "",
  "It is an optional peer dependency so installing @aunboard/cli stays light.",
].join("\n");

/** Injectable so tests can simulate Playwright being absent without uninstalling it. */
export type ModuleLoader = (specifier: string) => Promise<unknown>;

/**
 * The specifier is held in a variable on purpose: it keeps the import out of the bundle and
 * out of the type graph, so the CLI installs and type-checks without Playwright present.
 */
const dynamicImport: ModuleLoader = (specifier) => import(specifier);

/**
 * Import Playwright lazily, failing loudly with install instructions when it is missing —
 * it is an optional peer dependency, so the user installs it themselves.
 */
export async function loadPlaywright(load: ModuleLoader = dynamicImport): Promise<{ chromium: any }> {
  try {
    return (await load("playwright")) as { chromium: any };
  } catch {
    throw new Error(MISSING_PLAYWRIGHT_MESSAGE);
  }
}

/** `url + route`, keeping any path prefix on the base URL for relative routes. */
export function resolveStepUrl(baseUrl: string, route: string | undefined): string {
  if (!route) return baseUrl;
  if (route.startsWith("/")) return baseUrl.replace(/\/+$/, "") + route;
  return new URL(route, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Runs inside the page. Mirrors the runtime tour controller exactly: skip the reveal pass
 * when the target is already visible, otherwise resolve-and-activate each reveal in order,
 * then wait for the target. Everything it calls comes from the injected runtime bundle.
 */
/* c8 ignore start -- executed in the browser, not in Node */
const PAGE_CHECK = async (input: { locator: unknown; reveal: unknown[]; timeout: number }): Promise<StepProbe> => {
  const api = (globalThis as any).__aunboard;
  if (!api) {
    return {
      found: false,
      matchedBy: null,
      candidateCount: 0,
      revealMissing: -1,
      error: "aunboard locator bundle was not injected into the page",
    };
  }
  const locator = input.locator as any;
  const present = api.resolveLocator(locator, document.body).element as HTMLElement | null;
  const alreadyVisible =
    !!present && (typeof present.checkVisibility === "function" ? present.checkVisibility() : true);

  let revealMissing = -1;
  if (input.reveal.length > 0 && !alreadyVisible) {
    for (let i = 0; i < input.reveal.length; i++) {
      const opener = await api.resolveLocatorWhenReady(input.reveal[i], { timeout: input.timeout });
      if (!opener) {
        revealMissing = i;
        break;
      }
      api.activateElement(opener);
    }
  }

  const element = revealMissing >= 0 ? null : await api.resolveLocatorWhenReady(locator, { timeout: input.timeout });
  const final = api.resolveLocator(locator, document.body);
  return {
    found: !!element,
    matchedBy: final.matchedBy,
    candidateCount: final.candidateCount,
    revealMissing,
  };
};
/* c8 ignore stop */

export interface DriverOptions {
  url: string;
  timeout: number;
  /** Path to a Playwright storageState JSON — cookies + localStorage for a logged-in session. */
  storageState?: string;
  /** Extra HTTP headers on every request (bearer tokens, basic auth, feature flags). */
  headers?: Record<string, string>;
  /** Substituted into step routes before navigating. */
  vars?: Record<string, string>;
}

/** Launch headless Chromium with the locator engine injected into every document. */
export async function createPlaywrightDriver({
  url,
  timeout,
  storageState,
  headers,
  vars,
}: DriverOptions): Promise<VerifyDriver> {
  const { chromium } = await loadPlaywright();
  const script = loadInjectScript();
  const navigationTimeout = Math.max(timeout, 30_000);

  const browser = await chromium.launch({ headless: true });
  // storageState carries the cookies and localStorage of a logged-in session, so a tour
  // through an authenticated app is verifiable without the CLI knowing how to log in.
  // extraHTTPHeaders covers token-based auth.
  const context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    ...(headers && Object.keys(headers).length ? { extraHTTPHeaders: headers } : {}),
  });
  // addInitScript re-injects on every document, so full-page navigations keep the engine.
  await context.addInitScript({ content: script });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load", timeout: navigationTimeout });

  return {
    async checkStep(step: TourStep): Promise<StepProbe> {
      const route = applyRouteVars(step.route, vars ?? {});
      const target = resolveStepUrl(url, route);
      if (route && pathnameOf(page.url()) !== pathnameOf(target)) {
        try {
          await page.goto(target, { waitUntil: "load", timeout: navigationTimeout });
        } catch (err) {
          return {
            found: false,
            matchedBy: null,
            candidateCount: 0,
            revealMissing: -1,
            error: `could not navigate to ${target}: ${(err as Error).message}`,
          };
        }
      }
      return (await page.evaluate(PAGE_CHECK, {
        locator: step.locator,
        reveal: step.reveal ?? [],
        timeout,
      })) as StepProbe;
    },
    async close() {
      await browser.close();
    },
  };
}
