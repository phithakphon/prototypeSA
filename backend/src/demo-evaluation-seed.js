import { DEMO_EVALUATIONS } from '../../shared/demoEvaluations.js'
import { transaction } from './db.js'

// Call only from the fictional development seed or an explicitly chosen demo database.
// Validate all identities before any insert; never create or modify employees here.
export function seedDemoEvaluations(db) {
  const employees = new Map()
  for (const fixture of DEMO_EVALUATIONS) {
    const row = db.prepare('SELECT * FROM employees WHERE employee_code = ?').get(fixture.employeeCode)
    if (!row || row.first_name !== fixture.firstName || row.last_name !== fixture.lastName || row.department !== 'ตรวจสอบบัญชี') {
      throw new Error(`ไม่เพิ่มข้อมูลตัวอย่าง: ${fixture.employeeCode} ไม่ตรงกับพนักงานสมมติของระบบ`)
    }
    employees.set(fixture.employeeCode, row.id)
  }
  const manager = db.prepare("SELECT id FROM users WHERE username = 'manager1' AND role = 'manager' AND employee_id = ?").get(employees.get('E100'))
  if (!manager) throw new Error('ไม่พบบัญชีผู้จัดการสมมติสำหรับข้อมูลตัวอย่าง')
  return transaction(db, () => {
    let inserted = 0
    for (const fixture of DEMO_EVALUATIONS) {
      const employeeId = employees.get(fixture.employeeCode)
      // Additive and repeatable: keep every existing record, including edited sample records.
      if (db.prepare('SELECT id FROM performance_evaluations WHERE employee_id = ? AND evaluation_period = ? AND evaluation_date = ? AND evaluator_name = ?')
        .get(employeeId, fixture.evaluationPeriod, fixture.evaluationDate, fixture.evaluatorName)) continue
      db.prepare(`INSERT INTO performance_evaluations (employee_id, evaluation_period, evaluation_date, evaluator_name,
        score_1, score_2, score_3, score_4, score_5, score_6, deficiencies, recommendations, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(employeeId, fixture.evaluationPeriod, fixture.evaluationDate, fixture.evaluatorName, ...fixture.scores, fixture.deficiencies, fixture.recommendations, manager.id)
      inserted++
    }
    return inserted
  })
}
