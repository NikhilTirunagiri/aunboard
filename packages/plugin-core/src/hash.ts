import { createHash } from "node:crypto";

/** Short, stable, content-addressed hash. Not a security primitive. */
export function shortHash(input: string, length = 6): string {
  return createHash("sha256").update(input, "utf8").digest("hex").slice(0, length);
}
