import { useLabelMode, type LabelMode } from "./context";

const TOP_Z = 2147483647;
const MODES: { value: LabelMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "explore", label: "Explore" },
  { value: "walkthrough", label: "Walkthrough" },
];

export function ModeSwitch() {
  const { mode, setMode, tours, activeTourId, setActiveTourId } = useLabelMode();
  const tourIds = Object.keys(tours);
  const hasTours = tourIds.length > 0;

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: TOP_Z,
        display: "flex",
        gap: 6,
        alignItems: "center",
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 999,
        padding: 4,
        fontSize: 12,
        boxShadow: "0 4px 14px rgba(0,0,0,.15)",
      }}
    >
      {MODES.map((m) => {
        if (m.value === "walkthrough" && !hasTours) return null;
        const selected = mode === m.value;
        return (
          <button
            key={m.value}
            aria-pressed={selected}
            onClick={() => setMode(m.value)}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "4px 10px",
              cursor: "pointer",
              background: selected ? "#1f2430" : "transparent",
              color: selected ? "#fff" : "#1f2430",
            }}
          >
            {m.label}
          </button>
        );
      })}
      {mode === "walkthrough" && tourIds.length > 1 && (
        <select
          aria-label="Choose tour"
          value={activeTourId ?? ""}
          onChange={(e) => setActiveTourId(e.target.value)}
          style={{ border: "1px solid #ddd", borderRadius: 999, padding: "2px 6px" }}
        >
          {tourIds.map((id) => (
            <option key={id} value={id}>
              {tours[id].name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
