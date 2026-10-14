// Registration validation rules. Pure functions, shared by the form (instant feedback) and the mock
// registration adapter. A real backend must repeat these checks: browser validation is only a convenience.

export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9._-]{3,19}$/

export function validateUsername(value) {
  const v = String(value ?? '').trim()
  if (!v) return 'กรุณากรอกชื่อผู้ใช้'
  if (v.length < 4) return 'ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร'
  if (v.length > 20) return 'ชื่อผู้ใช้ต้องไม่เกิน 20 ตัวอักษร'
  if (!USERNAME_RE.test(v)) return 'ชื่อผู้ใช้ต้องขึ้นต้นด้วยตัวอักษร และใช้ได้เฉพาะ a-z, 0-9, จุด ขีดกลาง และขีดล่าง'
  return ''
}

// Each requirement is shown to the user as a checklist (icon + text, never colour alone).
export const PASSWORD_CHECKS = [
  { key: 'length', label: 'ยาวอย่างน้อย 8 ตัวอักษร', test: (p) => p.length >= 8 },
  { key: 'lower', label: 'มีตัวอักษรพิมพ์เล็ก (a-z)', test: (p) => /[a-z]/.test(p) },
  { key: 'upper', label: 'มีตัวอักษรพิมพ์ใหญ่ (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { key: 'digit', label: 'มีตัวเลข (0-9)', test: (p) => /\d/.test(p) },
]

export function validatePassword(value) {
  const p = String(value ?? '')
  if (!p) return 'กรุณากรอกรหัสผ่าน'
  if (p.length > 64) return 'รหัสผ่านต้องไม่เกิน 64 ตัวอักษร'
  const missing = PASSWORD_CHECKS.filter((c) => !c.test(p))
  if (missing.length) return `รหัสผ่านยังไม่ครบเงื่อนไข: ${missing.map((c) => c.label).join(', ')}`
  return ''
}

export function validateConfirm(password, confirm) {
  if (!confirm) return 'กรุณายืนยันรหัสผ่าน'
  if (password !== confirm) return 'รหัสผ่านที่ยืนยันไม่ตรงกัน'
  return ''
}

// 0 (empty) .. 4. Required checks + extra length + a symbol raise the score.
export function passwordStrength(value) {
  const p = String(value ?? '')
  if (!p) return { score: 0, label: 'ยังไม่ได้กรอก' }
  const passed = PASSWORD_CHECKS.filter((c) => c.test(p)).length
  let score = passed === PASSWORD_CHECKS.length ? 2 : passed >= 2 ? 1 : 0
  if (score === 2 && (p.length >= 12 || /[^A-Za-z0-9]/.test(p))) score = 3
  if (score === 3 && p.length >= 12 && /[^A-Za-z0-9]/.test(p)) score = 4
  if (passed < PASSWORD_CHECKS.length) score = Math.min(score, 1)
  return { score: Math.max(score, 1), label: ['', 'อ่อน', 'พอใช้', 'ดี', 'แข็งแรงมาก'][Math.max(score, 1)] }
}

export function validateRegistration(form) {
  const errors = {
    username: validateUsername(form.username),
    password: validatePassword(form.password),
    confirmPassword: validateConfirm(form.password, form.confirmPassword),
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}
