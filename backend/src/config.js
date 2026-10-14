export function loadConfig(env = process.env) {
  if (!env.JWT_SECRET || env.JWT_SECRET === 'change-me') {
    throw new Error('ต้องตั้งค่า JWT_SECRET ในไฟล์ .env (ดู .env.example)')
  }
  return {
    port: Number(env.PORT) || 3001,
    dbPath: env.DB_PATH || './data/app.db',
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '8h',
  }
}
