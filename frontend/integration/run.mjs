import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { openDb } from '../../backend/src/db.js'
import { migrate } from '../../backend/src/migrate.js'
import { seed } from '../../backend/src/seed.js'
import { createApp } from '../../backend/src/app.js'

if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required; use a development PostgreSQL database')
const schema = 'test_' + randomUUID().replaceAll('-', '')
const admin = openDb(process.env.TEST_DATABASE_URL)
let db
let server
try {
  await admin.query(`CREATE SCHEMA ${schema}`)
  db = openDb(process.env.TEST_DATABASE_URL, { options: `-c search_path=${schema}` })
  await migrate(db)
  await seed(db)
  server = createApp({ db, config: { jwtSecret: randomUUID(), jwtExpiresIn: '1h' } }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vite.integration.config.js'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${server.address().port}`, VITE_USE_MOCK: 'false' },
  })
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  await db?.close()
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
  await admin.close()
}
