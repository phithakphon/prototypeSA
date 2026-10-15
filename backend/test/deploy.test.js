import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { seed, TEST_PASSWORD } from '../src/seed.js'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config.js'

const ALLOWED = 'https://app.example.com'
let db
const servers = []

async function start(extra = {}, database = db) {
  const config = { jwtSecret: 'test-secret', jwtExpiresIn: '1h', port: 0, ...extra }
  const server = createApp({ db: database, config }).listen(0)
  await new Promise((r) => server.once('listening', r))
  servers.push(server)
  return `http://127.0.0.1:${server.address().port}`
}

before(async () => {
  db = await createTestDb()
  await migrate(db)
  await seed(db)
})
after(async () => {
  for (const s of servers) s.close()
  await db.close()
})

test('health: /health needs no auth and exposes nothing; /ready checks the database', async () => {
  const base = await start()
  const h = await fetch(`${base}/health`)
  assert.equal(h.status, 200)
  assert.deepEqual(await h.json(), { status: 'ok' })
  const r = await fetch(`${base}/ready`)
  assert.equal(r.status, 200)
  assert.deepEqual(await r.json(), { status: 'ok' })

  const broken = { query: async () => { throw Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432 secret-host'), { code: 'ECONNREFUSED' }) } }
  const base2 = await start({}, broken)
  const down = await fetch(`${base2}/ready`)
  assert.equal(down.status, 503)
  const text = await down.text()
  assert.deepEqual(JSON.parse(text), { status: 'unavailable' })
  assert.equal(text.includes('secret-host'), false)
  assert.equal((await fetch(`${base2}/health`)).status, 200) // liveness does not depend on the database
})

test('CORS: only explicitly listed origins are allowed, preflight works, no wildcard', async () => {
  const base = await start({ corsOrigins: [ALLOWED] })
  const ok = await fetch(`${base}/health`, { headers: { Origin: ALLOWED } })
  assert.equal(ok.headers.get('access-control-allow-origin'), ALLOWED)
  assert.match(ok.headers.get('vary') || '', /Origin/)
  assert.equal(ok.headers.get('access-control-allow-credentials'), null)

  const evil = await fetch(`${base}/health`, { headers: { Origin: 'https://evil.example.com' } })
  assert.equal(evil.headers.get('access-control-allow-origin'), null)
  const near = await fetch(`${base}/health`, { headers: { Origin: `${ALLOWED}.evil.com` } })
  assert.equal(near.headers.get('access-control-allow-origin'), null)
  const none = await fetch(`${base}/health`)
  assert.equal(none.headers.get('access-control-allow-origin'), null)

  const pre = await fetch(`${base}/api/employees`, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
  })
  assert.equal(pre.status, 204)
  assert.equal(pre.headers.get('access-control-allow-origin'), ALLOWED)
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/)
  const badPre = await fetch(`${base}/api/employees`, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example.com', 'Access-Control-Request-Method': 'GET' },
  })
  assert.equal(badPre.status, 403)
  assert.equal(badPre.headers.get('access-control-allow-origin'), null)

  // with nothing configured no cross-origin access is granted at all
  const closed = await start({})
  const c = await fetch(`${closed}/health`, { headers: { Origin: ALLOWED } })
  assert.equal(c.headers.get('access-control-allow-origin'), null)
})

test('security headers: HSTS only in production', async () => {
  const dev = await fetch(`${await start({ isProduction: false })}/health`)
  assert.equal(dev.headers.get('strict-transport-security'), null)
  const prod = await fetch(`${await start({ isProduction: true })}/health`)
  assert.match(prod.headers.get('strict-transport-security'), /max-age=\d+/)
  for (const res of [dev, prod]) {
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('x-frame-options'), 'DENY')
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('cache-control'), 'no-store')
  }
})

test('rate limits: client IP comes from X-Forwarded-For only when TRUST_PROXY is set', async () => {
  const login = (base, ip, username = 'hr1') =>
    fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ username, password: 'wrong-password' }),
    }).then((r) => r.status)

  // behind one proxy: client A is locked after 5 failures, client B (another IP) is not
  const proxied = await start({ trustProxy: 1 })
  for (let i = 0; i < 5; i++) await login(proxied, '203.0.113.10')
  assert.equal(await login(proxied, '203.0.113.10'), 429)
  assert.equal(await login(proxied, '203.0.113.11'), 401)

  // not behind a proxy: a spoofed header must NOT let an attacker dodge the limit
  const direct = await start({ trustProxy: 0 })
  for (let i = 0; i < 5; i++) await login(direct, `198.51.100.${i}`)
  assert.equal(await login(direct, '198.51.100.99'), 429)
})

test('rate limits: rotating usernames from one IP is still throttled (per-IP limit)', async () => {
  const base = await start({ trustProxy: 1 })
  const attempt = (n) =>
    fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.50' },
      body: JSON.stringify({ username: `ghost${n}`, password: 'wrong-password' }),
    }).then((r) => r.status)
  for (let i = 0; i < 30; i++) assert.equal(await attempt(i), 401)
  assert.equal(await attempt(31), 429)
  // a legitimate user on another IP is unaffected
  const ok = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.51' },
    body: JSON.stringify({ username: 'hr1', password: TEST_PASSWORD }),
  })
  assert.equal(ok.status, 200)
})

const PROD = {
  NODE_ENV: 'production',
  JWT_SECRET: 'j'.repeat(48),
  DATABASE_URL: 'postgresql://u:p@db.example.supabase.co:5432/postgres',
  DB_SSL: 'verify',
}

test('config: production fails safely when required settings are missing or unsafe', () => {
  assert.equal(loadConfig(PROD).isProduction, true)
  assert.throws(() => loadConfig({ ...PROD, JWT_SECRET: undefined }), /JWT_SECRET/)
  assert.throws(() => loadConfig({ ...PROD, JWT_SECRET: 'change-me' }), /JWT_SECRET/)
  assert.throws(() => loadConfig({ ...PROD, JWT_SECRET: 'short-secret' }), /32/)
  assert.throws(() => loadConfig({ ...PROD, DATABASE_URL: undefined }), /DATABASE_URL/)
  assert.throws(() => loadConfig({ ...PROD, DB_SSL: 'require' }), /DB_SSL=verify/)
  assert.throws(() => loadConfig({ ...PROD, DB_SSL: undefined }), /DB_SSL=verify/)
  // development is more lenient
  assert.equal(loadConfig({ JWT_SECRET: 'short', DATABASE_URL: PROD.DATABASE_URL }).isProduction, false)
})

test('config: CORS_ORIGINS, TRUST_PROXY and DB_SSL_CA_PEM are validated', () => {
  const c = loadConfig({ ...PROD, CORS_ORIGINS: ' https://a.example.com , https://b.example.com:8443,https://a.example.com ', TRUST_PROXY: '1' })
  assert.deepEqual(c.corsOrigins, ['https://a.example.com', 'https://b.example.com:8443'])
  assert.equal(c.trustProxy, 1)
  assert.deepEqual(loadConfig(PROD).corsOrigins, [])
  assert.equal(loadConfig(PROD).trustProxy, 0)
  for (const bad of ['*', 'https://a.example.com/', 'https://a.example.com/app', 'app.example.com', 'https://*.example.com', 'ftp://a.example.com']) {
    assert.throws(() => loadConfig({ ...PROD, CORS_ORIGINS: bad }), /CORS_ORIGINS/, bad)
  }
  assert.throws(() => loadConfig({ ...PROD, CORS_ORIGINS: 'http://app.example.com' }), /https/) // no plain http in production
  assert.deepEqual(loadConfig({ ...PROD, CORS_ORIGINS: 'http://localhost:5173' }).corsOrigins, ['http://localhost:5173'])
  for (const bad of ['true', '-1', 'abc', '1.5']) assert.throws(() => loadConfig({ ...PROD, TRUST_PROXY: bad }), /TRUST_PROXY/, bad)

  const pem = '-----BEGIN CERTIFICATE-----\\nMIIBfake\\n-----END CERTIFICATE-----'
  assert.match(loadConfig({ ...PROD, DB_SSL_CA_PEM: pem }).dbSslCaPem, /^-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----$/) // literal \n becomes a newline
  assert.throws(() => loadConfig({ ...PROD, DB_SSL_CA_PEM: 'not a certificate' }), /DB_SSL_CA_PEM/)
})
