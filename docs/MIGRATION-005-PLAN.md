# 🛡 แผนรัน Migration 005 (`performance_evaluations`) บน Supabase

> **สถานะ: รันบน Supabase แล้ว** (หลังได้รับอนุมัติ ตรวจเงื่อนไขครบ และสำรองข้อมูลแบบ logical backup) ผล: ตาราง `performance_evaluations` ถูกสร้างพร้อม RLS, `schema_migrations` บันทึก `005`, จำนวนแถวของตารางเดิมไม่เปลี่ยน เนื้อหาด้านล่างเก็บไว้เป็นบันทึกขั้นตอนและแผนย้อนกลับ ห้ามรันซ้ำ

## 1. ผลตรวจ SQL (`backend/src/migrations/005_performance_evaluations.sql`)

| หัวข้อ | ผลตรวจ |
|---|---|
| คำสั่งที่ใช้ | `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `REVOKE` (ใน `DO` block เฉพาะเมื่อมีบทบาท `anon`/`authenticated`) |
| คำสั่งทำลายข้อมูล | **ไม่มี** `DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, `ALTER` กับตารางเดิม |
| ตารางที่แตะ | สร้างตารางใหม่เพียง `performance_evaluations` (และ index `idx_evaluations_employee`) |
| ตารางเดิมที่อ้างถึง | เพียง foreign key `employee_id → employees(id)` และ `created_by → users(id)` (ชนิด `INTEGER` ตรงกับ `id` ของทั้งสองตาราง ตามที่นิยามใน `001_init.sql`) FK ไม่แก้ไขหรือล็อกแถวเดิม |
| การชนกับของเดิม | ใช้ `CREATE TABLE` (ไม่มี `IF NOT EXISTS`) โดยตั้งใจ: ถ้ามีตารางชื่อเดียวกันอยู่แล้ว migration จะ **ล้มและ rollback** ไม่เขียนทับ ไม่มีตาราง/index ชื่อนี้ใน migration 001–003 |
| Transaction | `migrate()` รันแต่ละไฟล์ใน transaction เดียวพร้อมบันทึก `schema_migrations` — ล้มแล้ว rollback ทั้งไฟล์ |
| ลำดับ | ชื่อไฟล์ `005` เรียงหลัง `003` (ไม่มี `004` บน PostgreSQL — `004` เดิมของ `main` เป็นไฟล์ SQLite ซึ่งลบแล้ว) ไม่ทำให้ลำดับสับสน |
| ความปลอดภัยของข้อมูล | เปิด RLS ไม่มี policy + revoke จาก `anon`/`authenticated` เหมือนทุกตาราง เข้าถึงผ่าน Express เท่านั้น |
| ล็อก | `CREATE TABLE` / `CREATE INDEX` บนตารางว่างใหม่ใช้เวลาเสี้ยววินาที ไม่ล็อกการอ่าน/เขียนตารางเดิมนาน (FK ต้องการล็อกแบบ `SHARE ROW EXCLUSIVE` ช่วงสั้น ๆ บน `employees`/`users`) |

### หลักฐานจากเทสต์ (ฐานข้อมูลทดสอบในหน่วยความจำ ไม่ใช่ Supabase)
- `backend/test/evaluations.test.js` › *migration 005 on a database that already holds data*: สร้างฐานข้อมูลตาม 001–003 ใส่ข้อมูลพนักงาน/บัญชี/เงินเดือน รัน 005 แล้วเทียบ ผล: แถวเดิมทั้งหมดเหมือนเดิมทุกคอลัมน์ ตารางที่เพิ่มคือ `performance_evaluations` ตารางเดียว
- ทดสอบว่ารันซ้ำไม่ทำอะไร, `CHECK` คะแนน 1–5 ทำงาน, RLS เปิด
- **ข้อจำกัด:** ยังไม่ได้ทดสอบกับ Supabase จริง (ความต่างของ Supabase เช่นบทบาท `anon`/`authenticated` ถูกครอบด้วย `DO` block ที่ตรวจว่ามีบทบาทก่อน)

## 2. แผนรัน (เมื่อได้รับอนุมัติ)

### ก่อนรัน
1. **สำรองข้อมูล** (ทำอย่างใดอย่างหนึ่งหรือทั้งคู่)
   - Supabase Dashboard → *Database → Backups*: ตรวจว่ามี backup ล่าสุด หรือสร้าง (ถ้าแผนรองรับ PITR ให้จดเวลา ณ ก่อนรัน)
   - `pg_dump` (Session pooler พอร์ต 5432): `pg_dump "$DATABASE_URL" --format=custom --no-owner -f backup-before-005.dump` เก็บนอก repo และห้าม commit
2. **บันทึกสภาพก่อนรัน** (อ่านอย่างเดียว):
   `SELECT COUNT(*) FROM employees; … users; … salaries; … employee_history; SELECT name FROM schema_migrations ORDER BY name;`
   ควรเห็น `001`, `002`, `003` เท่านั้น และยังไม่มี `performance_evaluations`
3. ตรวจ `DB_SSL=verify` และ CA ตาม `docs/DEPLOYMENT.md`
4. **Dry-run แบบอ่านอย่างเดียว:** `npm run seed:dry-run` ไม่เขียนข้อมูล ไม่ migrate (ใช้ตรวจการเชื่อมต่อ) หรือใช้คำสั่ง `pendingMigrations(db)` เพื่อยืนยันว่าค้างเพียง `005_performance_evaluations.sql`
5. ซ้อมบนโปรเจกต์ Supabase **ทดสอบ** ก่อน ถ้ามี
6. หยุดการเขียนข้อมูลช่วงสั้น ๆ (ไม่จำเป็นต้องหยุดระบบ เพราะไม่แตะตารางเดิม)

### รัน
```bash
cd backend
npm run migrate        # ต้องแสดง: migrate แล้ว: 005_performance_evaluations.sql
```

### หลังรัน (ตรวจ)
- จำนวนแถวใน `employees/users/salaries/employee_history` เท่าเดิม
- `SELECT relrowsecurity FROM pg_class WHERE relname='performance_evaluations'` เป็น `true`
- `schema_migrations` มี `005` เพิ่ม 1 แถว
- ทดสอบผ่านระบบ: ผู้จัดการบันทึก/ดูผลประเมิน, พนักงานดูได้เฉพาะของตน, HR/การเงิน/ผู้บริหาร ได้ 403
- **ห้ามรัน `seed` หรือ `seed:evaluations` กับฐานข้อมูลจริง** (ข้อมูลตัวอย่างเป็นข้อมูลสมมติ ถูกบล็อกโดยดีฟอลต์)

### ถ้ามีปัญหา (rollback)
ตารางใหม่ยังว่างและไม่มีตารางอื่นอ้างถึง จึงย้อนกลับได้โดยไม่กระทบข้อมูลเดิม:
```sql
BEGIN;
DROP TABLE performance_evaluations;
DELETE FROM schema_migrations WHERE name = '005_performance_evaluations.sql';
COMMIT;
```
> ใช้เฉพาะเมื่อตารางยังไม่มีข้อมูลจริงที่ต้องเก็บ และต้องได้รับอนุมัติก่อนรัน คำสั่งนี้ไม่ได้ถูกรันโดยโค้ดใด ๆ

ถ้าข้อมูลเสียหายจริง (ไม่คาดว่าจะเกิดขึ้น) ให้ restore จาก backup ในข้อ "ก่อนรัน"
