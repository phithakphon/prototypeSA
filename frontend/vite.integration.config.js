import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['integration/*.test.jsx'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    env: { VITE_USE_MOCK: 'false', VITE_API_URL: process.env.VITE_API_URL },
    testTimeout: 20000,
  },
})
