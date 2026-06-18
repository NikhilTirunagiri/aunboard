import type { Session } from "./session.js";
import { locatorDurability } from "./durability.js";

export interface StepListProps {
  session: Session;
  armed: boolean;
  onToggleArm: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  onExport: () => void;
}

export function StepList({ session, armed, onToggleArm, onRemove, onMove, onExport }: StepListProps) {
  const steps = session.steps;

  return (
    <div
      data-lm-ui
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 280,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,.22)",
        padding: "12px 14px",
        zIndex: 2147483646,
        fontSize: 13,
        color: "#1f2430",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>
          Steps: {steps.length}
        </span>
        <button
          onClick={onToggleArm}
          title={armed ? "Press Esc to cancel, or click an element" : "Click to arm the element picker (or Alt+click any element)"}
          style={{
            border: `1px solid ${armed ? "#2bb673" : "#ddd"}`,
            background: armed ? "#eafaf3" : "#fff",
            color: armed ? "#2bb673" : "#555",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {armed ? "◉ Picking… (Esc)" : "◎ Pick element"}
        </button>
      </div>

      {/* Step rows */}
      {steps.length > 0 && (
        <ol style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((step, i) => {
            const durability = locatorDurability(step.locator);
            return (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {durability.tier !== "stable" && (
                <span
                  title={durability.reason}
                  style={{ color: durability.tier === "fragile" ? "#e05252" : "#d98b00", fontSize: 11, cursor: "help" }}
                >
                  ⚠
                </span>
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step.label}
              </span>
              <button
                aria-label={`Move step ${i + 1} up`}
                onClick={() => i > 0 && onMove(i, i - 1)}
                disabled={i === 0}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: i === 0 ? "not-allowed" : "pointer",
                  opacity: i === 0 ? 0.3 : 1,
                  fontSize: 12,
                  padding: "1px 3px",
                }}
              >
                ↑
              </button>
              <button
                aria-label={`Move step ${i + 1} down`}
                onClick={() => i < steps.length - 1 && onMove(i, i + 1)}
                disabled={i === steps.length - 1}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: i === steps.length - 1 ? "not-allowed" : "pointer",
                  opacity: i === steps.length - 1 ? 0.3 : 1,
                  fontSize: 12,
                  padding: "1px 3px",
                }}
              >
                ↓
              </button>
              <button
                aria-label={`Remove step ${i + 1}`}
                onClick={() => onRemove(i)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "1px 3px",
                  color: "#e05252",
                }}
              >
                ✕
              </button>
            </li>
            );
          })}
        </ol>
      )}

      {/* Export */}
      <button
        onClick={onExport}
        style={{
          border: "1px solid #ddd",
          background: "#f8f8f8",
          borderRadius: 6,
          padding: "5px 10px",
          cursor: "pointer",
          fontSize: 12,
          marginTop: 2,
        }}
      >
        Download JSON
      </button>
    </div>
  );
}
