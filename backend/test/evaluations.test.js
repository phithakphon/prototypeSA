import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import jwt from 'jsonwebtoken'
import { openDb } from '../src/db.js'
import { migrate } from '../src/migrate.js'
import { createApp } from '../src/app.js'
import { summarize } from '../../shared/evaluations.js'

test('rating thresholds are consistent', () => {
  for (const [scores, rating] of [[Array(6).fill(1), 'Requires Significant Improvement'], [Array(6).fill(2), 'Needs Improvement'], [Array(6).fill(3), 'Good'], [Array(6).fill(4), 'Very Good'], [[5,5,5,4,4,4], 'Excellent'], [Array(6).fill(5), 'Excellent']]) {
    assert.equal(summarize(scores).rating, rating)
    assert.equal(summarize(scores).totalScore, scores.reduce((a,b) => a+b))
  }
})

test('authenticated search, validation, employee isolation and persistent evaluation history', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-evaluation-'))
  let db = openDb(join(dir, 'test.db'))
  migrate(db)
  assert.deepEqual(migrate(db), [])
  db.exec(`INSERT INTO employees (employee_code,first_name,last_name,department,position,start_date) VALUES
    ('EMP001','Fictional','One','Audit','Auditor','2026-01-01'),('EMP002','Fictional','Two','Audit','Auditor','2026-01-01');
    INSERT INTO users (username,password_hash,role,employee_id) VALUES ('test-manager','unused','manager',1),('test-employee','unused','employee',2),('test-finance','unused','finance',NULL);`)
  const config = { jwtSecret: 'evaluation-test-secret' }
  let server
  let base
  const start = async () => {
    server = createApp({ db, config }).listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    base = `http://127.0.0.1:${server.address().port}/api/evaluations`
  }
  const call = async (path, id, body) => {
    const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(id ? { Authorization: `Bearer ${jwt.sign({}, config.jwtSecret, { subject: String(id) })}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: res.status, body: await res.json() }
  }
  const stop = () => new Promise(resolve => server.close(resolve))
  const payload = { employeeCode: 'EMP001', evaluationPeriod: '2026 Q3', evaluationDate: '2026-10-01', evaluatorName: 'Fictional Manager', scores: [5,4,5,4,5,4], deficiencies: 'Fictional testing record.', recommendations: 'Continue careful review.' }
  try {
    await start()
    assert.equal((await call('/employee?employeeCode=EMP001')).status, 401)
    assert.equal((await call('/employee?employeeCode=EMP', 1)).status, 404)
    assert.equal((await call('/employee?employeeCode=', 1)).status, 400)
    assert.equal((await call('/employee?employeeCode=emp001', 1)).body.employee.employeeCode, 'EMP001')
    assert.equal((await call('?employeeCode=EMP001', 2)).status, 403)
    assert.equal((await call('?employeeCode=EMP001', 3)).status, 403)
    assert.equal((await call('', 2, payload)).status, 403)
    for (const patch of [{ scores: [0,4,5,4,5,4] }, { scores: [1.5,4,5,4,5,4] }, { scores: [5] }, { evaluationDate: '2026-02-30' }, { evaluatorName: ' ' }, { employeeCode: 'UNKNOWN' }]) assert.ok((await call('', 1, { ...payload, ...patch })).status >= 400)
    const saved = await call('', 1, { ...payload, totalScore: 1, rating: 'wrong' })
    assert.equal(saved.status, 201)
    assert.equal(saved.body.evaluation.totalScore, 27)
    assert.equal(saved.body.evaluation.rating, 'Excellent')
    await call('', 1, { ...payload, evaluationDate: '2026-09-01' })
    assert.equal((await call('?employeeCode=EMP002', 2)).body.evaluations.length, 0)
    await stop(); db.close()
    db = openDb(join(dir, 'test.db')); migrate(db); await start()
    const history = (await call('?employeeCode=EMP001', 1)).body.evaluations
    assert.equal(history.length, 2)
    assert.equal(history[0].evaluationDate, '2026-10-01')
    assert.equal(history[0].recommendations, payload.recommendations)
    assert.equal(history.every(r => r.employeeId === 1), true)
  } finally { if (server) await stop(); db.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('fictional seed evaluations are additive, repeatable and survive database reopen', async () => {
  const { seed } = await import('../src/seed.js')
  const { seedDemoEvaluations } = await import('../src/demo-evaluation-seed.js')
  const { DEMO_EVALUATIONS } = await import('../../shared/demoEvaluations.js')
  const dir = mkdtempSync(join(tmpdir(), 'sa-demo-evaluations-'))
  const path = join(dir, 'demo.db')
  let db = openDb(path)
  try {
    migrate(db); seed(db)
    const employees = db.prepare('SELECT * FROM employees ORDER BY id').all()
    const records = db.prepare('SELECT * FROM performance_evaluations ORDER BY id').all()
    assert.equal(records.length, DEMO_EVALUATIONS.length)
    assert.equal(seedDemoEvaluations(db), 0)
    assert.deepEqual(db.prepare('SELECT * FROM employees ORDER BY id').all(), employees)
    assert.deepEqual(db.prepare('SELECT * FROM performance_evaluations ORDER BY id').all(), records)
    db.close(); db = openDb(path)
    for (const fixture of DEMO_EVALUATIONS) {
      const row = db.prepare(`SELECT v.*, e.employee_code FROM performance_evaluations v JOIN employees e ON e.id = v.employee_id
        WHERE e.employee_code = ? AND v.evaluation_period = ?`).get(fixture.employeeCode, fixture.evaluationPeriod)
      assert.ok(row)
      assert.equal(row.employee_code, fixture.employeeCode)
      assert.deepEqual(Array.from({ length: 6 }, (_, i) => row[`score_${i + 1}`]), fixture.scores)
      assert.equal(row.deficiencies, fixture.deficiencies)
      assert.equal(row.recommendations, fixture.recommendations)
    }
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM performance_evaluations v JOIN employees e ON e.id = v.employee_id WHERE e.employee_code = 'E100'").get().n, 2)
    // Identity guard fails before any writes if the database does not match the demo fixture.
    db.prepare("UPDATE employees SET first_name = 'Different test identity' WHERE employee_code = 'E100'").run()
    assert.throws(() => seedDemoEvaluations(db), /ไม่ตรงกับพนักงานสมมติ/)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM performance_evaluations').get().n, 7)
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }) }
})
