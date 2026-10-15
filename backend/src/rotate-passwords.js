// Rotates the passwords of the seeded test accounts without ever printing a password.
//
//   1. Put the NEW password in the environment for this run only (not on the command line, not in git), e.g.
//        PowerShell:  $env:ROTATE_NEW_PASSWORD = Read-Host   (or paste into .env temporarily, then delete the line)
//   2. npm run rotate:passwords                                   DRY RUN: validates and reports, writes nothing
//   3. npm run rotate:passwords -- --execute --confirm-rotate     really updates password_hash (one transaction)
//   4. Update SEED_PASSWORD in .env (or remove it) and delete ROTATE_NEW_PASSWORD.
//
// Only password_hash of the listed accounts is updated (bcrypt, cost 10). Nothing else changes.
// Sessions already issued stay valid until they expire (JWT_EXPIRES_IN); change JWT_SECRET and restart to end them now.
import bcrypt from 'bcrypt'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './config.js'
import { createDb } from './db.js'

export const SEEDED_USERNAMES = ['manager1', 'hr1', 'finance1', 'executive1', 'employee1']
const KNOWN_PUBLIC = ['Passw0rd!']

// Returns a list of failed rules (never the password itself).
export function passwordProblems(password, { previous = [] } = {}) {
  const problems = []
  if (typeof password !== 'string' || !password) return ['ไม่ได้ตั้งค่า ROTATE_NEW_PASSWORD']
  if (password.length < 12) problems.push('ยาวน้อยกว่า 12 ตัวอักษร')
  if (Buffer.byteLength(password) > 72) problems.push('ยาวเกิน 72 ไบต์ (ขีดจำกัดของ bcrypt)')
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) problems.push('ต้องมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข')
  if (KNOWN_PUBLIC.includes(password) || previous.includes(password)) problems.push('ซ้ำกับรหัสผ่านที่เคยเปิดเผยหรือรหัสผ่านเดิม')
  return problems
}

export async function rotate(db, { usernames, newPassword, previous = [], execute }) {
  const problems = passwordProblems(newPassword, { previous })
  const rows = (await db.query('SELECT id, username, password_hash FROM users WHERE username = ANY($1) ORDER BY id', [usernames])).rows
  const missing = usernames.filter((u) => !rows.some((r) => r.username === u))
  const sameAsCurrent = []
  if (!problems.length) {
    for (const r of rows) if (await bcrypt.compare(newPassword, r.password_hash)) sameAsCurrent.push(r.username)
  }
  if (sameAsCurrent.length) problems.push(`เหมือนรหัสผ่านปัจจุบันของ: ${sameAsCurrent.join(', ')}`)
  const result = { accounts: rows.map((r) => r.username), missing, problems, updated: 0 }
  if (!execute || problems.length || !rows.length) return result

  const hash = await bcrypt.hash(newPassword, 10)
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const { rowCount } = await tx.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, r.id])
      result.updated += rowCount
    }
  })
  return result
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const execute = process.argv.includes('--execute')
  if (execute && !process.argv.includes('--confirm-rotate')) {
    console.error('การเปลี่ยนรหัสผ่านจริงต้องใส่ทั้ง --execute และ --confirm-rotate')
    process.exit(1)
  }
  const usernames = process.env.ROTATE_USERNAMES ? process.env.ROTATE_USERNAMES.split(',').map((s) => s.trim()).filter(Boolean) : SEEDED_USERNAMES
  const config = loadConfig()
  const db = createDb(config)
  try {
    console.log(`${execute ? 'EXECUTE' : 'DRY RUN'} — host: ${config.dbHost} — บัญชี: ${usernames.join(', ')} (ไม่แสดงรหัสผ่าน)`)
    const r = await rotate(db, {
      usernames,
      newPassword: process.env.ROTATE_NEW_PASSWORD,
      previous: [process.env.SEED_PASSWORD].filter(Boolean),
      execute,
    })
    console.log(`พบบัญชี ${r.accounts.length}/${usernames.length}${r.missing.length ? ` (ไม่พบ: ${r.missing.join(', ')})` : ''}`)
    if (r.problems.length) {
      console.error(`รหัสผ่านใหม่ไม่ผ่านเงื่อนไข: ${r.problems.join('; ')}`)
      process.exitCode = 1
    } else if (execute) {
      console.log(`เปลี่ยนรหัสผ่านแล้ว ${r.updated} บัญชี — อย่าลืมอัปเดต/ลบ SEED_PASSWORD และลบ ROTATE_NEW_PASSWORD ออกจาก .env`)
    } else {
      console.log('รหัสผ่านใหม่ผ่านเงื่อนไข — เมื่อพร้อม: npm run rotate:passwords -- --execute --confirm-rotate')
    }
  } catch (err) {
    console.error('ไม่สำเร็จ:', err.message)
    process.exitCode = 1
  } finally {
    await db.close()
  }
}
