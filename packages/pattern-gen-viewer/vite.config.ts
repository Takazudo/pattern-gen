import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  base: "/pj/pattern-gen/",
  server: {
    host: "patterngen.localhost",
    port: 1983,
  },
  preview: {
    host: "patterngen.localhost",
    port: 1983,
  },
  resolve: {
    alias: {
      "pattern-gen": path.resolve(__dirname, "../../src"),
    },
  },
});
