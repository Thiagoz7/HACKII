import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ThemeProvider } from "./components/ThemeToggle";
import { I18nProvider } from "./components/I18nProvider";
import { setFavicon, getStoredFavicon } from "./lib/favicon";

// Apply stored favicon preference
setFavicon(getStoredFavicon());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>
);
