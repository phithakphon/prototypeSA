export const CRITERIA = [
  'คุณภาพและความเรียบร้อยของงาน',
  'ความรับผิดชอบต่องานที่ได้รับมอบหมาย',
  'การส่งงานตรงตามกำหนดเวลา',
  'ความละเอียดรอบคอบและความถูกต้องของเอกสาร',
  'การปฏิบัติตามระเบียบและขั้นตอนการทำงาน',
  'การทำงานร่วมกับผู้อื่น',
]
export const SCALE = ['ต้องปรับปรุงเร่งด่วน', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีเยี่ยม']
export const RATING_LABELS = { Excellent: 'ดีเยี่ยม', 'Very Good': 'ดีมาก', Good: 'ดี', 'Needs Improvement': 'ต้องปรับปรุง', 'Requires Significant Improvement': 'ต้องปรับปรุงเร่งด่วน' }
export function summarize(scores) {
  const totalScore = scores.reduce((sum, score) => sum + score, 0)
  const rating = totalScore >= 27 ? 'Excellent' : totalScore >= 24 ? 'Very Good' : totalScore >= 18 ? 'Good' : totalScore >= 12 ? 'Needs Improvement' : 'Requires Significant Improvement'
  return { totalScore, rating }
}
export function evaluationErrors(body = {}) {
  const errors = {}
  for (const key of ['evaluationPeriod', 'evaluatorName']) {
    if (typeof body[key] !== 'string' || !body[key].trim() || body[key].length > 200) errors[key] = 'กรุณากรอกข้อมูล ไม่เกิน 200 ตัวอักษร'
  }
  const date = body.evaluationDate
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) errors.evaluationDate = 'กรุณาระบุวันที่ประเมินให้ถูกต้อง'
  if (!Array.isArray(body.scores) || body.scores.length !== 6 || body.scores.some(s => !Number.isInteger(s) || s < 1 || s > 5)) errors.scores = 'กรุณาเลือกคะแนนจำนวนเต็มตั้งแต่ 1 ถึง 5 ให้ครบทุกเกณฑ์'
  for (const key of ['deficiencies', 'recommendations']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > 5000)) errors[key] = 'กรอกข้อมูลได้ไม่เกิน 5,000 ตัวอักษร'
  }
  return errors
}
