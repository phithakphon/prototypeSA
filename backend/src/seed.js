// Test/development seed data. NOT for production: it creates well-known accounts.
import bcrypt from 'bcrypt'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createDb } from './db.js'
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

export async function seed(db, password = TEST_PASSWORD) {
  const hash = await bcrypt.hash(password, 10)
  await db.transaction(async (tx) => {
    for (const [code, first, last, dept, pos, start, salary, resigned, user] of EMPLOYEES) {
      const { rows } = await tx.query(
        `INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date,
           status, resignation_date, resignation_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [code, first, last, dept, pos, start, resigned ? 'resigned' : 'active', resigned, resigned ? 'ลาออกเพื่อไปศึกษาต่อ' : null],
      )
      const id = rows[0].id
      const hist = 'INSERT INTO employee_history (employee_id, event_type, description, event_date) VALUES ($1, $2, $3, $4)'
      await tx.query(hist, [id, 'hired', `เริ่มงานในตำแหน่ง ${pos} แผนก ${dept}`, start])
      if (resigned) await tx.query(hist, [id, 'resigned', 'ลาออกจากองค์กร', resigned])
      await tx.query('INSERT INTO salaries (employee_id, amount, effective_date, note) VALUES ($1, $2, $3, $4)', [id, salary, start, 'เงินเดือนเริ่มต้น'])
      if (user) await tx.query('INSERT INTO users (username, password_hash, role, employee_id) VALUES ($1, $2, $3, $4)', [user[0], hash, user[1], id])
    }
    for (const [title, date] of ANNOUNCEMENTS) {
      await tx.query('INSERT INTO announcements (title, published_at) VALUES ($1, $2)', [title, date])
    }
  })
}

// Read-only preview of what `seed` would insert. Runs SELECTs only (never migrates, never writes).
export async function planSeed(db) {
  const exists = async (t) => (await db.query('SELECT to_regclass($1) AS t', [`public.${t}`])).rows[0].t !== null
  const missing = []
  for (const t of ['employees', 'users', 'salaries', 'employee_history', 'announcements']) if (!(await exists(t))) missing.push(t)
  if (missing.length) return { missing }
  const count = async (t) => (await db.query(`SELECT COUNT(*)::int AS n FROM ${t}`)).rows[0].n
  const codes = EMPLOYEES.map((e) => e[0])
  const names = EMPLOYEES.filter((e) => e[8]).map((e) => e[8][0])
  return {
    missing,
    existing: { employees: await count('employees'), users: await count('users'), salaries: await count('salaries'), employee_history: await count('employee_history'), announcements: await count('announcements') },
    codeConflicts: (await db.query('SELECT employee_code FROM employees WHERE employee_code = ANY($1)', [codes])).rows.length,
    usernameConflicts: (await db.query('SELECT username FROM users WHERE username = ANY($1)', [names])).rows.length,
    planned: {
      employees: EMPLOYEES.length,
      users: names.length,
      salaries: EMPLOYEES.length,
      employee_history: EMPLOYEES.length + EMPLOYEES.filter((e) => e[7]).length,
      announcements: ANNOUNCEMENTS.length,
    },
    accounts: EMPLOYEES.filter((e) => e[8]).map((e) => ({ username: e[8][0], role: e[8][1], employeeCode: e[0] })),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig()
  const dryRun = process.argv.includes('--dry-run')
  if (!dryRun) {
    if (process.env.NODE_ENV === 'production') {
      console.error('ไม่อนุญาตให้ seed ข้อมูลทดสอบในโหมด production')
      process.exit(1)
    }
    // Seed creates test accounts: never let it hit a remote database by accident, and never with the public default password.
    if (!config.dbIsLocal && process.env.ALLOW_REMOTE_SEED !== 'yes') {
      console.error('DATABASE_URL ชี้ไปยังฐานข้อมูลระยะไกล (เช่น Supabase) — seed ถูกบล็อก')
      console.error('ถ้าต้องการจริง ๆ (เช่น Supabase โปรเจกต์ทดสอบ) ให้ตั้ง ALLOW_REMOTE_SEED=yes และ SEED_PASSWORD (อย่างน้อย 12 ตัวอักษร)')
      process.exit(1)
    }
    if (!config.dbIsLocal && (process.env.SEED_PASSWORD || '').length < 12) {
      console.error('seed ฐานข้อมูลระยะไกลต้องตั้ง SEED_PASSWORD อย่างน้อย 12 ตัวอักษร (ห้ามใช้รหัสผ่านทดสอบเริ่มต้นที่เปิดเผยใน README)')
      process.exit(1)
    }
  }
  const db = createDb(config)
  try {
    if (dryRun) {
      console.log('โหมด DRY RUN — อ่านอย่างเดียว ไม่ migrate ไม่เขียนข้อมูล ไม่แสดงรหัสผ่าน')
      console.log(JSON.stringify(await planSeed(db), null, 2))
    } else {
      await migrate(db)
      if ((await db.query('SELECT COUNT(*)::int AS n FROM employees')).rows[0].n > 0) {
        console.error('ฐานข้อมูลมีข้อมูลอยู่แล้ว จึงไม่ seed ซ้ำ (ไม่ลบหรือเขียนทับข้อมูลเดิม)')
        process.exitCode = 1
      } else {
        await seed(db, process.env.SEED_PASSWORD || TEST_PASSWORD)
        console.log(`seed สำเร็จ — บัญชีทดสอบ: manager1, hr1, finance1, executive1, employee1 ${process.env.SEED_PASSWORD ? '(รหัสผ่านตาม SEED_PASSWORD)' : `รหัสผ่าน ${TEST_PASSWORD}`}`)
      }
    }
  } catch (err) {
    console.error('seed ไม่สำเร็จ:', err.message)
    process.exitCode = 1
  } finally {
    await db.close()
  }
}
