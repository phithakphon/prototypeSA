import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createTestDb } from '../../backend/src/db.js'
import { migrate } from '../../backend/src/migrate.js'
import { seed } from '../../backend/src/seed.js'
import { createApp } from '../../backend/src/app.js'

// Isolated run: the real Express backend over an in-memory PostgreSQL (PGlite). Never touches a remote database.
const db = await createTestDb()
let server
try {
  await migrate(db)
  await seed(db)
  server = createApp({ db, config: { jwtSecret: randomUUID(), jwtExpiresIn: '1h' } }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vite.integration.config.js', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${server.address().port}`, VITE_USE_MOCK: 'false' },
  })
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  await db.close()
}
