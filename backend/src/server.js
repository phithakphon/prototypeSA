import { loadConfig } from './config.js'
import { openDb } from './db.js'
import { migrate } from './migrate.js'
import { createApp } from './app.js'

const config = loadConfig()
const db = openDb(config.dbPath)
migrate(db)

createApp({ db, config }).listen(config.port, () => {
  console.log(`Backend พร้อมใช้งานที่ http://localhost:${config.port}`)
})
