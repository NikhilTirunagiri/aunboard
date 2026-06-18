/**
 * Decide whether Label Mode may mount. Default: on outside production, off in production.
 * `override` lets staging builds (NODE_ENV=production but not the real prod site) opt in,
 * or any build opt out. Pass override from an env var like NEXT_PUBLIC_LABEL_MODE.
 */
export function isLabelModeEnabled(nodeEnv: string | undefined, override: boolean | undefined): boolean {
  if (typeof override === "boolean") return override;
  return nodeEnv !== "production";
}
