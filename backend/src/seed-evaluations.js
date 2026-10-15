// Explicit additive command for an existing fictional development database only.
import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { seedDemoEvaluations } from './demo-evaluation-seed.js'

if (process.env.NODE_ENV === 'production' || !process.argv.includes('--demo-only')) {
  throw new Error('ใช้คำสั่งนี้เฉพาะฐานข้อมูลสมมติ และระบุ --demo-only ห้ามใช้กับข้อมูลจริง')
}
const config = loadConfig()
// Same guard as seed.js: never write demo rows to a remote database (e.g. Supabase) by accident.
if (!config.dbIsLocal && process.env.ALLOW_REMOTE_SEED !== 'yes') {
  throw new Error('DATABASE_URL ชี้ไปยังฐานข้อมูลระยะไกล — คำสั่งนี้ถูกบล็อก (ต้องตั้ง ALLOW_REMOTE_SEED=yes สำหรับฐานข้อมูลทดสอบเท่านั้น)')
}
const db = createDb(config)
try {
  console.log(`เพิ่มผลการประเมินสมมติ ${await seedDemoEvaluations(db)} รายการ โดยไม่แก้ไขข้อมูลเดิม`)
} catch (err) {
  console.error('seed ผลการประเมินไม่สำเร็จ:', err.message)
  process.exitCode = 1
} finally {
  await db.close()
}
