import { existsSync } from 'node:fs'

// SSL options that, if present in DATABASE_URL, would silently override DB_SSL (the pg driver lets the URL win).
// They are removed so that DB_SSL / DB_SSL_CA are the only source of truth for certificate verification.
const URL_SSL_PARAMS = ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']

export function loadConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET === 'change-me') {
    throw new Error('ต้องตั้งค่า JWT_SECRET ในไฟล์ .env (ดู .env.example)')
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
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)

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
  // Production must verify the server certificate and must never talk to a remote database in clear text.
  if (env.NODE_ENV === 'production' && !isLocal && dbSsl !== 'verify') {
    throw new Error('โหมด production ต้องตั้ง DB_SSL=verify (และ DB_SSL_CA ถ้าจำเป็น) เพื่อตรวจใบรับรองของฐานข้อมูล')
  }
  return {
    port: Number(env.PORT) || 3001,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    databaseUrl,
    ignoredUrlParams,
    dbHost: host,
    dbIsLocal: isLocal,
    dbSsl,
    dbSslCa,
    dbPoolMax: Number(env.DB_POOL_MAX) || 10,
    autoMigrate: env.AUTO_MIGRATE === 'true',
  }
}
