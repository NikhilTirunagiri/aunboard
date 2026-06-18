import type { TourStep } from "../tour/types";

export function LegendPanel({ steps = [] }: { steps?: TourStep[] }) {
  const items = steps;
  if (items.length === 0) return null;
  return (
    <aside
      style={{
        position: "fixed",
        right: 12,
        top: 12,
        width: 260,
        maxHeight: "80vh",
        overflow: "auto",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 12,
        fontSize: 13,
        zIndex: 2147483647,
      }}
    >
      <strong>Labels</strong>
      <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
        {items.map((step, i) => (
          <li key={i} style={{ padding: "3px 0" }}>
            {step.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
