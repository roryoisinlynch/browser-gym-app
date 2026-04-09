import "./services/pwaInstall"; // must be first — captures beforeinstallprompt before any async work
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "./styles/tokens.css";
import { seedDatabaseIfNeeded } from "./db/seed";

const params = new URLSearchParams(window.location.search);
const redirect = params.get("redirect");

if (redirect) {
  window.history.replaceState({}, "", `${import.meta.env.BASE_URL}${redirect.replace(/^\//, "")}`);
}

async function bootstrap() {
  await seedDatabaseIfNeeded();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}