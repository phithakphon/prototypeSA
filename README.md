<div align="center">

<img src="frontend/src/assets/logo/logo-mark.svg" alt="โลโก้ SA" width="132" height="132">

# ระบบบริหารจัดการพนักงาน

**Employee Management System**

ระบบบริหารจัดการข้อมูลพนักงาน พัฒนาขึ้นสำหรับรายวิชา System Analysis and Design (SA) โดยมุ่งเน้นการจัดการข้อมูลพนักงาน บัญชีผู้ใช้งาน สิทธิ์การเข้าถึง และข้อมูลเงินเดือนอย่างเป็นระบบ

![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.13-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)

</div>

> 🚧 **สถานะ:** กำลังพัฒนา — **ยังไม่ได้ deploy** และ **ยังไม่พร้อม deploy เต็มระบบ** (ดู [สถานะการพัฒนา](#-สถานะการพัฒนา))

## สารบัญ

1. [ภาพรวมโครงการ](#-ภาพรวมโครงการ)
2. [ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
3. [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
4. [สถาปัตยกรรมระบบ](#-สถาปัตยกรรมระบบ)
5. [บทบาทและสิทธิ์](#-บทบาทและสิทธิ์)
6. [โครงสร้างฐานข้อมูล](#-โครงสร้างฐานข้อมูล)
7. [การติดตั้ง](#-การติดตั้ง)
8. [การรันโปรเจกต์](#-การรันโปรเจกต์)
9. [การทดสอบ](#-การทดสอบ)
10. [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
11. [ความปลอดภัย](#-ความปลอดภัย)
12. [การ Deploy](#-การ-deploy)
13. [สถานะการพัฒนา](#-สถานะการพัฒนา)

## 📌 ภาพรวมโครงการ

ระบบสำหรับ **แผนกตรวจสอบบัญชี** ของบริษัทสอบบัญชี ใช้จัดการทะเบียนพนักงาน ประวัติการทำงาน เงินเดือน การลาออก และบัญชีผู้ใช้
แต่ละบทบาท (ผู้จัดการ, ฝ่ายบุคคล, ฝ่ายการเงิน, ผู้บริหาร, พนักงาน) เห็นและทำได้เฉพาะสิ่งที่ได้รับอนุญาต
โดย **backend เป็นผู้บังคับสิทธิ์ทั้งหมด** — frontend เป็นเพียงหน้าจอ

## ✨ ฟีเจอร์หลัก

ทุกรายการด้านล่างมีอยู่จริงในโค้ดของสาขานี้ (backend + frontend + เทสต์)

| หมวด | ฟีเจอร์ | หน้าเว็บ |
|---|---|---|
| 🔐 บัญชีผู้ใช้ | เข้าสู่ระบบ (JWT + bcrypt, จำกัดการลองผิด) | `/login` |
| | สมัครบัญชีด้วยตนเอง (ได้บทบาท "พนักงาน" เสมอ และยังไม่เห็นข้อมูลใด ๆ) | `/register` |
| 👥 พนักงาน | ค้นหาและกรองพนักงาน (รหัส / ชื่อ / แผนก / สถานะ) | `/employees/search` |
| | รายละเอียดและประวัติพนักงาน (ข้อมูลลับแสดงตามสิทธิ์) | `/employees/:id`, `/employees/history` |
| | เพิ่ม / แก้ไขข้อมูลพนักงาน | `/employees` |
| | แจ้งลาออก, รายชื่อผู้ลาออก, **กลับเข้าทำงาน** (เก็บประวัติเดิมไว้) | `/resigned` |
| 💰 เงินเดือน | จัดการเงินเดือน (ฝ่ายการเงิน), ฝ่ายบุคคลดูอ่านอย่างเดียว, พนักงานดูของตนเอง | `/salaries` |
| 🔗 ผูกบัญชี | ฝ่ายบุคคลตรวจสอบและ **ผูก / ยกเลิกการผูก** บัญชีที่สมัครเองกับพนักงาน พร้อม audit log | `/accounts` |
| 📊 ภาพรวม | สถิติพนักงานและประกาศ (พนักงานทั่วไปไม่เห็นสถิติองค์กร) | `/dashboard` |
| 🛠 งานดูแลระบบ | migration, สคริปต์สร้างบัญชีแรก, เปลี่ยนรหัสผ่าน, ตรวจ SSL, ย้ายข้อมูลจาก SQLite | คำสั่ง `npm run …` |

หมายเหตุ: หน้า `/evaluations` (ผลการประเมิน) บนสาขานี้ยังเป็นหน้า "ยังไม่เปิดใช้งาน" — ฟีเจอร์ประเมินผลของเพื่อนร่วมทีมอยู่บน `main`
และ **ยังไม่ได้รวมเข้ากับ PostgreSQL** (ดู [`docs/INTEGRATION-PLAN.md`](docs/INTEGRATION-PLAN.md)) จึงไม่นับว่ามีในสาขานี้

## 🧰 เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, Vite 8, React Router 6, ฟอนต์ Kanit (`@fontsource`), Vitest + Testing Library, oxlint |
| Backend | Node.js ≥ 22.13, Express 5, `pg` (PostgreSQL), `jsonwebtoken`, `bcrypt`, `node:test` |
| ฐานข้อมูล | Supabase PostgreSQL (เปิด Row Level Security ทุกตาราง) |
| ทดสอบ backend | PGlite (PostgreSQL ในหน่วยความจำ — ไม่แตะ Supabase) |

## 🏗 สถาปัตยกรรมระบบ

```
React Frontend ──(HTTPS, Bearer JWT)──▶ Express REST API ──(TLS)──▶ Supabase PostgreSQL
 (Vite, ไม่ถือรหัสลับ)                  (ตรวจสิทธิ์ RBAC + ขอบเขตแผนก)     (RLS เปิด, anon/authenticated ปิดสิทธิ์)
```

- Frontend **ไม่เชื่อมฐานข้อมูลโดยตรง** และไม่ถือ credential ใด ๆ
- ใช้ระบบยืนยันตัวตนของ Express เอง (ไม่ใช้ Supabase Auth)
- ระบบรองรับ **แผนกเดียว (ตรวจสอบบัญชี)** — ระเบียนนอกแผนกมองไม่เห็น ยกเว้นระเบียนของผู้ใช้เอง

## 👮 บทบาทและสิทธิ์

กำหนดที่ `backend/src/rbac.js` (และ `frontend/src/mock/rbac.js` สำหรับโหมดข้อมูลจำลอง)

| สิทธิ์ | ทำอะไรได้ | บทบาทที่ได้รับ |
|---|---|---|
| `employee:search` | ค้นหาพนักงาน | ทุกบทบาท ยกเว้นพนักงาน |
| `employee:view` | ดูรายละเอียดและประวัติ | ทุกบทบาท (พนักงานเห็นเฉพาะของตนเอง — `employee:selfOnly`) |
| `employee:viewConfidential` | ดูข้อมูลส่วนบุคคลของผู้อื่น | ผู้จัดการ, ฝ่ายบุคคล, ผู้บริหาร (+ เจ้าของข้อมูลเอง) |
| `employee:manage` | เพิ่ม / แก้ไขพนักงาน | ผู้จัดการ |
| `resignation:manage` | แจ้งลาออก / กลับเข้าทำงาน | ผู้จัดการ |
| `salary:manage` | เพิ่ม / แก้ไขเงินเดือน | ฝ่ายการเงิน |
| `salary:view` | ดูเงินเดือนผู้อื่น (อ่านอย่างเดียว) | ฝ่ายการเงิน, ฝ่ายบุคคล (+ เจ้าของข้อมูลเอง) |
| `account:link` | ผูก / ยกเลิกการผูกบัญชีกับพนักงาน | ฝ่ายบุคคล |

<details>
<summary><b>รายการ API ทั้งหมด</b> (คลิกเพื่อขยาย)</summary>

ทุกเส้นทางยกเว้น `login`, `register`, `/health`, `/ready` ต้องส่ง `Authorization: Bearer <token>`

| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/health`, `/ready` | สาธารณะ (liveness / ฐานข้อมูลพร้อม) |
| POST | `/api/auth/login` | สาธารณะ (จำกัด 5 ครั้งผิด/15 นาที ต่อ IP+ชื่อผู้ใช้ และ 30 ครั้ง ต่อ IP) |
| POST | `/api/auth/register` | สาธารณะ (10 บัญชี/ชั่วโมง/IP) — บัญชี `employee` ที่ยังไม่ผูกพนักงาน |
| GET | `/api/auth/me` | ผู้ที่เข้าสู่ระบบ |
| GET | `/api/dashboard/summary` | ผู้ที่เข้าสู่ระบบ |
| GET | `/api/employees?q=&department=&status=` | `employee:search` |
| GET | `/api/employees/departments`, `/api/employees/resigned` | `employee:search` / `resignation:manage` |
| GET | `/api/employees/:id` | `employee:view` (+ฟิลด์ลับตามสิทธิ์) |
| POST / PUT | `/api/employees`, `/api/employees/:id` | `employee:manage` |
| POST | `/api/employees/:id/resign`, `/api/employees/:id/reinstate` | `resignation:manage` |
| GET | `/api/salaries` | `salary:manage` |
| GET | `/api/employees/:id/salaries` | `salary:manage` / `salary:view` / เจ้าของข้อมูล |
| POST / PUT | `/api/employees/:id/salaries`, `/api/salaries/:id` | `salary:manage` |
| GET | `/api/accounts/pending`, `/api/accounts/linked`, `/api/accounts/linkable-employees` | `account:link` |
| POST | `/api/accounts/:id/link`, `/api/accounts/:id/unlink` | `account:link` |

</details>

## 🗄 โครงสร้างฐานข้อมูล

Supabase PostgreSQL จัดการด้วย migration ใน `backend/src/migrations/` (`001`–`003`) ทุกตารางเปิด RLS และไม่มี policy
→ `anon`/`authenticated` เข้าถึงข้อมูลโดยตรงไม่ได้ เข้าถึงผ่าน Express เท่านั้น

| ตาราง | ใช้ทำอะไร |
|---|---|
| `employees` | ทะเบียนพนักงาน (รหัส ชื่อ แผนก ตำแหน่ง สถานะ วันเริ่มงาน/ลาออก และข้อมูลส่วนบุคคลที่เป็นความลับ) |
| `users` | บัญชีเข้าสู่ระบบ (ชื่อผู้ใช้ รหัสผ่านแบบ bcrypt บทบาท) และการผูกกับพนักงาน (`employee_id`, 1 พนักงานต่อ 1 บัญชี) |
| `salaries` | ประวัติเงินเดือนของพนักงานแต่ละคน (จำนวนเงิน วันที่มีผล ผู้บันทึก) |
| `employee_history` | ไทม์ไลน์เหตุการณ์ของพนักงาน: เริ่มงาน, แก้ไข, เปลี่ยนตำแหน่ง/แผนก, ลาออก, กลับเข้าทำงาน |
| `announcements` | ประกาศที่แสดงบนหน้าหลัก (อ่านอย่างเดียว) |
| `account_link_audit` | บันทึกว่าใครผูก/ยกเลิกการผูกบัญชีกับพนักงานคนไหน เมื่อไร |
| `schema_migrations` | บันทึกว่า migration ไหนรันแล้ว |

ความสัมพันธ์: `users.employee_id`, `salaries.employee_id`, `employee_history.employee_id`, `account_link_audit.employee_id` → `employees.id`;
`salaries.created_by`, `employee_history.created_by`, `account_link_audit.user_id/performed_by` → `users.id`
(รายละเอียดคอลัมน์และข้อควรระวังอยู่ที่ [`backend/README.md`](backend/README.md))

## 🔧 การติดตั้ง

ต้องใช้ **Node.js ≥ 22.13**

```bash
git clone https://github.com/phithakphon/prototypeSA.git
cd prototypeSA

cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
```

### ตั้งค่า backend

```bash
cd backend
cp .env.example .env          # แล้วแก้ไขค่าใน .env (ไฟล์นี้ไม่ถูก commit)
```

ค่าที่ต้องกำหนดเป็นอย่างน้อย:

| ตัวแปร | ความหมาย |
|---|---|
| `JWT_SECRET` | คีย์เซ็น JWT สร้างด้วย `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATABASE_URL` | Supabase connection string (Session pooler) — URL-encode อักขระพิเศษในรหัสผ่าน |

ตัวแปรอื่น (`DB_SSL`, `DB_SSL_CA`, `DB_SSL_CA_PEM`, `DB_POOL_MAX`, `CORS_ORIGINS`, `TRUST_PROXY`, …) อธิบายไว้ใน `backend/.env.example`

> ใช้ Supabase โปรเจกต์ **ทดสอบ** ตอนพัฒนา และอย่าใส่ค่าจริงในไฟล์ที่ถูก commit

### เตรียมฐานข้อมูล

```bash
cd backend
npm run migrate       # สร้างตารางทั้งหมด (เพิ่มอย่างเดียว ไม่เขียนทับของเดิม)
npm run seed          # ข้อมูลทดสอบสมมติ + 5 บัญชีทดสอบ (เฉพาะฐานข้อมูลทดสอบ)
```

`seed` ถูกบล็อกบนฐานข้อมูลระยะไกลโดยค่าเริ่มต้น ต้องตั้ง `ALLOW_REMOTE_SEED=yes` และ `SEED_PASSWORD` (อย่างน้อย 12 ตัวอักษร) —
**ห้ามใช้กับ production** ดูขั้นตอน production ใน [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## ⚡ การรันโปรเจกต์

### โหมดข้อมูลจำลอง (ไม่ต้องมี backend)

```bash
cd frontend
npm run dev            # http://localhost:5173
```

หน้า Login จะแสดงกล่อง "โหมดสาธิต" ให้เลือกบัญชีทดลอง (ข้อมูลอยู่ในหน่วยความจำ หายเมื่อรีเฟรช การจำกัดสิทธิ์ในโหมดนี้เป็นการสาธิตเท่านั้น)

### ใช้ backend จริง

```bash
# เทอร์มินัล 1
cd backend
npm run dev            # http://localhost:3001  (หรือ npm start)

# เทอร์มินัล 2: สร้าง frontend/.env.local ที่มีบรรทัด  VITE_USE_MOCK=false
cd frontend
npm run dev            # Vite proxy ส่ง /api ไปที่ http://localhost:3001
```

| ต้องการ | ทำอย่างไร |
|---|---|
| สลับกลับไปใช้ข้อมูลจำลอง | ลบ `VITE_USE_MOCK=false` จาก `frontend/.env.local` |
| ให้ frontend เรียก backend คนละโดเมน | ตั้ง `VITE_API_URL=https://โดเมน-backend` (origin เท่านั้น ไม่มี `/api`) และตั้ง `CORS_ORIGINS` ฝั่ง backend |
| Production build | ใช้ mock ไม่ได้เด็ดขาด (บังคับปิดตอน build และ build ล้มเหลวถ้าตั้ง `VITE_USE_MOCK=true`) |

<details>
<summary><b>คำสั่ง npm ทั้งหมด</b></summary>

| ที่ | คำสั่ง | หน้าที่ |
|---|---|---|
| frontend | `npm run dev` / `build` / `preview` | รัน / build / ดูผล build |
| frontend | `npm run lint` | ตรวจโค้ดด้วย oxlint |
| frontend | `npm test` | Vitest |
| backend | `npm start` / `npm run dev` | รันเซิร์ฟเวอร์ (`dev` = watch) |
| backend | `npm run migrate` | รัน migration ที่ค้างอยู่ |
| backend | `npm run seed` / `seed:dry-run` | ข้อมูลทดสอบ / ดูแผนแบบอ่านอย่างเดียว |
| backend | `npm run bootstrap:user` | สร้างบัญชีผู้ดูแลคนแรก (dry-run เป็นค่าเริ่มต้น) |
| backend | `npm run rotate:passwords` | เปลี่ยนรหัสผ่านบัญชีทดสอบ (dry-run เป็นค่าเริ่มต้น) |
| backend | `npm run db:ssl-check` | ตรวจใบรับรองและการเชื่อมต่อแบบ verify |
| backend | `npm run migrate:data` | ย้ายข้อมูลจาก SQLite เดิม (dry-run เป็นค่าเริ่มต้น) |
| backend | `npm test` | เทสต์ backend |

</details>

## 🧪 การทดสอบ

```bash
cd backend  && npm test            # API, RBAC, ขอบเขตแผนก, สมัคร/ผูกบัญชี, migration, config ฯลฯ (58 เทสต์)
cd frontend && npm test            # หน้าจอ + mock API (119 เทสต์)
cd frontend && npm run lint        # oxlint
cd frontend && npm run build       # production build
```

เทสต์ backend ใช้ PostgreSQL ในหน่วยความจำ (PGlite) จึง **ไม่ต่อและไม่แก้ข้อมูลบน Supabase**
(การทดสอบกับ Supabase จริงทำแยกด้วยตนเองบนโปรเจกต์ทดสอบ)

## 📁 โครงสร้างโปรเจกต์

```
prototypeSA/
├── frontend/                 React 19 + Vite
│   ├── src/
│   │   ├── api.js            จุดเดียวที่เรียก API (สลับ mock / backend จริง)
│   │   ├── mock/             ชั้นข้อมูลจำลอง (เฉพาะตอนพัฒนา/ทดสอบ)
│   │   ├── auth/ components/ pages/ test/
│   │   └── assets/logo/      โลโก้ SA
│   ├── public/               favicon.svg, _redirects (SPA บน Netlify)
│   └── vercel.json           SPA rewrite + security headers
├── backend/                  Node.js + Express + PostgreSQL
│   ├── src/                  app, routes, rbac, scope, validate, migrations, seed, สคริปต์ดูแลระบบ
│   ├── src/legacy-sqlite/    schema SQLite เดิม (ต้นทางย้ายข้อมูลเท่านั้น)
│   └── test/                 เทสต์ (node:test + PGlite)
├── docs/                     DEPLOYMENT.md, INTEGRATION-PLAN.md
└── render.yaml               Blueprint ของ Render (backend)
```

## 🔒 ความปลอดภัย

| หัวข้อ | การป้องกัน |
|---|---|
| รหัสผ่าน | bcrypt (cost 10), ไม่ถูกส่งออก API, ไม่ถูกบันทึกใน log |
| การยืนยันตัวตน | JWT (HS256) อ่านผู้ใช้ใหม่จากฐานข้อมูลทุกคำขอ; จำกัดการลองรหัสผ่านผิด |
| สิทธิ์ | บังคับที่ backend ทั้งหมด (RBAC + ขอบเขตแผนก + เจ้าของข้อมูล) |
| ฐานข้อมูล | คำสั่ง SQL แบบ parameterized ทั้งหมด; RLS เปิดทุกตาราง; `anon`/`authenticated` ไม่มีสิทธิ์ |
| การเชื่อมต่อ | TLS; production บังคับ `DB_SSL=verify` (ตรวจใบรับรอง) |
| ความลับ | ใช้ตัวแปรสภาพแวดล้อมเท่านั้น; `.env`, ใบรับรอง, ไฟล์ฐานข้อมูล ถูก `.gitignore` |
| Production | `NODE_ENV=production` ปฏิเสธการเริ่มเมื่อ `JWT_SECRET` สั้น, `DB_SSL` ไม่ใช่ `verify` หรือ `CORS_ORIGINS` ผิดรูปแบบ; CORS แบบระบุ origin เท่านั้น |

ข้อจำกัดที่ยังมี: JWT เก็บใน `localStorage`; rate limit อยู่ในหน่วยความจำของ process เดียว; `react-router-dom` 6.x มีคำเตือนระดับปานกลางจาก `npm audit`
(ดูรายละเอียดใน [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#ข้อจำกัดที่ทราบ))
**อย่าเผยแพร่รหัสผ่านบัญชีทดสอบ** — ถ้ารหัสเคยหลุด ให้เปลี่ยนด้วย `npm run rotate:passwords`

## 🚀 การ Deploy

สถาปัตยกรรมที่แนะนำ: **Vercel** (frontend) + **Render** (backend) + **Supabase** (ฐานข้อมูล)
เตรียมไฟล์ตั้งค่าไว้แล้ว ([`render.yaml`](render.yaml), [`frontend/vercel.json`](frontend/vercel.json), ตัวอย่าง env) แต่ **ยังไม่ได้ deploy**

คู่มือละเอียด (ขั้นตอนทีละข้อ ตัวแปรทั้งหมด SSL CORS การแก้ปัญหา และการอัปเดตระบบ): **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**

| รายการ | สถานะความพร้อม |
|---|---|
| Frontend / Backend / health check / CORS / SPA routing | ✅ เตรียมแล้ว ทดสอบในเครื่องแล้ว |
| ตรวจใบรับรองฐานข้อมูล (Supabase Root CA) | ⚠️ ต้องตั้งค่าเอง |
| บัญชีผู้ดูแลคนแรก | ⚠️ ต้องรัน `npm run bootstrap:user` |
| รวมระบบผลการประเมินจาก `main` เข้ากับ PostgreSQL | ❌ ยังไม่ทำ — [`docs/INTEGRATION-PLAN.md`](docs/INTEGRATION-PLAN.md) |

**สถานะรวม: ยังไม่พร้อม deploy** จนกว่าจะรวมระบบผลการประเมินและตั้งค่า SSL

## 📈 สถานะการพัฒนา

| ส่วน | สถานะ |
|---|---|
| ฟีเจอร์ตาม Use Case (UC-01 ถึง UC-06) + สมัคร/ผูกบัญชี + กลับเข้าทำงาน | ✅ ทำแล้ว ทดสอบอัตโนมัติแล้ว |
| ย้ายฐานข้อมูลจาก SQLite → Supabase PostgreSQL (migration 001–003) | ✅ ทำแล้ว ใช้งานบน Supabase โปรเจกต์ทดสอบ |
| ตัวช่วย deploy (CORS, health, SPA, env) | ✅ พร้อม รอผู้ดูแลตั้งค่าและ deploy |
| ระบบผลการประเมินพนักงาน | ⏳ อยู่บน `main` (SQLite) — ต้องย้ายเป็น PostgreSQL |
| ทดสอบหน้าจอผ่านเบราว์เซอร์ด้วยมือ | ⏳ ยังไม่ได้ทำ |
| จัดการประกาศ (เพิ่ม/แก้ไข) | ⏳ ยังไม่มี (อ่านอย่างเดียว) |
| หน้า/คำสั่ง rotate รหัสผ่านบนฐานข้อมูลจริง | ⏳ รอผู้ดูแลอนุมัติ |

### 🤝 การทำงานร่วมกัน

- ห้าม push ตรงเข้า `main` — เปิด Pull Request จากสาขาของตนเอง
- ไฟล์ `.env` ไม่ถูกเก็บใน Git: คัดลอกจาก `backend/.env.example` และสร้าง `JWT_SECRET` ของตนเอง
- ถ้า PR มีไฟล์ migration ใหม่ ต้องรัน `npm run migrate` กับฐานข้อมูลทดสอบและแจ้งทีมก่อน merge
