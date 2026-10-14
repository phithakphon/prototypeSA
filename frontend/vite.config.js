import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
  server: {
    // Forward API calls to the Express backend (see ../backend)
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
