// Dates from the API are 'YYYY-MM-DD'. Display them as Thai Buddhist-era dates.
export function formatDate(value) {
  if (!value) return '-'
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const formatMoney = (n) =>
  typeof n === 'number'
    ? n.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })
    : '-'

export const todayIso = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The system is built for this one department only.
export const DEPARTMENT = 'ตรวจสอบบัญชี'

export const fullName = (e) => `${e.firstName} ${e.lastName}`

export const STATUS = {
  active: { label: 'ปฏิบัติงาน', cls: 'badge-green' },
  resigned: { label: 'ลาออก', cls: 'badge-red' },
}
