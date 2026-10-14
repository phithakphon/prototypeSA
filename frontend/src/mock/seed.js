// MOCK DATA ONLY — every person, number and account here is fictional.
// This file (with db.js / handlers.js) is the only place that knows about mock data,
// so it can be deleted when the real API is connected (see src/api.js).

export const DEMO_PASSWORD = 'Passw0rd!'

const AUDIT = 'ตรวจสอบบัญชี'
const HR = 'ฝ่ายบุคคล'
const FIN = 'ฝ่ายการเงิน'
const EXEC = 'ฝ่ายบริหาร'

// [code, first, last, department, position, startDate, salary, resignationDate, username, role]
const CORE = [
  ['E100', 'รัตนายุ', 'วงศ์สกุล', AUDIT, 'ผู้จัดการแผนกตรวจสอบบัญชี', '2018-03-01', 85000, null, 'manager1', 'manager'],
  ['E101', 'ประเสริฐ', 'ศรีสุข', AUDIT, 'เจ้าหน้าที่ธุรการ', '2026-07-01', 22000, null],
  ['E102', 'นภา', 'สว่างใจ', AUDIT, 'ผู้ตรวจสอบบัญชี', '2026-04-01', 38000, '2026-09-15'],
  ['E103', 'วิชัย', 'มั่นคง', AUDIT, 'ผู้ช่วยผู้ตรวจสอบบัญชี', '2026-08-18', 28000, null],
  ['E104', 'สมหญิง', 'รักงาน', AUDIT, 'ผู้ตรวจสอบบัญชี', '2026-09-01', 40000, null, 'employee1', 'employee'],
  ['E105', 'สมชาย', 'ใจดี', AUDIT, 'ผู้ตรวจสอบบัญชีอาวุโส', '2026-09-15', 55000, null],
  ['E201', 'กัญญา', 'บุญมา', HR, 'เจ้าหน้าที่ฝ่ายบุคคล', '2020-05-11', 35000, null, 'hr1', 'hr'],
  ['E202', 'อนุชา', 'ทองดี', HR, 'ผู้ช่วยฝ่ายบุคคล', '2022-01-17', 26000, null],
  ['E301', 'ธนากร', 'พิทักษ์ผล', FIN, 'เจ้าหน้าที่การเงิน', '2019-10-07', 42000, null, 'finance1', 'finance'],
  ['E302', 'มาลี', 'จันทร์เพ็ญ', FIN, 'นักบัญชี', '2021-06-21', 36000, null],
  ['E401', 'วีรพงษ์', 'เจริญสุข', EXEC, 'ผู้อำนวยการ', '2015-01-05', 150000, null, 'executive1', 'executive'],
  ['E303', 'สุดา', 'แก้วมณี', FIN, 'นักบัญชี', '2020-02-03', 34000, '2026-06-30'],
]

const FIRST = ['กิตติ', 'จันทร์จิรา', 'ณัฐพล', 'ดวงใจ', 'ปิยะ', 'พิมพ์ชนก', 'ภูริทัต', 'มณีรัตน์', 'รัชนี', 'วรากร', 'ศิริพร', 'สุชาติ', 'อรทัย']
const LAST = ['แสงทอง', 'เพชรรัตน์', 'บุญเรือง', 'ชัยมงคล', 'พงษ์พันธ์', 'สุขสวัสดิ์', 'ทองคำ', 'วัฒนา', 'อินทรา']
const DEPT_POSITIONS = [
  [AUDIT, ['ผู้ตรวจสอบบัญชี', 'ผู้ช่วยผู้ตรวจสอบบัญชี', 'ผู้ตรวจสอบบัญชีอาวุโส'], [40000, 28000, 55000]],
  [AUDIT, ['ผู้ตรวจสอบบัญชี', 'ผู้ช่วยผู้ตรวจสอบบัญชี', 'เจ้าหน้าที่ธุรการ'], [38000, 27000, 22000]],
  [FIN, ['นักบัญชี', 'เจ้าหน้าที่การเงิน'], [35000, 41000]],
  [HR, ['เจ้าหน้าที่ฝ่ายบุคคล', 'ผู้ช่วยฝ่ายบุคคล'], [34000, 25000]],
]
const GENERATED_COUNT = 27
const GENERATED_RESIGNED = { 5: '2026-05-20', 17: '2026-08-31' } // index -> resignation date

const pad = (n, w = 2) => String(n).padStart(w, '0')

function generated(i) {
  const [dept, positions, salaries] = DEPT_POSITIONS[i % DEPT_POSITIONS.length]
  const p = i % positions.length
  const year = 2022 + (i % 4)
  const month = 1 + ((i * 5) % 9)
  const start = `${year}-${pad(month)}-${pad(1 + ((i * 7) % 27))}`
  return [
    `E${106 + i}`, FIRST[i % FIRST.length], LAST[(i * 3) % LAST.length], dept, positions[p], start,
    salaries[p], GENERATED_RESIGNED[i] ?? null,
  ]
}

const ALL = [...CORE, ...Array.from({ length: GENERATED_COUNT }, (_, i) => generated(i))]

// Extra history so the profile timeline has something to show
const EXTRA_HISTORY = {
  E100: [['position_changed', 'เลื่อนตำแหน่งเป็น ผู้จัดการแผนกตรวจสอบบัญชี', '2021-04-01']],
  E302: [['position_changed', 'ปรับตำแหน่งเป็น นักบัญชี', '2023-01-01']],
  E201: [['updated', 'แก้ไขข้อมูลพนักงาน', '2024-02-15']],
}

export function buildSeed() {
  const users = []
  const employees = []
  const salaries = []
  const history = []
  let hid = 1
  let sid = 1

  ALL.forEach((row, idx) => {
    const [code, firstName, lastName, department, position, startDate, salary, resigned, username, role] = row
    const id = idx + 1
    employees.push({
      id,
      employeeCode: code,
      firstName,
      lastName,
      department,
      position,
      status: resigned ? 'resigned' : 'active',
      startDate,
      resignationDate: resigned,
      resignationReason: resigned ? 'ลาออกเพื่อไปศึกษาต่อ' : null,
      nationalId: `1${pad(id, 12)}`, // fictional
      phone: `08${pad(10000000 + id * 137, 8)}`,
      email: `${code.toLowerCase()}@example.test`,
      address: `${100 + id} ถนนตัวอย่าง กรุงเทพมหานคร`,
    })
    history.push({ id: hid++, employeeId: id, eventType: 'hired', description: `เริ่มงานในตำแหน่ง ${position} แผนก ${department}`, eventDate: startDate })
    for (const [t, d, date] of EXTRA_HISTORY[code] || []) history.push({ id: hid++, employeeId: id, eventType: t, description: d, eventDate: date })
    if (resigned) history.push({ id: hid++, employeeId: id, eventType: 'resigned', description: 'ลาออกจากองค์กร', eventDate: resigned })
    salaries.push({ id: sid++, employeeId: id, amount: salary, effectiveDate: startDate, note: 'เงินเดือนเริ่มต้น' })
    if (username) users.push({ id: users.length + 1, username, password: DEMO_PASSWORD, role, employeeId: id })
  })

  const announcements = [
    { id: 1, title: 'ประกาศวันหยุดประจำเดือนตุลาคม', publishedAt: '2026-10-10' },
    { id: 2, title: 'กำหนดการประเมินผลการปฏิบัติงานรอบปลายปี', publishedAt: '2026-10-03', important: true },
    { id: 3, title: 'อบรมมาตรฐานการตรวจสอบบัญชีฉบับใหม่', publishedAt: '2026-09-24' },
    { id: 4, title: 'แจ้งปรับปรุงระบบข้อมูลพนักงาน', publishedAt: '2026-09-12' },
  ]

  return { users, employees, salaries, history, announcements }
}

// Shown on the login page as one-click demo accounts
export const DEMO_ACCOUNTS = [
  { username: 'manager1', label: 'ผู้จัดการแผนกตรวจสอบบัญชี' },
  { username: 'hr1', label: 'ฝ่ายบุคคล' },
  { username: 'finance1', label: 'ฝ่ายการเงิน' },
  { username: 'executive1', label: 'ผู้บริหาร' },
  { username: 'employee1', label: 'พนักงาน' },
]
