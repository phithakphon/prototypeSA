import { existsSync } from 'node:fs'

// SSL options that, if present in DATABASE_URL, would silently override DB_SSL (the pg driver lets the URL win).
// They are removed so that DB_SSL / DB_SSL_CA are the only source of truth for certificate verification.
const URL_SSL_PARAMS = ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']

// An origin is scheme + host (+ port): no path, no trailing slash, no wildcard.
const ORIGIN_RE = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/
const isLocalHost = (h) => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(h)

function parseOrigins(raw, isProduction) {
  const list = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean)
  for (const origin of list) {
    if (!ORIGIN_RE.test(origin)) {
      throw new Error(`CORS_ORIGINS ไม่ถูกต้อง: "${origin}" (ต้องเป็น origin เช่น https://app.example.com ไม่มี path ไม่มี / ท้าย และห้ามใช้ *)`)
    }
    if (isProduction && origin.startsWith('http://') && !isLocalHost(new URL(origin).hostname)) {
      throw new Error(`CORS_ORIGINS: โหมด production ต้องใช้ https ("${origin}")`)
    }
  }
  return [...new Set(list)]
}

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production'

  if (!env.JWT_SECRET || env.JWT_SECRET === 'change-me') {
    throw new Error('ต้องตั้งค่า JWT_SECRET ในไฟล์ .env (ดู .env.example)')
  }
  if (isProduction && env.JWT_SECRET.length < 32) {
    throw new Error('โหมด production ต้องใช้ JWT_SECRET ยาวอย่างน้อย 32 ตัวอักษร (สร้างด้วยคำสั่งใน .env.example)')
  }
  if (!env.DATABASE_URL) {
    throw new Error('ต้องตั้งค่า DATABASE_URL (Supabase connection string) ในไฟล์ .env (ดู .env.example)')
  }
  let url
  try {
    url = new URL(env.DATABASE_URL)
  } catch {
    // never echo the value: it contains the password
    throw new Error('DATABASE_URL รูปแบบไม่ถูกต้อง (ถ้ารหัสผ่านมีอักขระพิเศษ เช่น @ ต้อง URL-encode)')
  }
  const host = url.hostname
  const isLocal = isLocalHost(host)

  const ignoredUrlParams = URL_SSL_PARAMS.filter((k) => url.searchParams.has(k))
  let databaseUrl = env.DATABASE_URL
  if (ignoredUrlParams.length) {
    for (const k of ignoredUrlParams) url.searchParams.delete(k)
    databaseUrl = url.toString()
  }

  const dbSsl = env.DB_SSL || (isLocal ? 'disable' : 'require')
  if (!['disable', 'require', 'verify'].includes(dbSsl)) {
    throw new Error('DB_SSL ต้องเป็น disable, require หรือ verify')
  }
  const dbSslCa = env.DB_SSL_CA || null
  if (dbSsl === 'verify' && dbSslCa && !existsSync(dbSslCa)) {
    throw new Error('ไม่พบไฟล์ใบรับรองที่ระบุใน DB_SSL_CA')
  }
  // PEM text instead of a file path, for hosts without file mounts (Render, Railway ...). Public certificate, not a secret.
  let dbSslCaPem = null
  if (env.DB_SSL_CA_PEM) {
    dbSslCaPem = env.DB_SSL_CA_PEM.replace(/\\n/g, '\n').trim()
    if (!dbSslCaPem.includes('BEGIN CERTIFICATE') || !dbSslCaPem.includes('END CERTIFICATE')) {
      throw new Error('DB_SSL_CA_PEM ต้องเป็นข้อความใบรับรองแบบ PEM (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)')
    }
  }
  // Production must verify the server certificate and must never talk to a remote database in clear text.
  if (isProduction && !isLocal && dbSsl !== 'verify') {
    throw new Error('โหมด production ต้องตั้ง DB_SSL=verify (และ DB_SSL_CA หรือ DB_SSL_CA_PEM) เพื่อตรวจใบรับรองของฐานข้อมูล')
  }

  // Number of reverse-proxy hops in front of the app (Render/Railway = 1). Needed for correct client IPs, which the
  // login / registration rate limits depend on. Only an exact hop count is accepted ("true" would trust spoofed headers).
  const rawProxy = (env.TRUST_PROXY ?? '').trim()
  if (rawProxy && !/^\d{1,2}$/.test(rawProxy)) {
    throw new Error('TRUST_PROXY ต้องเป็นจำนวนเต็ม (จำนวน reverse proxy หน้าแอป เช่น 1) ไม่รองรับ true')
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    isProduction,
    port: Number(env.PORT) || 3001,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    corsOrigins: parseOrigins(env.CORS_ORIGINS, isProduction),
    trustProxy: rawProxy ? Number(rawProxy) : 0,
    databaseUrl,
    ignoredUrlParams,
    dbHost: host,
    dbIsLocal: isLocal,
    dbSsl,
    dbSslCa,
    dbSslCaPem,
    dbPoolMax: Number(env.DB_POOL_MAX) || 10,
    autoMigrate: env.AUTO_MIGRATE === 'true',
  }
}
