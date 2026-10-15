// One-off, repeatable import of the legacy SQLite database into PostgreSQL (Supabase).
//
//   npm run migrate:data                 DRY RUN (default): reads SQLite only, prints row counts, writes nothing,
//                                        never prints employee/salary values.
//   npm run migrate:data -- --execute --approve-pii-transfer
//                                        really writes to DATABASE_URL. Both flags are required because the data
//                                        includes personal data, salaries and password hashes.
//
// Safety: the SQLite file is opened read-only and never modified. Rows are inserted with their original ids
// (ON CONFLICT (id) DO NOTHING), so re-running never duplicates and never overwrites existing rows. Everything
// runs in one transaction: a unique-key conflict with different ids (e.g. same employee_code) aborts the whole run.
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { pendingMigrations } from './migrate.js'

// Parent tables first (foreign keys). `cols` are copied as-is; id is preserved.
export const TABLES = [
  { name: 'employees', cols: ['id', 'employee_code', 'first_name', 'last_name', 'department', 'position', 'status', 'start_date', 'resignation_date', 'resignation_reason', 'national_id', 'phone', 'email', 'address', 'created_at', 'updated_at'], pii: true },
  { name: 'users', cols: ['id', 'username', 'password_hash', 'role', 'employee_id', 'created_at'], pii: true },
  { name: 'salaries', cols: ['id', 'employee_id', 'amount', 'effective_date', 'note', 'created_by', 'created_at', 'updated_at'], pii: true },
  { name: 'employee_history', cols: ['id', 'employee_id', 'event_type', 'description', 'event_date', 'created_by', 'created_at'], pii: false },
  { name: 'announcements', cols: ['id', 'title', 'published_at'], pii: false },
]

// SQLite stores timestamps as 'YYYY-MM-DD HH:MM:SS' in UTC.
const TS_COLS = new Set(['created_at', 'updated_at'])
const convert = (col, v) => (TS_COLS.has(col) && typeof v === 'string' ? `${v.replace(' ', 'T')}Z` : v)

export async function importData({ sqlite, db, execute }) {
  const report = []
  const run = async (q) => {
    for (const t of TABLES) {
      const rows = sqlite.prepare(`SELECT ${t.cols.join(', ')} FROM ${t.name} ORDER BY id`).all()
      let inserted = 0
      if (execute) {
        const placeholders = t.cols.map((_, i) => `$${i + 1}`).join(', ')
        const sql = `INSERT INTO ${t.name} (${t.cols.join(', ')}) OVERRIDING SYSTEM VALUE VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`
        for (const r of rows) {
          const res = await q.query(sql, t.cols.map((c) => convert(c, r[c] ?? null)))
          inserted += res.rowCount
        }
        // keep the identity sequence ahead of the imported ids
        await q.query(`SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${t.name}), 1))`)
      }
      report.push({ table: t.name, pii: t.pii, source: rows.length, inserted: execute ? inserted : null, skipped: execute ? rows.length - inserted : null })
    }
  }
  if (execute) await db.transaction(run)
  else await run(null)
  return report
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const execute = process.argv.includes('--execute')
  const approved = process.argv.includes('--approve-pii-transfer')
  const sqlitePath = process.env.SQLITE_PATH || './data/app.db'
  if (!existsSync(sqlitePath)) {
    console.error(`ไม่พบไฟล์ SQLite: ${sqlitePath}`)
    process.exit(1)
  }
  if (execute && !approved) {
    console.error('การย้ายข้อมูลจริงมีข้อมูลส่วนบุคคล เงินเดือน และ password hash — ต้องใส่ทั้ง --execute และ --approve-pii-transfer')
    process.exit(1)
  }
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true })
  const config = execute ? loadConfig() : null
  const db = execute ? createDb(config) : null
  try {
    if (execute) {
      const pending = await pendingMigrations(db)
      if (pending.length) throw new Error(`ยังไม่ได้ migrate schema (${pending.join(', ')}) กรุณารัน npm run migrate ก่อน`)
      console.log(`เขียนไปที่ฐานข้อมูล host: ${config.dbHost}`)
    } else {
      console.log('โหมด DRY RUN — ไม่เขียนอะไรลงฐานข้อมูลปลายทาง และไม่แสดงค่าข้อมูล')
    }
    const report = await importData({ sqlite, db, execute })
    for (const r of report) {
      console.log(
        `${r.table.padEnd(18)} ต้นทาง ${String(r.source).padStart(5)} แถว` +
          (execute ? `  เพิ่มใหม่ ${r.inserted}  ข้าม(มีอยู่แล้ว) ${r.skipped}` : '') +
          (r.pii ? '  [มีข้อมูลอ่อนไหว]' : ''),
      )
    }
    if (!execute) console.log('\nถ้าตรวจสอบแล้วต้องการย้ายจริง: npm run migrate:data -- --execute --approve-pii-transfer')
  } catch (err) {
    console.error('ย้ายข้อมูลไม่สำเร็จ (rollback ทั้งหมดแล้ว):', err.message)
    process.exitCode = 1
  } finally {
    sqlite.close()
    await db?.close()
  }
}
