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
  'evaluation:view': ['employee', 'manager'],
  'evaluation:manage': ['manager'],
  // Employees may NOT search; they only see their own record (see employee:selfOnly).
  'employee:search': ALL.filter((role) => role !== 'employee'),
  'employee:view': ALL,
  // Marks roles that are limited to their own employee record (history/details).
  'employee:selfOnly': ['employee'],
  // personal information of others: manager (manages records), HR and executive (read-only)
  'employee:viewConfidential': ['manager', 'hr', 'executive'],
  'employee:manage': ['manager'],
  'resignation:manage': ['manager'],
  'salary:manage': ['finance'],
  // read-only view of every employee's salary (no add / edit)
  'salary:view': ['finance', 'hr'],
  // verify a self-registered account and link it to an employee record (never changes the account role)
  'account:link': ['hr'],
}

export const permissionsFor = (role) => Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role))
export const can = (role, permission) => Boolean(PERMISSIONS[permission]?.includes(role))
