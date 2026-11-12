import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./components/icon-magnify.css";
import "./components/prose-issues.css";
import "./settings/appearance-settings.css";
import "./settings/settings-nav.css";
import "./editor/side-ruler.css";
import { applyAppearance, readAppearance } from "./appearance";
import { initFonts } from "./fonts/registry";
applyAppearance(document.documentElement, readAppearance(localStorage));
void initFonts();
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
