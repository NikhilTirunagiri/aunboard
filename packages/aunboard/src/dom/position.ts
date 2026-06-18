export interface BadgeRect {
  top: number;
  left: number;
  size: number;
}

/** Position a numbered badge at the target's top-left corner, half-overlapping outward, clamped to >= 0. */
export function computeBadgeRect(target: DOMRect, size: number): BadgeRect {
  const half = size / 2;
  return {
    top: Math.max(0, target.top - half),
    left: Math.max(0, target.left - half),
    size,
  };
}
