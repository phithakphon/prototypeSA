import { buildSeed } from './seed'

// In-memory mock database. CRUD from the UI mutates this object, so changes last until the page is reloaded.
export const db = buildSeed()

export function resetDb() {
  const fresh = buildSeed()
  for (const key of Object.keys(fresh)) db[key] = fresh[key]
}

export const nextId = (table) => db[table].reduce((m, r) => Math.max(m, r.id), 0) + 1
