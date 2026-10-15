import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { migrate, pendingMigrations } from './migrate.js'
import { createApp } from './app.js'

const config = loadConfig()
const db = createDb(config)

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
  console.error('ตรวจสอบ DATABASE_URL, รหัสผ่าน, DB_SSL และการเชื่อมต่ออินเทอร์เน็ต (ดู backend/README.md หัวข้อแก้ปัญหา)')
  await db.close().catch(() => {})
  process.exit(1)
}

const server = createApp({ db, config }).listen(config.port, () => {
  console.log(`Backend พร้อมใช้งานที่ http://localhost:${config.port}`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => server.close(() => db.close().finally(() => process.exit(0))))
}
