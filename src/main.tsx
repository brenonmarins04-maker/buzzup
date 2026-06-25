import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<p style={{ padding: 32 }}>Ocorreu um erro inesperado. Recarregue a página.</p>}>
    <App />
  </Sentry.ErrorBoundary>
);
