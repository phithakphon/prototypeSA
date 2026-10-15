// PostgreSQL access layer. Every database (pg Pool in production, PGlite in tests) exposes the same interface:
//   db.query(sql, params) -> { rows, rowCount }     parameterized only ($1, $2 ...)
//   db.exec(sql)                                   multi-statement script (migrations)
//   db.transaction(async (tx) => ...)              tx has query/exec; commits, or rolls back on error
//   db.close()
import { readFileSync } from 'node:fs'
import pg from 'pg'

// Keep the JSON contract of the old SQLite backend: DATE as 'YYYY-MM-DD' string, NUMERIC/bigint as number.
const OID = { INT8: 20, DATE: 1082, NUMERIC: 1700 }
export const PARSERS = {
  [OID.INT8]: (v) => Number(v),
  [OID.DATE]: (v) => v,
  [OID.NUMERIC]: (v) => Number.parseFloat(v),
}

const types = {
  getTypeParser: (oid, format) => PARSERS[oid] ?? pg.types.getTypeParser(oid, format),
}

function sslOption(config) {
  if (config.dbSsl === 'disable') return false
  if (config.dbSsl === 'verify') {
    const ca = config.dbSslCaPem || (config.dbSslCa ? readFileSync(config.dbSslCa, 'utf8') : null)
    return { rejectUnauthorized: true, ...(ca ? { ca } : {}) }
  }
  return { rejectUnauthorized: false }
}

export function createDb(config) {
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: sslOption(config),
    max: config.dbPoolMax,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    types,
  })
  // An idle client dropping must not crash the process; the pool replaces it on next use.
  pool.on('error', (err) => console.error('Database pool error:', err.code || err.message))

  const wrap = (runner) => ({
    query: async (sql, params = []) => {
      const r = await runner.query(sql, params)
      return { rows: r.rows, rowCount: r.rowCount }
    },
    exec: async (sql) => {
      await runner.query(sql)
    },
  })

  return {
    ...wrap(pool),
    async transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(wrap(client))
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

// In-process PostgreSQL (WASM) for tests: real PostgreSQL semantics, no network, nothing remote touched.
export async function createTestDb() {
  const { PGlite } = await import('@electric-sql/pglite')
  const lite = await PGlite.create({ parsers: PARSERS })
  const wrap = (runner) => ({
    query: async (sql, params = []) => {
      const r = await runner.query(sql, params)
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }
    },
    exec: async (sql) => {
      await runner.exec(sql)
    },
  })
  return {
    ...wrap(lite),
    transaction: (fn) => lite.transaction((tx) => fn(wrap(tx))),
    close: () => lite.close(),
  }
}

// Errors that mean "database unreachable" (as opposed to a bug or bad data).
const UNAVAILABLE = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P03', '53300', '08000', '08003', '08006'])
export const isDbUnavailable = (err) =>
  UNAVAILABLE.has(err?.code) || /timeout exceeded when trying to connect|Connection terminated/i.test(err?.message || '')
