import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/node_modules/@tiptap/") ||
            id.includes("/node_modules/prosemirror-")
          )
            return "editor";
        },
      },
    },
  },
});
