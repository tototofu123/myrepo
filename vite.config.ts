import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Ensure SPA routing works for /repo and /blog
      output: {
        manualChunks: undefined,
      },
    },
  },
})
