import { useState } from "react";
import type { BadgeRect } from "../dom/position";

export interface BadgeProps {
  index: number;
  element: Element;
  label: string;
  description: string;
  rect: BadgeRect;
}

export function Badge({ index, label, description, rect }: BadgeProps) {
  const [hover, setHover] = useState(false);

  return (
    <div style={{ position: "fixed", top: rect.top, left: rect.left, zIndex: 2147483647 }}>
      <button
        aria-label={label}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: rect.size,
          height: rect.size,
          borderRadius: "50%",
          border: "none",
          background: "#2bb673",
          color: "#fff",
          fontSize: 11,
          lineHeight: `${rect.size}px`,
          cursor: "help",
          padding: 0,
        }}
      >
        {index}
      </button>
      {hover && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: rect.size + 4,
            left: 0,
            minWidth: 160,
            maxWidth: 260,
            background: "#1f2430",
            color: "#fff",
            padding: "8px 10px",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 6px 20px rgba(0,0,0,.3)",
          }}
        >
          <strong>{label}</strong>
          {description && <div style={{ marginTop: 4 }}>{description}</div>}
        </div>
      )}
    </div>
  );
}
