// Centralized role-based access control.
// Source of truth: the Use Case Diagram (UC-01 .. UC-06).

export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  HR: 'hr',
  FINANCE: 'finance',
  EXECUTIVE: 'executive',
}

export const ROLE_LABELS = {
  employee: 'พนักงาน',
  manager: 'ผู้จัดการแผนกตรวจสอบบัญชี',
  hr: 'ฝ่ายบุคคล',
  finance: 'ฝ่ายการเงิน',
  executive: 'ผู้บริหาร',
}

const ALL = Object.values(ROLES)

// Mirrors frontend/src/mock/rbac.js (the contract the UI is built against).
export const PERMISSIONS = {
  // UC-02 ค้นหาข้อมูลพนักงาน: ทุกบทบาทยกเว้นพนักงาน (พนักงานเห็นเฉพาะข้อมูลของตนเอง)
  'employee:search': ALL.filter((r) => r !== ROLES.EMPLOYEE),
  // UC-03 ดูประวัติและรายละเอียดพนักงาน (ข้อมูลทั่วไป + ประวัติ) — พนักงานถูกจำกัดด้วย employee:selfOnly
  'employee:view': ALL,
  // บทบาทที่เข้าถึงได้เฉพาะระเบียนของตนเอง (ทั้งรายละเอียด ประวัติ และเงินเดือน)
  'employee:selfOnly': [ROLES.EMPLOYEE],
  // ข้อมูลส่วนบุคคลที่เป็นความลับของ "ผู้อื่น" (ผู้ใช้ทุกคนดูของตนเองได้เสมอ ตรวจด้วยการเทียบ employee_id)
  'employee:viewConfidential': [ROLES.MANAGER, ROLES.HR, ROLES.EXECUTIVE],
  // UC-04 จัดการข้อมูลพนักงาน
  'employee:manage': [ROLES.MANAGER],
  // UC-06 จัดการพนักงานที่ลาออก (รวมการกลับเข้าทำงาน)
  'resignation:manage': [ROLES.MANAGER],
  // UC-05 จัดการเงินเดือน (ดู/เพิ่ม/แก้ไข ของทุกคน)
  'salary:manage': [ROLES.FINANCE],
  // ดูเงินเดือนของผู้อื่นแบบอ่านอย่างเดียว (ไม่เพิ่ม/แก้ไข)
  'salary:view': [ROLES.FINANCE, ROLES.HR],
}

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role))
}

export function can(role, permission) {
  return Boolean(PERMISSIONS[permission]?.includes(role))
}
