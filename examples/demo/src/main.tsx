import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Demo } from "./Demo";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
