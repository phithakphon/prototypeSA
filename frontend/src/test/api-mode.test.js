import { afterEach, describe, expect, it, vi } from 'vitest'

// The mock must never be used by a production build, whatever the environment variable says.
async function loadApi() {
  vi.resetModules()
  return import('../api')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('USE_MOCK', () => {
  it('is on by default in development / tests', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_USE_MOCK', undefined)
    expect((await loadApi()).USE_MOCK).toBe(true)
  })

  it('can be switched off with VITE_USE_MOCK=false in development', async () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_USE_MOCK', 'false')
    expect((await loadApi()).USE_MOCK).toBe(false)
  })

  it.each([undefined, 'true', 'false', '1'])('is always off in production builds (VITE_USE_MOCK=%s)', async (value) => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_USE_MOCK', value)
    expect((await loadApi()).USE_MOCK).toBe(false)
  })

  it('production requests go to the real /api, never to the mock', async () => {
    vi.stubEnv('PROD', true)
    const calls = []
    vi.stubGlobal('fetch', async (url) => {
      calls.push(url)
      return { ok: true, status: 200, json: async () => ({ ok: true }) }
    })
    const { api } = await loadApi()
    await api('/dashboard/summary')
    expect(calls).toEqual(['/api/dashboard/summary'])
    vi.unstubAllGlobals()
  })
})
