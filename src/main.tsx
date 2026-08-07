import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./components/ThemeToggle";
import { I18nProvider } from "./components/I18nProvider";
import { setFavicon, getStoredFavicon } from "./lib/favicon";

// Apply stored favicon preference
setFavicon(getStoredFavicon());

// Dismiss loading screen after React renders
function dismissLoadingScreen() {
  const el = document.getElementById('loading-screen');
  if (el) {
    el.classList.add('hidden');
    // Remove from DOM after transition
    setTimeout(() => el.remove(), 700);
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);

// Dismiss after a minimum display time (ensures branding is visible)
setTimeout(dismissLoadingScreen, 800);
