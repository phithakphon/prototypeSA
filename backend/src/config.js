export function loadConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET === 'change-me') {
    throw new Error('ต้องตั้งค่า JWT_SECRET ในไฟล์ .env (ดู .env.example)')
  }
  if (!env.DATABASE_URL) {
    throw new Error('ต้องตั้งค่า DATABASE_URL (Supabase connection string) ในไฟล์ .env (ดู .env.example)')
  }
  let host
  try {
    host = new URL(env.DATABASE_URL).hostname
  } catch {
    // never echo the value: it contains the password
    throw new Error('DATABASE_URL รูปแบบไม่ถูกต้อง (ถ้ารหัสผ่านมีอักขระพิเศษ เช่น @ ต้อง URL-encode)')
  }
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)
  const dbSsl = env.DB_SSL || (isLocal ? 'disable' : 'require')
  if (!['disable', 'require', 'verify'].includes(dbSsl)) {
    throw new Error('DB_SSL ต้องเป็น disable, require หรือ verify')
  }
  return {
    port: Number(env.PORT) || 3001,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
    databaseUrl: env.DATABASE_URL,
    dbHost: host,
    dbIsLocal: isLocal,
    dbSsl,
    dbSslCa: env.DB_SSL_CA || null,
    dbPoolMax: Number(env.DB_POOL_MAX) || 10,
    autoMigrate: env.AUTO_MIGRATE === 'true',
  }
}
