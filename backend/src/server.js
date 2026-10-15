import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { migrate, pendingMigrations } from './migrate.js'
import { createApp } from './app.js'

// Fails fast with a clear message (never printing secrets) when a required variable is missing or invalid.
let config
try {
  config = loadConfig()
} catch (err) {
  console.error(`ตั้งค่าไม่ถูกต้อง: ${err.message}`)
  process.exit(1)
}
const db = createDb(config)

if (config.ignoredUrlParams.length) {
  console.warn(`เตือน: ละเว้นพารามิเตอร์ SSL ใน DATABASE_URL (${config.ignoredUrlParams.join(', ')}) — ใช้ DB_SSL / DB_SSL_CA แทน`)
}
if (!config.dbIsLocal && config.dbSsl !== 'verify') {
  console.warn('เตือน: DB_SSL ไม่ใช่ verify — การเชื่อมต่อเข้ารหัสแต่ไม่ตรวจใบรับรองเซิร์ฟเวอร์ (ตั้ง DB_SSL=verify + DB_SSL_CA หรือ DB_SSL_CA_PEM)')
}
if (config.isProduction) {
  if (config.corsOrigins.length === 0) {
    console.warn('เตือน: ไม่ได้ตั้ง CORS_ORIGINS — เบราว์เซอร์จากโดเมนอื่น (เช่น frontend บน Vercel) จะเรียก API นี้ไม่ได้')
  }
  if (config.trustProxy === 0) {
    console.warn('เตือน: ไม่ได้ตั้ง TRUST_PROXY — หลัง reverse proxy ของ Render/Railway ให้ตั้งเป็น 1 ไม่เช่นนั้นผู้ใช้ทุกคนจะถูกนับเป็น IP เดียวกันใน rate limit')
  }
}

try {
  await db.query('SELECT 1')
  if (config.autoMigrate) {
    await migrate(db)
  } else {
    const pending = await pendingMigrations(db)
    if (pending.length) throw new Error(`ยังมี migration ที่ยังไม่ได้รัน (${pending.join(', ')}) กรุณารัน npm run migrate`)
  }
} catch (err) {
  // message only: the connection string (with password) is never printed
  console.error(`เชื่อมต่อ/ตรวจสอบฐานข้อมูลไม่สำเร็จ: ${err.code ? `[${err.code}] ` : ''}${err.message}`)
  console.error('ตรวจสอบ DATABASE_URL, รหัสผ่าน, DB_SSL และการเชื่อมต่ออินเทอร์เน็ต (ดู docs/DEPLOYMENT.md หัวข้อแก้ปัญหา)')
  await db.close().catch(() => {})
  process.exit(1)
}

const server = createApp({ db, config }).listen(config.port, () => {
  console.log(`Backend พร้อมใช้งานที่พอร์ต ${config.port} (${config.nodeEnv})`)
})

// Graceful shutdown (hosting platforms send SIGTERM on every deploy): stop accepting requests, let running ones
// finish, release the database pool, and force-exit if that takes too long.
let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`ได้รับสัญญาณ ${signal} กำลังปิดระบบ...`)
  const force = setTimeout(() => {
    console.error('ปิดระบบไม่ทันเวลา บังคับออก')
    process.exit(1)
  }, 10_000)
  force.unref()
  server.close(async () => {
    await db.close().catch(() => {})
    process.exit(0)
  })
  server.closeIdleConnections?.()
}
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => shutdown(sig))

// Log the message only: never the request, token or employee data.
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason?.message || reason))
