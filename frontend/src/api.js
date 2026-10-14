import { ApiError } from './apiError'
import { mockRequest } from './mock/handlers'

export { ApiError }

// Frontend-only phase: the app talks to an in-memory mock (src/mock) by default.
// To use the real backend later, set VITE_USE_MOCK=false (requests go to /api, proxied by vite.config.js).
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const TOKEN_KEY = 'ems_token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

async function realRequest(path, { method, body, token }) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', data?.errors)
  return data
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  try {
    return await (USE_MOCK ? mockRequest : realRequest)(path, { method, body, token })
  } catch (err) {
    if (err.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized()
    throw err
  }
}
