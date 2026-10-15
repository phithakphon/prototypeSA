// The system serves one department only (same rule as frontend/src/mock/handlers.js).
// Records of other departments are invisible to every user, except the user's own employee record.
export const SUPPORTED_DEPARTMENT = 'ตรวจสอบบัญชี'

export const inScope = (employee, user) => employee.department === SUPPORTED_DEPARTMENT || employee.id === user?.employeeId
