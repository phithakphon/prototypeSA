// Where the REST API lives. VITE_API_URL is the backend ORIGIN only (no "/api"), e.g. https://ems-api.onrender.com.
// Empty means same origin: "/api" is served by the Vite dev proxy or by a hosting rewrite.
// It is baked into the bundle at build time, so it must never contain a secret (it is a public URL).

export function normalizeApiUrl(value) {
  return String(value ?? '').trim().replace(/\/+$/, '')
}

const isLocalHost = (h) => ['localhost', '127.0.0.1', '[::1]'].includes(h)

// Returns a human-readable problem, or '' when the value is acceptable.
export function apiUrlProblem(value, { production = false } = {}) {
  const v = normalizeApiUrl(value)
  if (!v) return ''
  let u
  try {
    u = new URL(v)
  } catch {
    return `VITE_API_URL ไม่ใช่ URL ที่ถูกต้อง: "${v}"`
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'VITE_API_URL ต้องขึ้นต้นด้วย https:// (หรือ http:// สำหรับ localhost)'
  if (u.pathname !== '/' || u.search || u.hash || u.username || u.password) {
    return 'VITE_API_URL ต้องเป็น origin เท่านั้น (เช่น https://ems-api.onrender.com) ห้ามมี path เช่น /api, query หรือรหัสผ่าน'
  }
  if (production && u.protocol === 'http:' && !isLocalHost(u.hostname)) return 'production ต้องใช้ https:// สำหรับ VITE_API_URL'
  return ''
}
