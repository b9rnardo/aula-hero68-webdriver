import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useDriver } from "./store/driver";
import { useUi } from "./store/ui";

// Dev-only handle for inspecting state from the console.
if (import.meta.env.DEV) Object.assign(window, { __driver: useDriver, __ui: useUi });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
