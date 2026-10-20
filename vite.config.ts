import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  // Relative assets work at both localhost and GitHub Pages project URLs.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "zustand"],
          validation: ["zod"],
        },
      },
    },
  },
  test: { environment: "node", include: ["src/**/*.test.ts"], maxWorkers: 2 },
});
