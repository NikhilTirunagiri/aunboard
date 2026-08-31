import { RouterProvider } from "./router";
import { Aunboard } from "./Aunboard";
import { App } from "./App";

/**
 * The whole app, mountable in one line. `main.tsx` renders it into the page and the
 * tour test renders it into jsdom — so the tour is verified against the same tree a
 * viewer sees, not a stand-in.
 */
export function Demo() {
  return (
    <RouterProvider>
      <Aunboard>
        <App />
      </Aunboard>
    </RouterProvider>
  );
}
