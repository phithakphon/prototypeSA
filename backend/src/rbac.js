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

export const PERMISSIONS = {
  // UC-02 ค้นหาข้อมูลพนักงาน
  'employee:search': ALL,
  // UC-03 ดูประวัติและรายละเอียดพนักงาน (ข้อมูลทั่วไป + ประวัติ)
  'employee:view': ALL,
  // UC-03 ข้อมูลส่วนบุคคลที่เป็นความลับของ "ผู้อื่น": เฉพาะผู้จัดการ (ผู้ดูแลข้อมูลตาม UC-04)
  // ผู้ใช้ทุกคนดูข้อมูลความลับ/เงินเดือนของ "ตนเอง" ได้เสมอ (ตรวจด้วยการเทียบ employee_id)
  'employee:viewConfidential': ['manager'],
  // UC-04 จัดการข้อมูลพนักงาน
  'employee:manage': ['manager'],
  // UC-06 จัดการพนักงานที่ลาออก
  'resignation:manage': ['manager'],
  // UC-05 จัดการเงินเดือน (ดู/เพิ่ม/แก้ไข ของทุกคน)
  'salary:manage': ['finance'],
}

export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => PERMISSIONS[p].includes(role))
}

export function can(role, permission) {
  return Boolean(PERMISSIONS[permission]?.includes(role))
}
