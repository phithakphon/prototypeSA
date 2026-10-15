import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { apiUrlProblem } from './src/apiUrl.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build must talk to the real API. Refuse to build rather than ship (or silently ignore) mock mode,
  // and refuse an API URL that would break in the browser (path, plain http, credentials).
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    if (env.VITE_USE_MOCK === 'true') {
      throw new Error('VITE_USE_MOCK=true ไม่อนุญาตใน production build (โหมดข้อมูลจำลองใช้ได้เฉพาะตอนพัฒนาและทดสอบ)')
    }
    const problem = apiUrlProblem(env.VITE_API_URL, { production: true })
    if (problem) throw new Error(problem)
  }
  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      globals: true,
      // integration/ runs against a real backend: use `npm run test:integration`
      include: ['src/**/*.test.{js,jsx}'],
      // Unit tests always use the mock API, whatever a developer put in .env.local (e.g. VITE_USE_MOCK=false for real-backend dev)
      env: { VITE_USE_MOCK: 'true', VITE_API_URL: '' },
      // UI tests type and wait for focus/animation timers; give them headroom on a busy machine (observed flaky at the 5 s default)
      testTimeout: 15000,
    },
    server: {
      // Development only: forward /api to the local Express backend (see ../backend). Not used by production builds.
      proxy: {
        '/api': 'http://localhost:3001',
      },
    },
  }
})
