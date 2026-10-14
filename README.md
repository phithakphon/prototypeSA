# prototypeSA — ระบบบริหารจัดการข้อมูลพนักงาน (แผนกตรวจสอบบัญชี)

Employee Management System สำหรับแผนกตรวจสอบบัญชี — โปรเจกต์วิชา Software Engineering

## โครงสร้างโปรเจกต์

```
prototypeSA/
├── frontend/          React 19 + Vite 8 (ทำเสร็จแล้ว ใช้ข้อมูลจำลองหรือต่อ backend ได้)
│   └── src/
│       ├── mock/      ชั้นข้อมูลจำลอง (seed, db, rbac, validate, handlers) — แทน API ชั่วคราว
│       ├── api.js     จุดเดียวที่เรียก API (สลับ mock / backend จริงที่นี่)
│       ├── auth/      AuthProvider, RequireAuth (route guard)
│       ├── components/  AppLayout, Sidebar, Modal, ConfirmDialog, Toast, EmployeeFinder ...
│       ├── pages/     Dashboard, EmployeeDetail, EmployeeManage, ResignedEmployees, SalaryManage
│       └── test/      เทสต์ flow ของ UI (Vitest + Testing Library)
└── backend/           Node.js + Express + SQLite (node:sqlite) + JWT + bcrypt
    ├── src/           app, routes, rbac, validate, migrations, seed
    └── test/          เทสต์ API (node:test)
```

## เริ่มใช้งาน

ต้องใช้ Node.js >= 22.13 (backend ใช้ `node:sqlite`)

### Frontend (โหมด mock — ไม่ต้องเปิด backend)

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

เข้าหน้า Login แล้วกดเลือกบัญชีทดลอง (รหัสผ่านทุกบัญชี `Passw0rd!`)

| ชื่อผู้ใช้ | บทบาท |
|---|---|
| `manager1` | ผู้จัดการแผนกตรวจสอบบัญชี |
| `hr1` | ฝ่ายบุคคล |
| `finance1` | ฝ่ายการเงิน |
| `executive1` | ผู้บริหาร |
| `employee1` | พนักงาน (สมหญิง รักงาน, E104) |

### Backend

```bash
cd backend
npm install
cp .env.example .env     # แล้วตั้งค่า JWT_SECRET (วิธีสร้างค่าอยู่ในไฟล์ .env.example)
npm run migrate          # สร้างตาราง
npm run seed             # ข้อมูลทดสอบ + บัญชีทดสอบชุดเดียวกับด้านบน (ห้ามใช้ใน production)
npm start                # http://localhost:3001  (หรือ npm run dev เพื่อ watch)
```

### คำสั่ง npm

| ที่ | คำสั่ง | หน้าที่ |
|---|---|---|
| frontend | `npm run dev` / `build` / `preview` | รัน / build / ดูผล build |
| frontend | `npm run lint` | oxlint |
| frontend | `npm test` | Vitest (28 เทสต์: mock API + UI flow) |
| backend | `npm start` / `npm run dev` | รันเซิร์ฟเวอร์ |
| backend | `npm run migrate` / `npm run seed` | migration / ข้อมูลทดสอบ |
| backend | `npm test` | เทสต์ API 14 รายการ (ใช้ DB ในหน่วยความจำ ไม่แตะไฟล์ DB จริง) |

## สลับระหว่าง Mock กับ API จริง

ค่าเริ่มต้นของ frontend คือ **mock** (`USE_MOCK` ใน `frontend/src/api.js`)

- ใช้ backend จริง: สร้าง `frontend/.env.local` ใส่ `VITE_USE_MOCK=false` แล้วรัน backend ที่พอร์ต 3001 — Vite จะ proxy `/api` ไปที่ `http://localhost:3001` (ตั้งใน `vite.config.js`)
- กลับไปใช้ mock: ลบบรรทัดนั้น หรือตั้งเป็น `true`
- ข้อมูล mock อยู่ในหน่วยความจำ รีเซ็ตเมื่อรีเฟรชหน้า การจำกัดสิทธิ์ใน mock เป็นการสาธิตเท่านั้น ไม่ใช่ความปลอดภัยจริง
- `src/mock/handlers.js` เลียนแบบ path และรูปแบบ JSON ของ backend จึงใช้เป็นสัญญา (contract) อ้างอิงได้

## Use Case ที่ทำแล้ว (ทั้งฝั่ง frontend และ backend)

| UC | ฟังก์ชัน | หน้าเว็บ |
|---|---|---|
| UC-01 | เข้าสู่ระบบ | `/login` |
| UC-02 | ค้นหาพนักงาน (รหัส/ชื่อ/แผนก + ตัวกรอง) | `/employees/search` |
| UC-03 | ดูประวัติและรายละเอียดพนักงาน | `/employees/history`, `/employees/:id` |
| UC-04 | จัดการข้อมูลพนักงาน (เพิ่ม/แก้ไข) | `/employees` |
| UC-05 | จัดการเงินเดือน | `/salaries` |
| UC-06 | จัดการพนักงานที่ลาออก | `/resigned` (แจ้งลาออกที่ `/employees`) |

หน้าอื่น: `/dashboard` (หน้าหลัก) และ `/evaluations` (Employee Performance Evaluation — ค้นหารหัสพนักงานและดู/เพิ่มผลการประเมิน)

## สิทธิ์ (RBAC) — กำหนดที่ `backend/src/rbac.js` (และ `frontend/src/mock/rbac.js` สำหรับ mock)

| Use Case | สิทธิ์ | บทบาท |
|---|---|---|
| UC-01 | — | ทุกบทบาท |
| UC-02 | `employee:search` | ทุกบทบาท |
| UC-03 | `employee:view` | ทุกบทบาท (ข้อมูลทั่วไป + ประวัติ) |
| UC-03 (ข้อมูลลับ) | `employee:viewConfidential` | ผู้จัดการ และเจ้าของข้อมูลเอง |
| UC-04 | `employee:manage` | ผู้จัดการ |
| UC-06 | `resignation:manage` | ผู้จัดการ |
| UC-05 | `salary:manage` | ฝ่ายการเงิน (เจ้าของดูเงินเดือนตัวเองได้แบบอ่านอย่างเดียว) |

ข้อกำหนดเหล่านี้อ้างอิง Use Case Diagram ของโปรเจกต์ จุดที่ไดอะแกรมไม่ชัดเจนและทีมเลือกตีความไว้: เจ้าของข้อมูลดูเงินเดือนตนเองได้, ผู้จัดการดูข้อมูลส่วนบุคคลของทุกคนได้ (ต้องใช้แก้ไขตาม UC-04)

## Backend API ที่มีอยู่

ทุกเส้นทางยกเว้น login ต้องส่ง `Authorization: Bearer <token>`

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/auth/login` | สาธารณะ (จำกัดการลองผิด 5 ครั้ง/15 นาที) |
| GET | `/api/auth/me` | ผู้ใช้ที่เข้าสู่ระบบ |
| GET | `/api/dashboard/summary` | ผู้ใช้ที่เข้าสู่ระบบ |
| GET | `/api/employees?q=&department=&status=` | `employee:search` |
| GET | `/api/employees/departments` | `employee:search` |
| GET | `/api/employees/resigned` | `resignation:manage` |
| GET | `/api/employees/:id` | `employee:view` (+ฟิลด์ลับตามสิทธิ์) |
| POST | `/api/employees` | `employee:manage` |
| PUT | `/api/employees/:id` | `employee:manage` |
| POST | `/api/employees/:id/resign` | `resignation:manage` |
| GET | `/api/salaries` | `salary:manage` |
| GET | `/api/employees/:id/salaries` | `salary:manage` หรือเจ้าของข้อมูล |
| POST | `/api/employees/:id/salaries` | `salary:manage` |
| PUT | `/api/salaries/:id` | `salary:manage` |

ฐานข้อมูล SQLite (`backend/src/migrations/001_init.sql`): `employees`, `users`, `salaries`, `employee_history`, `announcements`, `schema_migrations`

## ข้อจำกัดที่ทราบ

- Frontend มีปุ่ม **"กลับเข้าทำงาน"** (UC-06) และเรียก `POST /api/employees/:id/reinstate` ซึ่ง **backend ยังไม่มี endpoint นี้** (มีเฉพาะใน mock) — ถ้าใช้ API จริงปุ่มนี้จะได้ 404 จนกว่าจะเพิ่มฝั่ง backend
- Frontend ยังไม่เคยทดสอบแบบ end-to-end กับ backend จริง (`VITE_USE_MOCK=false`) — เป็นงานแรกที่ควรตรวจ
- JWT เก็บใน `localStorage` (พอสำหรับงานเรียน; production ควรใช้ cookie แบบ httpOnly)
- ไม่มีหน้าจัดการบัญชีผู้ใช้ — บัญชีทั้งหมดมาจาก `npm run seed`
- `announcements` มีแต่ endpoint อ่าน (ผ่าน dashboard) ยังไม่มีการเพิ่ม/แก้ไขประกาศ
- ฟอนต์ Kanit โหลดจาก Google Fonts ต้องมีอินเทอร์เน็ต
- `node:sqlite` ยังเป็น experimental (จะมีข้อความเตือนตอนรัน)

## ขั้นตอนแนะนำสำหรับพัฒนา backend ต่อ

1. ตั้ง `VITE_USE_MOCK=false` แล้วไล่ทดสอบทุกหน้ากับ backend จริง แก้จุดที่รูปแบบข้อมูลไม่ตรงกัน
2. เพิ่ม endpoint `POST /api/employees/:id/reinstate` (สิทธิ์ `resignation:manage`, บันทึก history `reinstated`) หรือเอาปุ่มออกจาก frontend
3. เพิ่มการจัดการประกาศ/ข่าวสาร และ (ถ้าต้องการ) การจัดการผู้ใช้
4. พิจารณาย้าย token ไป httpOnly cookie, เพิ่ม audit log สำหรับการแก้ไขเงินเดือน
5. เพิ่ม integration test ระหว่าง frontend–backend

## สำหรับเพื่อนร่วมทีม: เริ่มพัฒนา backend

```bash
git clone https://github.com/phithakphon/prototypeSA.git
cd prototypeSA
git fetch origin
git checkout feature/dashboard-home        # รับงานล่าสุดจากสาขานี้
git checkout -b feature/backend-development
# ... พัฒนา, commit ...
git push -u origin feature/backend-development
```

อย่า push ตรงเข้า `main` — เปิด Pull Request จาก `feature/backend-development` แทน

> ไฟล์ `.env` ไม่ถูกเก็บใน Git ให้คัดลอกจาก `backend/.env.example` แล้วสร้าง `JWT_SECRET` ของตัวเอง


### Employee Performance Evaluation

`/evaluations` uses the existing layout and employee records. Managers can search,
view history and create evaluations; employees may search and view only their own
records. Other roles cannot access evaluation records. These permissions are enforced
by Express, including direct API requests. No edit/delete endpoint is provided.

API (authenticated bearer token):
- `GET /api/evaluations/employee?employeeCode=E104`: exact, case-insensitive ID lookup.
- `GET /api/evaluations?employeeCode=E104`: employee and evaluation history, newest first.
- `POST /api/evaluations`: `employeeCode`, `evaluationPeriod`, `evaluationDate`,
  `evaluatorName`, six integer `scores` (1–5), optional `deficiencies` and `recommendations`.
  Returns the saved `evaluation` with server-calculated total and rating (HTTP 201).

The active backend is SQLite (`backend/src/db.js`). Migration 005 adds
`performance_evaluations` with employee/user foreign keys and score constraints.
The SQLite migration runner now uses compatible versions of existing PostgreSQL-only
migrations 003/004 from `backend/src/migrations/sqlite`; original SQL files are preserved.
PostgreSQL/Supabase helper files already present in this workspace are not connected
to the active server; this feature does not claim a Supabase deployment.

To use persistent records, set `VITE_USE_MOCK=false` in `frontend/.env`, configure
`backend/.env` with the existing database path and a private JWT secret, then run
`npm run migrate` and `npm start` in `backend`, and `npm run dev` in `frontend`.
Server startup also applies pending migrations. Do not seed a production database.
Demo mode shows existing fictional employees and seven Thai evaluation fixtures
for E100–E105 (two historical records for E100). These fixtures are recreated from
the mock seed after refresh; they are not database writes. Saving is disabled and
the mock API rejects writes rather than reporting a fictitious save.

Feature verification: `npm test` in backend; `npm test -- src --maxWorkers=1`,
`npm run lint`, and `npm run build` in frontend. The separate pre-existing
`frontend/integration` suite requires its PostgreSQL test setup; the unfiltered
frontend test command includes that suite. Evaluation API tests use a temporary SQLite database
and fictional employees, verify role checks and validation, and close/reopen the
saved database before retrieving history.


### ข้อมูลตัวอย่างผลการประเมิน

ชุดข้อมูลสมมติอยู่ใน `shared/demoEvaluations.js` ใช้ร่วมกันระหว่าง seed ของ
โหมดสาธิตและ SQLite โดยอ้างอิงรหัสพนักงานเดิม ไม่สร้างพนักงานซ้ำ:

| รหัสพนักงาน | คะแนนรวมล่าสุด | ระดับผลการประเมิน |
| --- | --- | --- |
| E100 | 29/30 | ดีเยี่ยม (มีรอบก่อนหน้า 25/30 ดีมาก) |
| E101 | 19/30 | ดี |
| E102 | 15/30 | ต้องปรับปรุง |
| E103 | 9/30 | ต้องปรับปรุงเร่งด่วน |
| E104 | 24/30 | ดีมาก |
| E105 | 28/30 | ดีเยี่ยม |

ทุกรายการระบุ “ข้อมูลตัวอย่าง” ในรอบการประเมิน และใช้ผู้ประเมินสมมติ
หัวข้อ เกณฑ์คะแนน ระดับผลการประเมิน ข้อความแจ้งเตือน และข้อเสนอแนะเป็นภาษาไทย
ค่า rating ภายใน API ยังคงเดิม โดยหน้าจอแปลงเป็นป้ายภาษาไทย

ฐานข้อมูลสาธิตแยกจากข้อมูลจริง: `backend/data/evaluation-demo.db` (ไม่เก็บใน Git)
สร้างใหม่ได้ด้วยคำสั่งต่อไปนี้จากโฟลเดอร์ `backend` เมื่อไฟล์ยังไม่มีข้อมูล:

```sh
DB_PATH=./data/evaluation-demo.db NODE_ENV=development node src/seed.js
```

หากต้องการใช้ฐานข้อมูลนี้กับระบบจริง ให้ตั้ง `DB_PATH=./data/evaluation-demo.db`
ใน `backend/.env` พร้อม JWT_SECRET ของระบบ และตั้ง `VITE_USE_MOCK=false`
ใน `frontend/.env` แล้วเริ่ม backend/frontend ตามเดิม
สำหรับฐานข้อมูลสมมติเดิมที่ผ่าน migration แล้ว สามารถเพิ่มเฉพาะผลการประเมินได้ด้วย:

```sh
DB_PATH=./data/evaluation-demo.db NODE_ENV=development node src/seed-evaluations.js --demo-only
```

คำสั่งเพิ่มผลการประเมินตรวจสอบชื่อและแผนกของพนักงานสมมติก่อนเพิ่ม ไม่แก้ไขหรือลบ
รายการเดิม และรันซ้ำไม่เพิ่มผลการประเมินซ้ำ ห้ามใช้กับฐานข้อมูลพนักงานจริง
ไม่มีการเพิ่มข้อมูลสมมติผ่าน migration หรือการเริ่มเซิร์ฟเวอร์ตามปกติ
