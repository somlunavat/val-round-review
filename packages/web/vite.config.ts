import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The browser only ever talks to our own server; Riot calls happen there.
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
