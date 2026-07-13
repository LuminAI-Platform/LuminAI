import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    // Proxy Keycloak OIDC endpoints through Vite dev server to avoid
    // cross-origin CORS failures during local development.
    // The SPA runs on :3000, Keycloak on :8180 — without this proxy,
    // the browser may block the discovery/token requests.
    proxy: {
      "/realms": {
        target: "http://localhost:8180",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
