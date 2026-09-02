import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Os testes de tela da agenda montam grades com centenas de elementos.
    // Com o padrão de 5s eles falhavam por tempo sob carga, sem nada de
    // errado no código.
    testTimeout: 15000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
