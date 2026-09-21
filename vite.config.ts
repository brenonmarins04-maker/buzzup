import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/sb-proxy": {
        target: "https://104.18.38.10",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/sb-proxy/, ""),
        headers: { host: "twwcnudhfvzbkdrtfmtu.supabase.co" },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em pedaços próprios: elas quase nunca mudam, então o
        // navegador reaproveita entre versões em vez de baixar tudo de novo
        // a cada deploy.
        // recharts fica de fora de propósito: nomeado aqui, ele era puxado
        // para o carregamento inicial mesmo só sendo usado nos relatórios
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          datas: ["date-fns"],
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
