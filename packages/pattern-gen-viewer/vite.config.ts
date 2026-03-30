import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/pj/pattern-gen/",
  worker: {
    format: "es",
  },
  server: {
    host: "patterngen.localhost",
    port: 14362,
  },
  preview: {
    host: "patterngen.localhost",
    port: 14362,
  },
  resolve: {
    conditions: ["development"],
  },
});
