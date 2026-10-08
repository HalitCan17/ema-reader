import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      // Offscreen sayfası manifest'te geçmediği için ayrıca derlenmeli.
      input: { offscreen: "src/offscreen/offscreen.html" },
    },
  },
});
