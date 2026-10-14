// Test/development seed data. NOT for production: it creates well-known accounts.
import bcrypt from 'bcrypt'
import { fileURLToPath } from 'node:url'
import { openDb, transaction } from './db.js'
import { migrate } from './migrate.js'

export const TEST_PASSWORD = 'Passw0rd!'

const AUDIT = 'ตรวจสอบบัญชี'

// code, first, last, department, position, startDate, salary, resignation (date) | null, linked user
const EMPLOYEES = [
  ['E100', 'รัตนายุ', 'วงศ์สกุล', AUDIT, 'ผู้จัดการแผนกตรวจสอบบัญชี', '2018-03-01', 85000, null, ['manager1', 'manager']],
  ['E101', 'ประเสริฐ', 'ศรีสุข', AUDIT, 'เจ้าหน้าที่ธุรการ', '2026-07-01', 22000, null, null],
  ['E102', 'นภา', 'สว่างใจ', AUDIT, 'ผู้ตรวจสอบบัญชี', '2026-04-01', 38000, '2026-09-15', null],
  ['E103', 'วิชัย', 'มั่นคง', AUDIT, 'ผู้ช่วยผู้ตรวจสอบบัญชี', '2026-08-18', 28000, null, null],
  ['E104', 'สมหญิง', 'รักงาน', AUDIT, 'ผู้ตรวจสอบบัญชี', '2026-09-01', 40000, null, ['employee1', 'employee']],
  ['E105', 'สมชาย', 'ใจดี', AUDIT, 'ผู้ตรวจสอบบัญชีอาวุโส', '2026-09-15', 55000, null, null],
  ['E201', 'กัญญา', 'บุญมา', 'ฝ่ายบุคคล', 'เจ้าหน้าที่ฝ่ายบุคคล', '2020-05-11', 35000, null, ['hr1', 'hr']],
  ['E202', 'อนุชา', 'ทองดี', 'ฝ่ายบุคคล', 'ผู้ช่วยฝ่ายบุคคล', '2022-01-17', 26000, null, null],
  ['E301', 'ธนากร', 'พิทักษ์ผล', 'ฝ่ายการเงิน', 'เจ้าหน้าที่การเงิน', '2019-10-07', 42000, null, ['finance1', 'finance']],
  ['E302', 'มาลี', 'จันทร์เพ็ญ', 'ฝ่ายการเงิน', 'นักบัญชี', '2021-06-21', 36000, null, null],
  ['E401', 'วีรพงษ์', 'เจริญสุข', 'ฝ่ายบริหาร', 'ผู้อำนวยการ', '2015-01-05', 150000, null, ['executive1', 'executive']],
  ['E303', 'สุดา', 'แก้วมณี', 'ฝ่ายการเงิน', 'นักบัญชี', '2020-02-03', 34000, '2026-06-30', null],
]

const ANNOUNCEMENTS = [
  ['ประกาศวันหยุดประจำเดือนตุลาคม', '2026-10-10'],
  ['กำหนดการประเมินผลการปฏิบัติงานรอบปลายปี', '2026-10-03'],
  ['อบรมมาตรฐานการตรวจสอบบัญชีฉบับใหม่', '2026-09-24'],
  ['แจ้งปรับปรุงระบบข้อมูลพนักงาน', '2026-09-12'],
]

export function seed(db) {
  const hash = bcrypt.hashSync(TEST_PASSWORD, 10)
  transaction(db, () => {
    for (const [code, first, last, dept, pos, start, salary, resigned, user] of EMPLOYEES) {
      const info = db
        .prepare(
          `INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date,
             status, resignation_date, resignation_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(code, first, last, dept, pos, start, resigned ? 'resigned' : 'active', resigned, resigned ? 'ลาออกเพื่อไปศึกษาต่อ' : null)
      const id = Number(info.lastInsertRowid)
      const hist = db.prepare('INSERT INTO employee_history (employee_id, event_type, description, event_date) VALUES (?, ?, ?, ?)')
      hist.run(id, 'hired', `เริ่มงานในตำแหน่ง ${pos} แผนก ${dept}`, start)
      if (resigned) hist.run(id, 'resigned', 'ลาออกจากองค์กร', resigned)
      db.prepare('INSERT INTO salaries (employee_id, amount, effective_date, note) VALUES (?, ?, ?, ?)').run(id, salary, start, 'เงินเดือนเริ่มต้น')
      if (user) db.prepare('INSERT INTO users (username, password_hash, role, employee_id) VALUES (?, ?, ?, ?)').run(user[0], hash, user[1], id)
    }
    for (const [title, date] of ANNOUNCEMENTS) {
      db.prepare('INSERT INTO announcements (title, published_at) VALUES (?, ?)').run(title, date)
    }
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('ไม่อนุญาตให้ seed ข้อมูลทดสอบในโหมด production')
    process.exit(1)
  }
  const db = openDb(process.env.DB_PATH || './data/app.db')
  migrate(db)
  if (db.prepare('SELECT COUNT(*) AS n FROM employees').get().n > 0) {
    console.error('ฐานข้อมูลมีข้อมูลอยู่แล้ว จึงไม่ seed ซ้ำ (ลบไฟล์ data/app.db เพื่อเริ่มใหม่)')
    process.exit(1)
  }
  seed(db)
  console.log(`seed สำเร็จ — บัญชีทดสอบ: manager1, hr1, finance1, executive1, employee1 รหัสผ่าน ${TEST_PASSWORD}`)
}
