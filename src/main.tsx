import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={({ error }: { error: unknown }) => (
    <div style={{ padding: 32, fontFamily: "monospace" }}>
      <p style={{ fontWeight: "bold", marginBottom: 8 }}>Ocorreu um erro inesperado. Recarregue a página.</p>
      <pre style={{ fontSize: 12, color: "#dc2626", background: "#fef2f2", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {error instanceof Error ? `${error.name}: ${error.message}\n\n${error.stack}` : String(error)}
      </pre>
    </div>
  )}>
    <App />
  </Sentry.ErrorBoundary>
);
