import { AunboardProvider, useAunboard } from "aunboard";
import { useRouter } from "./router";
import { tours } from "./aunboard.tours";

/**
 * The whole integration: wrap the app, hand aunboard the router's navigate, point
 * `record` at the tour you are authoring. Everything else is keyboard-driven.
 */
export function Aunboard({ children }: { children: React.ReactNode }) {
  const { navigate } = useRouter();

  return (
    <AunboardProvider
      tours={tours}
      navigate={(path) => navigate(path)}
      record={{ tour: { id: "demo", name: "Product Demo" } }}
      // Forced on so the overlay also works in `pnpm build && pnpm preview` — this app is a
      // demo and the fixture CI replays tours against. A real product would leave this
      // unset (dev-only) or gate it on a staging env flag.
      enabled
    >
      {children}
      <RecordButton />
    </AunboardProvider>
  );
}

/** A dev-only entry into Record mode — it is intentionally not in the keyboard cycle. */
function RecordButton() {
  const { mode, setMode } = useAunboard();
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button
      className="record-button"
      onClick={() => setMode(mode === "record" ? "off" : "record")}
    >
      {mode === "record" ? "■ Stop" : "● Record"}
    </button>
  );
}
