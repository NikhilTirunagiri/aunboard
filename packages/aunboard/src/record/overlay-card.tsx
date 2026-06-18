import { useState } from "react";
import type { Durability } from "./durability.js";
import type { ElementLocator } from "../locator";

const CARD_W = 280;
const CARD_H = 160; // approximate

export interface OverlayCardProps {
  anchor: Element;
  onSave: (label: string, description: string) => void;
  onCancel: () => void;
  /** Optional durability classification of the captured locator; shown as a warning when not stable. */
  durability?: Durability;
  /** Captured "open first" reveals (e.g. a tab clicked en route); shown as removable chips. */
  reveal?: ElementLocator[];
  onRemoveReveal?: (index: number) => void;
}

/** Short human label for a reveal locator chip. */
function revealLabel(loc: ElementLocator): string {
  return loc.role?.name || loc.text || loc.hook?.value || loc.tag;
}

export function OverlayCard({ anchor, onSave, onCancel, durability, reveal, onRemoveReveal }: OverlayCardProps) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  // Position the card near the anchor, clamped to the viewport.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const rect = anchor.getBoundingClientRect();

  // Prefer below; flip above if insufficient space.
  const placeAbove = rect.bottom + CARD_H + 12 > vh && rect.top > CARD_H + 12;
  const top = placeAbove
    ? Math.max(8, rect.top - CARD_H - 12)
    : Math.min(rect.bottom + 8, vh - CARD_H - 8);
  const left = Math.max(8, Math.min(rect.left, vw - CARD_W - 8));

  const handleSave = () => {
    if (!label.trim()) return;
    onSave(label.trim(), description.trim());
  };

  return (
    <div
      data-lm-ui
      role="dialog"
      aria-label="Label this element"
      style={{
        position: "fixed",
        top,
        left,
        width: CARD_W,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,.28)",
        padding: "12px 14px 14px",
        zIndex: 2147483647,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 13,
        color: "#1f2430",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", opacity: 0.55, letterSpacing: "0.04em" }}>
        Label this element
      </div>
      {durability && durability.tier !== "stable" && (
        <div
          role="note"
          style={{
            fontSize: 11,
            lineHeight: 1.35,
            padding: "6px 8px",
            borderRadius: 6,
            background: durability.tier === "fragile" ? "#fdecec" : "#fff7e6",
            color: durability.tier === "fragile" ? "#9c2b2b" : "#8a5a00",
            border: `1px solid ${durability.tier === "fragile" ? "#f3c2c2" : "#f0dca6"}`,
          }}
        >
          ⚠ {durability.reason}
        </div>
      )}
      {reveal && reveal.length > 0 && (
        <div style={{ fontSize: 11, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", color: "#444" }}>
          <span style={{ opacity: 0.7 }}>Opens first:</span>
          {reveal.map((r, i) => (
            <span
              key={i}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#eef2f7", borderRadius: 999, padding: "2px 4px 2px 8px" }}
            >
              {revealLabel(r)}
              <button
                aria-label={`Remove reveal ${i + 1}`}
                onClick={() => onRemoveReveal?.(i)}
                style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: "#888", padding: 0, lineHeight: 1 }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
        style={{
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 13,
          outline: "none",
        }}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        style={{
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 13,
          resize: "none",
          outline: "none",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            border: "1px solid #ddd",
            background: "#fff",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!label.trim()}
          style={{
            border: "none",
            background: label.trim() ? "#1f2430" : "#bbb",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 12px",
            cursor: label.trim() ? "pointer" : "not-allowed",
            fontSize: 12,
          }}
        >
          Save step
        </button>
      </div>
    </div>
  );
}
