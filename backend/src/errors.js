export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}
export const badRequest = (m, d) => new HttpError(400, m, d)
export const unauthorized = (m = 'กรุณาเข้าสู่ระบบ') => new HttpError(401, m)
export const forbidden = (m = 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้') => new HttpError(403, m)
export const notFound = (m = 'ไม่พบข้อมูลที่ต้องการ') => new HttpError(404, m)
export const conflict = (m) => new HttpError(409, m)
