// Checks the PostgreSQL TLS setup (read-only: SELECT 1). Prints no credentials.
//   npm run db:ssl-check
// Expects DB_SSL=verify and DB_SSL_CA=<path to the Supabase Root CA you downloaded from the Supabase dashboard>.
// The CA must come from a trusted Supabase source (Dashboard > Database Settings > SSL Configuration), never from
// the database server itself: trusting what the server sends would defeat the verification.
import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'
import { loadConfig } from './config.js'
import { createDb } from './db.js'

const config = loadConfig()
console.log(`host: ${config.dbHost} | DB_SSL=${config.dbSsl} | CA configured: ${Boolean(config.dbSslCa || config.dbSslCaPem)}`)
let ok = true

if (config.dbIsLocal) {
  console.log('localhost: TLS verification not applicable')
  process.exit(0)
}
if (config.dbSsl !== 'verify') {
  console.error('ยังไม่ได้ตั้ง DB_SSL=verify — การเชื่อมต่อเข้ารหัสแต่ไม่ได้ตรวจใบรับรองของเซิร์ฟเวอร์')
  ok = false
}
if (!config.dbSslCa && !config.dbSslCaPem) {
  console.error('ยังไม่ได้ตั้ง DB_SSL_CA หรือ DB_SSL_CA_PEM (Supabase Root CA ที่ดาวน์โหลดจาก Supabase Dashboard)')
  ok = false
} else {
  const cert = new X509Certificate(config.dbSslCaPem || readFileSync(config.dbSslCa, 'utf8'))
  const now = new Date()
  const valid = now >= new Date(cert.validFrom) && now <= new Date(cert.validTo)
  console.log(`CA file: subject=${cert.subject.replace(/\n/g, ', ')} | issuer=${cert.issuer.replace(/\n/g, ', ')}`)
  console.log(`CA file: valid ${cert.validFrom} -> ${cert.validTo} (${valid ? 'ok' : 'EXPIRED/NOT YET VALID'}) | self-signed root: ${cert.subject === cert.issuer} | is CA: ${cert.ca}`)
  console.log(`CA file SHA-256: ${cert.fingerprint256}   <- compare with the fingerprint shown in the Supabase dashboard`)
  if (!valid || !cert.ca || cert.subject !== cert.issuer) {
    console.error('ไฟล์นี้ไม่ใช่ Root CA ที่ใช้ได้')
    ok = false
  }
}

if (ok) {
  const db = createDb(config)
  try {
    await db.query('SELECT 1')
    console.log('เชื่อมต่อสำเร็จ — ใบรับรองของเซิร์ฟเวอร์และชื่อโฮสต์ผ่านการตรวจสอบกับ CA ที่ระบุ')
  } catch (err) {
    console.error(`เชื่อมต่อไม่สำเร็จ: [${err.code || ''}] ${err.message}`)
    ok = false
  } finally {
    await db.close()
  }
}
process.exitCode = ok ? 0 : 1
