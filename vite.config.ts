import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Build as a single self-contained HTML so it works via file:// without CORS issues.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
