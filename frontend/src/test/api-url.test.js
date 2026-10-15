import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiUrlProblem, normalizeApiUrl } from '../apiUrl'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('apiUrlProblem', () => {
  it('accepts an empty value (same origin) and plain origins', () => {
    for (const ok of ['', undefined, '  ', 'https://ems-api.onrender.com', 'https://ems-api.onrender.com/', 'https://api.example.com:8443']) {
      expect(apiUrlProblem(ok, { production: true })).toBe('')
    }
    expect(apiUrlProblem('http://localhost:3001')).toBe('')
    expect(apiUrlProblem('http://localhost:3001', { production: true })).toBe('')
  })

  it('rejects values that would break or leak in a production browser build', () => {
    for (const bad of ['ems-api.onrender.com', 'https://ems-api.onrender.com/api', 'https://x.example.com/v1', 'https://x.example.com?a=1', 'https://user:pass@x.example.com', 'ftp://x.example.com', 'javascript:alert(1)']) {
      expect(apiUrlProblem(bad, { production: true }), bad).not.toBe('')
    }
    expect(apiUrlProblem('http://api.example.com', { production: true })).toMatch(/https/)
    expect(apiUrlProblem('http://api.example.com')).toBe('') // plain http is tolerated outside production
  })

  it('normalises trailing slashes', () => {
    expect(normalizeApiUrl('https://a.example.com///')).toBe('https://a.example.com')
    expect(normalizeApiUrl(undefined)).toBe('')
  })
})

describe('real requests', () => {
  async function callWith(apiUrl) {
    vi.resetModules()
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_API_URL', apiUrl)
    const urls = []
    vi.stubGlobal('fetch', async (url, init) => {
      urls.push({ url, auth: init.headers.Authorization })
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    })
    const { api, setToken } = await import('../api')
    setToken('t-123')
    await api('/employees?q=a')
    return urls
  }

  it('goes to the configured backend origin', async () => {
    expect(await callWith('https://ems-api.onrender.com/')).toEqual([{ url: 'https://ems-api.onrender.com/api/employees?q=a', auth: 'Bearer t-123' }])
  })

  it('stays same-origin when VITE_API_URL is empty', async () => {
    expect((await callWith(''))[0].url).toBe('/api/employees?q=a')
  })
})
