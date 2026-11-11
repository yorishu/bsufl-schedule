import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Относительный base: приложение работает по любому пути (GitHub Pages /имя-репозитория/ и т.д.).
// publicDir указывает на /public в корне репозитория: там лежат schedule.json, манифест и иконки.
export default defineConfig({
  base: "./",
  publicDir: "../public",
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
});
