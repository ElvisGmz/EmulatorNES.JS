import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "games/**/*.test.mjs"],
  },
});
