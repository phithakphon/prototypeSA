import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build must talk to the real API. Refuse to build rather than ship (or silently ignore) mock mode.
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (env.VITE_USE_MOCK === 'true') {
      throw new Error('VITE_USE_MOCK=true ไม่อนุญาตใน production build (โหมดข้อมูลจำลองใช้ได้เฉพาะตอนพัฒนาและทดสอบ)')
    }
  }
  return {
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
  }
})
