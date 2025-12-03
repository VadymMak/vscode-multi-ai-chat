import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Vite configuration for the webview UI
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash].[ext]",
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    strictPort: true,
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
