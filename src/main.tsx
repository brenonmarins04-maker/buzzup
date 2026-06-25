import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={({ error }) => (
    <div style={{ padding: 32, fontFamily: "monospace" }}>
      <p style={{ fontWeight: "bold", color: "red" }}>Erro: {String((error as any)?.message ?? error)}</p>
      <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 8 }}>{(error as any)?.stack}</pre>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 16px" }}>Recarregar</button>
    </div>
  )}>
    <App />
  </Sentry.ErrorBoundary>
);
