import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { aunboard } from "@aunboard/vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    // Stamps `data-aun` onto the elements the committed tours reference. In dev it stamps
    // everything (so you can record against any element); in a production build it stamps
    // only what the tours actually use.
    aunboard(),
    react()],
  resolve: {
    // REQUIRED. aunboard declares react/react-dom as peers; in a workspace checkout it is
    // easy to end up with two copies of React, which surfaces as "Invalid hook call".
    dedupe: ["react", "react-dom"],
  },
  // aunboard reads process.env.NODE_ENV to gate record mode. Vite normally injects this,
  // but declaring it keeps the linked workspace build honest in every mode.
  define: { "process.env.NODE_ENV": JSON.stringify(mode) },
  server: { port: 5173 },
  build: { outDir: "dist", sourcemap: true },
}));
