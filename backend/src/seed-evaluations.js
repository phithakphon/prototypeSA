// Explicit additive command for an existing fictional development database only.
import { existsSync } from 'node:fs'
import { openDb } from './db.js'
import { seedDemoEvaluations } from './demo-evaluation-seed.js'

if (process.env.NODE_ENV === 'production' || !process.argv.includes('--demo-only')) {
  throw new Error('ใช้คำสั่งนี้เฉพาะฐานข้อมูลสมมติ และระบุ --demo-only ห้ามใช้กับข้อมูลจริง')
}
const path = process.env.DB_PATH || './data/app.db'
if (!existsSync(path)) throw new Error('ไม่พบฐานข้อมูลตัวอย่าง กรุณาสร้างด้วย seed ของระบบก่อน')
const db = openDb(path)
try {
  console.log(`เพิ่มผลการประเมินสมมติ ${seedDemoEvaluations(db)} รายการ โดยไม่แก้ไขข้อมูลเดิม`)
} finally { db.close() }
