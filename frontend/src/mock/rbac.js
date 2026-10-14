// DEMO ONLY: simulated role permissions for the mock layer. This is NOT security —
// anything that runs in the browser can be bypassed. Real enforcement belongs on the server.
// Mirrors backend/src/rbac.js so the UI behaves the same once the real API is connected.

export const ROLE_LABELS = {
  employee: 'พนักงาน',
  manager: 'ผู้จัดการแผนกตรวจสอบบัญชี',
  hr: 'ฝ่ายบุคคล',
  finance: 'ฝ่ายการเงิน',
  executive: 'ผู้บริหาร',
}

const ALL = Object.keys(ROLE_LABELS)

export const PERMISSIONS = {
  'employee:search': ALL,
  'employee:view': ALL,
  'employee:viewConfidential': ['manager'],
  'employee:manage': ['manager'],
  'resignation:manage': ['manager'],
  'salary:manage': ['finance'],
}

export const permissionsFor = (role) => Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role))
export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role))
