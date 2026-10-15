import { test } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { createTestDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { createApp } from '../src/app.js'
import { seed } from '../src/seed.js'
import { seedDemoEvaluations } from '../src/demo-evaluation-seed.js'
import { DEMO_EVALUATIONS } from '../../shared/demoEvaluations.js'
import { summarize } from '../../shared/evaluations.js'

test('rating thresholds are consistent', () => {
  for (const [scores, rating] of [[Array(6).fill(1), 'Requires Significant Improvement'], [Array(6).fill(2), 'Needs Improvement'], [Array(6).fill(3), 'Good'], [Array(6).fill(4), 'Very Good'], [[5, 5, 5, 4, 4, 4], 'Excellent'], [Array(6).fill(5), 'Excellent']]) {
    assert.equal(summarize(scores).rating, rating)
    assert.equal(summarize(scores).totalScore, scores.reduce((a, b) => a + b))
  }
})

test('migration 005 creates the evaluation table once, with score checks, and is idempotent', async () => {
  const db = await createTestDb()
  try {
    const applied = await migrate(db)
    assert.ok(applied.includes('005_performance_evaluations.sql'))
    assert.deepEqual(await migrate(db), [])
    const rls = (await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'performance_evaluations'")).rows[0]
    assert.equal(rls.relrowsecurity, true)
    await db.exec("INSERT INTO employees (employee_code, first_name, last_name, department, position, start_date) VALUES ('X1','a','b','d','p','2026-01-01')")
    await db.exec("INSERT INTO users (username, password_hash, role) VALUES ('u','x','manager')")
    const insert = (s1) => db.query(
      `INSERT INTO performance_evaluations (employee_id, evaluation_period, evaluation_date, evaluator_name, score_1, score_2, score_3, score_4, score_5, score_6, created_by)
       VALUES (1, 'p', '2026-01-01', 'e', $1, 3, 3, 3, 3, 3, 1)`, [s1])
    await insert(5)
    await assert.rejects(insert(6))
    await assert.rejects(insert(0))
  } finally { await db.close() }
})

test('authenticated search, validation, RBAC, department scope and persistent evaluation history', async () => {
  const db = await createTestDb()
  await migrate(db)
  await db.exec(`INSERT INTO employees (employee_code,first_name,last_name,department,position,start_date) VALUES
    ('EMP001','Fictional','One','ตรวจสอบบัญชี','Auditor','2026-01-01'),
    ('EMP002','Fictional','Two','ตรวจสอบบัญชี','Auditor','2026-01-01'),
    ('EMP003','Fictional','Three','ฝ่ายการเงิน','Accountant','2026-01-01');
    INSERT INTO users (username,password_hash,role,employee_id) VALUES
    ('test-manager','unused','manager',1),('test-employee','unused','employee',2),('test-finance','unused','finance',NULL),
    ('test-hr','unused','hr',NULL),('test-exec','unused','executive',NULL),('test-outsider','unused','employee',3);`)
  const config = { jwtSecret: 'evaluation-test-secret', jwtExpiresIn: '1h' }
  let server
  let base
  const start = async () => {
    server = createApp({ db, config }).listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}/api/evaluations`
  }
  const stop = () => new Promise((resolve) => server.close(resolve))
  const call = async (path, id, body) => {
    const headers = { 'Content-Type': 'application/json', ...(id ? { Authorization: `Bearer ${jwt.sign({}, config.jwtSecret, { subject: String(id) })}` } : {}) }
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, body: await res.json() }
  }
  const [MANAGER, EMPLOYEE, FINANCE, HR, EXEC, OUTSIDER] = [1, 2, 3, 4, 5, 6]
  const payload = { employeeCode: 'EMP001', evaluationPeriod: '2026 Q3', evaluationDate: '2026-10-01', evaluatorName: 'Fictional Manager', scores: [5, 4, 5, 4, 5, 4], deficiencies: 'Fictional testing record.', recommendations: 'Continue careful review.' }
  try {
    await start()
    assert.equal((await call('/employee?employeeCode=EMP001')).status, 401)
    assert.equal((await call('/employee?employeeCode=EMP', MANAGER)).status, 404)
    assert.equal((await call('/employee?employeeCode=', MANAGER)).status, 400)
    assert.equal((await call('/employee?employeeCode=emp001', MANAGER)).body.employee.employeeCode, 'EMP001')
    // Permissions: employees only see their own, other roles have no evaluation access
    assert.equal((await call('?employeeCode=EMP001', EMPLOYEE)).status, 403)
    assert.equal((await call('?employeeCode=EMP002', EMPLOYEE)).status, 200)
    for (const id of [FINANCE, HR, EXEC]) assert.equal((await call('?employeeCode=EMP001', id)).status, 403)
    assert.equal((await call('', EMPLOYEE, payload)).status, 403)
    assert.equal((await call('', HR, payload)).status, 403)
    // Department scope: another department is invisible to everyone but the person themself
    assert.equal((await call('?employeeCode=EMP003', MANAGER)).status, 404)
    assert.equal((await call('', MANAGER, { ...payload, employeeCode: 'EMP003' })).status, 404)
    assert.equal((await call('?employeeCode=EMP003', EMPLOYEE)).status, 404)
    assert.equal((await call('?employeeCode=EMP003', OUTSIDER)).status, 200)
    for (const patch of [{ scores: [0, 4, 5, 4, 5, 4] }, { scores: [1.5, 4, 5, 4, 5, 4] }, { scores: [5] }, { evaluationDate: '2026-02-30' }, { evaluatorName: ' ' }, { employeeCode: 'UNKNOWN' }]) {
      assert.ok((await call('', MANAGER, { ...payload, ...patch })).status >= 400)
    }
    const saved = await call('', MANAGER, { ...payload, totalScore: 1, rating: 'wrong' })
    assert.equal(saved.status, 201)
    assert.equal(saved.body.evaluation.totalScore, 27)
    assert.equal(saved.body.evaluation.rating, 'Excellent')
    assert.equal(saved.body.evaluation.evaluationDate, '2026-10-01')
    await call('', MANAGER, { ...payload, evaluationDate: '2026-09-01' })
    assert.equal((await call('?employeeCode=EMP002', EMPLOYEE)).body.evaluations.length, 0)
    // Persistence: a new app instance over the same database sees the saved history
    await stop()
    await start()
    const history = (await call('?employeeCode=EMP001', MANAGER)).body.evaluations
    assert.equal(history.length, 2)
    assert.equal(history[0].evaluationDate, '2026-10-01')
    assert.equal(history[0].recommendations, payload.recommendations)
    assert.equal(history.every((r) => r.employeeId === 1), true)
  } finally {
    if (server) await stop()
    await db.close()
  }
})

test('fictional seed evaluations are additive, repeatable and guarded by identity checks', async () => {
  const db = await createTestDb()
  try {
    await migrate(db)
    await seed(db)
    const employees = (await db.query('SELECT * FROM employees ORDER BY id')).rows
    const records = (await db.query('SELECT * FROM performance_evaluations ORDER BY id')).rows
    assert.equal(records.length, DEMO_EVALUATIONS.length)
    assert.equal(await seedDemoEvaluations(db), 0)
    assert.deepEqual((await db.query('SELECT * FROM employees ORDER BY id')).rows, employees)
    assert.deepEqual((await db.query('SELECT * FROM performance_evaluations ORDER BY id')).rows, records)
    for (const fixture of DEMO_EVALUATIONS) {
      const row = (await db.query(
        `SELECT v.*, e.employee_code FROM performance_evaluations v JOIN employees e ON e.id = v.employee_id
         WHERE e.employee_code = $1 AND v.evaluation_period = $2`, [fixture.employeeCode, fixture.evaluationPeriod])).rows[0]
      assert.ok(row)
      assert.deepEqual(Array.from({ length: 6 }, (_, i) => row[`score_${i + 1}`]), fixture.scores)
      assert.equal(row.deficiencies, fixture.deficiencies)
      assert.equal(row.recommendations, fixture.recommendations)
    }
    // Identity guard fails before any writes if the database does not match the demo fixture.
    await db.query("UPDATE employees SET first_name = 'Different test identity' WHERE employee_code = 'E100'")
    await assert.rejects(seedDemoEvaluations(db), /ไม่ตรงกับพนักงานสมมติ/)
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM performance_evaluations')).rows[0].n, DEMO_EVALUATIONS.length)
  } finally { await db.close() }
})
