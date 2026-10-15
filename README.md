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
└── backend/           Node.js + Express + PostgreSQL (Supabase, ไลบรารี `pg`) + JWT + bcrypt
    ├── src/           app, routes, rbac, validate, migrations, seed
    └── test/          เทสต์ API (node:test)
```

## เริ่มใช้งาน

ต้องใช้ Node.js >= 22.13

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
cp .env.example .env     # ตั้งค่า JWT_SECRET และ DATABASE_URL (Supabase) — รายละเอียดใน backend/README.md
npm run migrate          # สร้างตารางใน PostgreSQL
npm run seed             # ข้อมูลทดสอบ + บัญชีทดสอบ (ห้ามใช้ใน production; บล็อกถ้า DB เป็นระยะไกลเว้นแต่ ALLOW_REMOTE_SEED=yes)
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
| backend | `npm test` | เทสต์ API + DB + RBAC + ขอบเขตแผนก + สมัครสมาชิก + ผูกบัญชี + reinstate 45 รายการ (ใช้ PostgreSQL ในหน่วยความจำ (PGlite) ไม่แตะ Supabase) |

## สลับระหว่าง Mock กับ API จริง

ค่าเริ่มต้นของ frontend ตอนพัฒนา/ทดสอบคือ **mock** (`USE_MOCK` ใน `frontend/src/api.js`) แต่ **production build ใช้ mock ไม่ได้เด็ดขาด**: `USE_MOCK` ถูกบังคับเป็น `false` ตอน build, โค้ด mock ไม่ถูกรวมใน bundle และ `vite build` จะล้มเหลวถ้าตั้ง `VITE_USE_MOCK=true`

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

หน้าอื่น: `/dashboard` (หน้าหลัก) และ `/evaluations` (ผลการประเมิน — ยังเป็นหน้า "ยังไม่เปิดให้ใช้งาน" เพราะไม่มี Use Case รองรับ)

## สิทธิ์ (RBAC) — กำหนดที่ `backend/src/rbac.js` (และ `frontend/src/mock/rbac.js` สำหรับ mock)

| Use Case | สิทธิ์ | บทบาท |
|---|---|---|
| UC-01 | — | ทุกบทบาท |
| UC-02 | `employee:search` | ทุกบทบาทยกเว้นพนักงาน |
| UC-03 | `employee:view` | ทุกบทบาท (พนักงาน `employee:selfOnly` เปิดได้เฉพาะระเบียนของตนเอง) |
| UC-03 (ข้อมูลลับ) | `employee:viewConfidential` | ผู้จัดการ, ฝ่ายบุคคล, ผู้บริหาร และเจ้าของข้อมูลเอง |
| UC-04 | `employee:manage` | ผู้จัดการ |
| UC-06 | `resignation:manage` | ผู้จัดการ |
| UC-05 | `salary:manage` | ฝ่ายการเงิน (เพิ่ม/แก้ไข) |
| — | `account:link` | ฝ่ายบุคคล (ตรวจสอบและผูกบัญชีที่สมัครเองกับพนักงาน — ไม่เปลี่ยนบทบาทของบัญชี) |
| UC-05 | `salary:view` | ฝ่ายการเงิน, ฝ่ายบุคคล (อ่านอย่างเดียว) และเจ้าของดูเงินเดือนตัวเอง |

ข้อกำหนดเหล่านี้อ้างอิง Use Case Diagram ของโปรเจกต์ จุดที่ไดอะแกรมไม่ชัดเจนและทีมเลือกตีความไว้: เจ้าของข้อมูลดูเงินเดือนตนเองได้, ผู้จัดการดูข้อมูลส่วนบุคคลของทุกคนได้ (ต้องใช้แก้ไขตาม UC-04)

## Backend API ที่มีอยู่

ทุกเส้นทางยกเว้น login ต้องส่ง `Authorization: Bearer <token>`

| Method | Path | สิทธิ์ |
|---|---|---|
| POST | `/api/auth/login` | สาธารณะ (จำกัดการลองผิด 5 ครั้ง/15 นาที) |
| POST | `/api/auth/register` | สาธารณะ (จำกัด 10 บัญชี/ชั่วโมง/IP) — สร้างบัญชีบทบาท `employee` ที่ยังไม่ผูกกับพนักงาน ไม่เห็นข้อมูลใด ๆ จนกว่าผู้ดูแลจะผูกบัญชี |
| GET | `/api/accounts/pending` | `account:link` — บัญชีพนักงานที่ยังไม่ผูก |
| GET | `/api/accounts/linkable-employees?q=` | `account:link` — พนักงานที่ยังปฏิบัติงานและยังไม่มีบัญชี |
| POST | `/api/accounts/:id/link` | `account:link` — body `{ employeeId, employeeCode }` (ต้องพิมพ์รหัสพนักงานยืนยัน) |
| POST | `/api/accounts/:id/unlink` | `account:link` — ยกเลิกการผูก (เฉพาะบัญชีบทบาทพนักงาน) |
| POST | `/api/employees/:id/reinstate` | `resignation:manage` (บันทึก history `reinstated`) |
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

ฐานข้อมูล PostgreSQL บน Supabase (`backend/src/migrations/001_init.sql`; SQLite เดิมเก็บไว้เป็นต้นทางย้ายข้อมูลเท่านั้น — ดู `backend/README.md`): `employees`, `users`, `salaries`, `employee_history`, `announcements`, `schema_migrations`

## ข้อจำกัดที่ทราบ

- Frontend ยังไม่เคยทดสอบแบบ end-to-end กับ backend จริง (`VITE_USE_MOCK=false`) — เป็นงานแรกที่ควรตรวจ
- JWT เก็บใน `localStorage` (พอสำหรับงานเรียน; production ควรใช้ cookie แบบ httpOnly)
- ไม่มีหน้าจัดการบัญชีผู้ใช้ — บัญชีทั้งหมดมาจาก `npm run seed`
- `announcements` มีแต่ endpoint อ่าน (ผ่าน dashboard) ยังไม่มีการเพิ่ม/แก้ไขประกาศ
- ฟอนต์ Kanit โหลดจาก Google Fonts ต้องมีอินเทอร์เน็ต
- `node:sqlite` ใช้เฉพาะสคริปต์ย้ายข้อมูลจาก SQLite เดิม (experimental จึงมีข้อความเตือนตอนรัน)
- บัญชีที่สมัครเองต้องให้ฝ่ายบุคคลผูกกับพนักงานที่หน้า "ผูกบัญชีผู้ใช้" (`/accounts`) ก่อน จึงจะเห็นข้อมูลของตนเอง

## ขั้นตอนแนะนำสำหรับพัฒนา backend ต่อ

1. ตั้ง `VITE_USE_MOCK=false` แล้วไล่ทดสอบทุกหน้ากับ backend จริง แก้จุดที่รูปแบบข้อมูลไม่ตรงกัน
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
