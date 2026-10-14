import { ApiError } from '../apiError'
import { todayIso } from '../format'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const fail = (message, errors) => new ApiError(400, message, errors)

export function parseEmployee(body) {
  const b = body && typeof body === 'object' ? body : {}
  const errors = {}
  const out = {}
  const required = (key, label, max = 100) => {
    const v = str(b[key])
    if (!v) errors[key] = `กรุณากรอก${label}`
    else if (v.length > max) errors[key] = `${label}ยาวเกินไป (สูงสุด ${max} ตัวอักษร)`
    else out[key] = v
  }
  const optional = (key, re, msg, max = 200) => {
    const v = str(b[key])
    if (!v) out[key] = null
    else if (v.length > max || (re && !re.test(v))) errors[key] = msg
    else out[key] = v
  }

  const code = str(b.employeeCode).toUpperCase()
  if (!code) errors.employeeCode = 'กรุณากรอกรหัสพนักงาน'
  else if (!/^[A-Z0-9-]{2,20}$/.test(code)) errors.employeeCode = 'รหัสพนักงานใช้ได้เฉพาะ A-Z, 0-9 และ - (2-20 ตัวอักษร)'
  else out.employeeCode = code

  required('firstName', 'ชื่อ')
  required('lastName', 'นามสกุล')
  required('department', 'แผนก')
  required('position', 'ตำแหน่ง')

  if (!isValidDate(b.startDate)) errors.startDate = 'วันที่เริ่มงานไม่ถูกต้อง'
  else if (b.startDate > todayIso()) errors.startDate = 'วันที่เริ่มงานต้องไม่เป็นวันในอนาคต'
  else out.startDate = b.startDate

  optional('nationalId', /^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก')
  optional('phone', /^[0-9+\-\s]{8,20}$/, 'เบอร์โทรศัพท์ไม่ถูกต้อง')
  optional('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'อีเมลไม่ถูกต้อง')
  optional('address', null, 'ที่อยู่ยาวเกินไป', 500)

  if (Object.keys(errors).length) throw fail('ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', errors)
  return out
}

export function parseSalary(body) {
  const b = body && typeof body === 'object' ? body : {}
  const errors = {}
  const amount = typeof b.amount === 'number' ? b.amount : Number(b.amount)
  if (b.amount === undefined || b.amount === null || b.amount === '' || !Number.isFinite(amount)) {
    errors.amount = 'กรุณากรอกเงินเดือนเป็นตัวเลข'
  } else if (amount <= 0) errors.amount = 'เงินเดือนต้องมากกว่า 0'
  else if (amount > 10_000_000) errors.amount = 'เงินเดือนสูงเกินกว่าที่ระบบรองรับ'
  if (!isValidDate(b.effectiveDate)) errors.effectiveDate = 'วันที่มีผลไม่ถูกต้อง'
  const note = str(b.note)
  if (note.length > 300) errors.note = 'หมายเหตุยาวเกินไป (สูงสุด 300 ตัวอักษร)'
  if (Object.keys(errors).length) throw fail('ข้อมูลเงินเดือนไม่ถูกต้อง', errors)
  return { amount: Math.round(amount * 100) / 100, effectiveDate: b.effectiveDate, note: note || null }
}

export function parseResignation(body) {
  const b = body && typeof body === 'object' ? body : {}
  const errors = {}
  if (!isValidDate(b.resignationDate)) errors.resignationDate = 'วันที่ลาออกไม่ถูกต้อง'
  const reason = str(b.reason)
  if (reason.length > 500) errors.reason = 'เหตุผลยาวเกินไป (สูงสุด 500 ตัวอักษร)'
  if (Object.keys(errors).length) throw fail('ข้อมูลการลาออกไม่ถูกต้อง', errors)
  return { resignationDate: b.resignationDate, reason: reason || null }
}
