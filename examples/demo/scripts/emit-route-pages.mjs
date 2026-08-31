// Static-host fallback for a History-API router.
//
// The demo uses real pathnames (/projects, /settings), so a plain static server would 404
// on a direct hit — including the CI tour replay, which navigates straight to each step's
// route. Copying index.html to <route>/index.html makes every route directly addressable
// with no server config.

import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "..", "dist");
const index = join(dist, "index.html");

if (!existsSync(index)) {
  console.error(`emit-route-pages: ${index} is missing — run \`vite build\` first.`);
  process.exit(1);
}

// Keep in sync with the routes in src/App.tsx.
const ROUTES = ["/projects", "/settings"];

for (const route of ROUTES) {
  const target = join(dist, route.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(index, target);
  console.log(`emit-route-pages: ${route} -> ${target.slice(dist.length + 1)}`);
}
