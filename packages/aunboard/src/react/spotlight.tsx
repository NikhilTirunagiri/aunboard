const TOP_Z = 2147483647;
const POPOVER_W = 300;

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface SpotlightProps {
  rect: SpotlightRect;
  title: string;
  narration: string;
  index: number; // 0-based
  total: number;
  isLast: boolean;
  canPrev: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function Spotlight(props: SpotlightProps) {
  const { rect, title, narration, index, total, isLast, canPrev, onPrev, onNext, onClose } = props;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;

  const placeAbove = rect.top > vh / 2;
  const left = Math.max(8, Math.min(rect.left, vw - POPOVER_W - 8));
  const popoverStyle: React.CSSProperties = placeAbove
    ? { position: "fixed", left, bottom: Math.max(8, vh - rect.top + 8), width: POPOVER_W }
    : { position: "fixed", left, top: rect.top + rect.height + 8, width: POPOVER_W };

  return (
    <div data-label-mode-walkthrough style={{ position: "fixed", inset: 0, zIndex: TOP_Z, pointerEvents: "none" }}>
      {/* Dim everything but the target: a transparent box with a huge surrounding shadow. */}
      <div
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,.55)",
          borderRadius: 6,
          outline: "2px solid #2bb673",
          pointerEvents: "none",
        }}
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          ...popoverStyle,
          background: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,.35)",
          fontSize: 14,
          color: "#1f2430",
          pointerEvents: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", opacity: 0.6 }}>
            Step {index + 1} of {total}
          </span>
          <button
            aria-label="Close walkthrough"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16 }}
          >
            ✕
          </button>
        </div>
        <strong style={{ display: "block", marginTop: 6, fontSize: 16 }}>
          {title}
        </strong>
        <p style={{ margin: "8px 0 14px" }}>{narration}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onPrev}
            disabled={!canPrev}
            style={{
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#fff",
              padding: "6px 12px",
              cursor: canPrev ? "pointer" : "not-allowed",
              opacity: canPrev ? 1 : 0.5,
            }}
          >
            Back
          </button>
          <button
            onClick={onNext}
            style={{
              borderRadius: 8,
              border: "none",
              background: "#1f2430",
              color: "#fff",
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            {isLast ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
