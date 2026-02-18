import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000, // Höj gränsen till 1000kB (1MB) för att slippa onödiga varningar
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          xyflow: ["@xyflow/react"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
