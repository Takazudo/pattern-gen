import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/pj/pattern-gen/app/",
  server: {
    host: "patterngen.localhost",
    port: 14362,
  },
  preview: {
    host: "patterngen.localhost",
    port: 14362,
  },
  resolve: {
    alias: {
      "pattern-gen": path.resolve(__dirname, "../../src"),
    },
  },
});
