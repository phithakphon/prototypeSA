# 🚀 คู่มือ Deploy ระบบบริหารพนักงาน

เอกสารนี้อธิบายการนำระบบขึ้น production บน **Vercel (frontend) + Render (backend) + Supabase (ฐานข้อมูล)**
ทุกขั้นตอนอ้างอิงคำสั่งและตัวแปรที่มีอยู่จริงใน `package.json` และ `.env.example`

> ⚠️ **สถานะตอนนี้: ยังไม่ได้ deploy** และยังไม่พร้อม deploy เต็มระบบ ดู [สถานะความพร้อม](#สถานะความพร้อม) ก่อนเริ่ม

## สารบัญ

1. [สถาปัตยกรรมที่แนะนำ](#สถาปัตยกรรมที่แนะนำ)
2. [สถานะความพร้อม](#สถานะความพร้อม)
3. [ขั้นที่ 1 — ตั้งค่า Supabase](#ขั้นที่-1--ตั้งค่า-supabase)
4. [ขั้นที่ 2 — Migration อย่างปลอดภัย](#ขั้นที่-2--migration-อย่างปลอดภัย)
5. [ขั้นที่ 3 — สร้างบัญชีผู้ดูแลคนแรก](#ขั้นที่-3--สร้างบัญชีผู้ดูแลคนแรก)
6. [ขั้นที่ 4 — Deploy backend บน Render](#ขั้นที่-4--deploy-backend-บน-render)
7. [ขั้นที่ 5 — Deploy frontend บน Vercel](#ขั้นที่-5--deploy-frontend-บน-vercel)
8. [ขั้นที่ 6 — ผูก CORS และตรวจระบบ](#ขั้นที่-6--ผูก-cors-และตรวจระบบ)
9. [ตัวแปรสภาพแวดล้อมทั้งหมด](#ตัวแปรสภาพแวดล้อมทั้งหมด)
10. [SSL: ตรวจใบรับรองของฐานข้อมูล](#ssl-ตรวจใบรับรองของฐานข้อมูล)
11. [Health check และการแก้ปัญหา](#health-check-และการแก้ปัญหา)
12. [อัปเดตระบบหลัง push ขึ้น GitHub](#อัปเดตระบบหลัง-push-ขึ้น-github)
13. [เช็กลิสต์ความปลอดภัย](#เช็กลิสต์ความปลอดภัย)

## สถาปัตยกรรมที่แนะนำ

```
ผู้ใช้ (เบราว์เซอร์)
   │ https
   ▼
Vercel ── React/Vite (ไฟล์ static จาก frontend/dist)
   │ fetch  https://<backend>/api/...   (Authorization: Bearer <JWT>)
   ▼
Render ── Node.js + Express  (backend/)      ← ตรวจ JWT, RBAC, ขอบเขตแผนกทั้งหมดที่นี่
   │ PostgreSQL + TLS (ตรวจใบรับรอง)
   ▼
Supabase PostgreSQL  (RLS เปิดทุกตาราง, anon/authenticated ถูกปิดสิทธิ์)
```

- Frontend **ไม่เคยถือ** รหัสผ่านฐานข้อมูลหรือ JWT secret (ค่า `VITE_*` ถูกฝังในไฟล์ที่ทุกคนดาวน์โหลดได้)
- เบราว์เซอร์คุยกับ backend ข้ามโดเมน จึงต้องตั้ง `VITE_API_URL` (ฝั่ง frontend) และ `CORS_ORIGINS` (ฝั่ง backend) ให้ตรงกัน
- ทางเลือก: Netlify แทน Vercel (ใช้ `frontend/public/_redirects` ที่เตรียมไว้) หรือ Railway แทน Render (ใช้ค่าตัวแปรชุดเดียวกัน)

## สถานะความพร้อม

| หัวข้อ | สถานะ |
|---|---|
| Build frontend แบบ production | ✅ ผ่าน (ไม่มี mock ใน bundle, build ล้มเหลวถ้าตั้งค่าผิด) |
| Backend เริ่มทำงานแบบ production | ✅ ปฏิเสธการเริ่มเมื่อตั้งค่าไม่ปลอดภัยหรือไม่ครบ (ทดสอบแล้ว) |
| CORS, health check, SPA routing, graceful shutdown | ✅ เตรียมแล้ว |
| ตรวจใบรับรองฐานข้อมูล (`DB_SSL=verify`) | ⚠️ **ต้องตั้งค่าเอง** — ต้องดาวน์โหลด Supabase Root CA จาก Dashboard |
| บัญชีผู้ดูแลคนแรก | ⚠️ ต้องรันสคริปต์ `npm run bootstrap:user` (ขั้นที่ 3) |
| ระบบผลการประเมินพนักงาน (อยู่บน `main`) | ❌ **ยังใช้กับ PostgreSQL ไม่ได้** ต้องย้ายก่อน ดู [`INTEGRATION-PLAN.md`](INTEGRATION-PLAN.md) |

**สรุป:** สาขา `feature/register-page` deploy ได้เมื่อตั้งค่าด้วยตนเองครบ แต่ระบบรวมของทีม (`main`) **ยังไม่พร้อม deploy**
จนกว่าจะรวมระบบผลการประเมินเข้ากับ PostgreSQL

## ขั้นที่ 1 — ตั้งค่า Supabase

1. สร้างโปรเจกต์ที่ <https://supabase.com> และตั้ง Database password (ใช้รหัสผ่านที่คาดเดายาก)
2. **Connect → Connection string → Session pooler** (พอร์ต **5432**) คัดลอกค่า `DATABASE_URL`
   - แทน `[YOUR-PASSWORD]` ด้วยรหัสผ่านจริง และ **URL-encode อักขระพิเศษ** (`@` → `%40`, `/` → `%2F`, `:` → `%3A`)
   - ใช้ Session pooler (รองรับ IPv4) แทน Direct connection ที่บางเครือข่ายเชื่อมต่อไม่ได้
3. **Project Settings → Database → SSL Configuration → Download certificate** เก็บไฟล์ Root CA ไว้ (ใช้ในหัวข้อ SSL)
4. ใช้โปรเจกต์ **ทดสอบแยกต่างหาก** ก่อนใช้โปรเจกต์จริง และตรวจว่าเปิด backup ในแผนที่ใช้

## ขั้นที่ 2 — Migration อย่างปลอดภัย

Migration เป็นแบบ **เพิ่มอย่างเดียว** (สร้างตาราง/index/constraint) ไม่ลบหรือเขียนทับข้อมูล และใช้ `CREATE TABLE` ธรรมดา
ถ้ามีตารางชื่อเดียวกันอยู่แล้วจะล้มเหลวและ rollback ไม่เขียนทับ

```bash
cd backend
npm ci
# ตั้งค่าชั่วคราวใน backend/.env (ไฟล์นี้ไม่ถูก commit): DATABASE_URL, DB_SSL=verify, DB_SSL_CA=./certs/<ไฟล์>.crt
npm run db:ssl-check      # ตรวจ CA + การเชื่อมต่อแบบ verify (SELECT 1)
npm run migrate           # รัน migration ที่ยังค้าง ทีละไฟล์ใน transaction
```

ข้อควรปฏิบัติ:

- **สำรองข้อมูลก่อนทุกครั้ง** (Supabase → Database → Backups) โดยเฉพาะเมื่อมีข้อมูลจริง
- รัน migration **ก่อน** deploy โค้ดที่ต้องใช้ตารางนั้น และรันจากเครื่องที่คุณควบคุมเอง
- **ห้ามตั้ง `AUTO_MIGRATE=true`** บน production (ค่าเริ่มต้นคือ `false`) และห้ามรัน `npm run seed` กับฐานข้อมูลจริง (seed สร้างบัญชีทดสอบ)
- ถ้า server แจ้ง "ยังมี migration ที่ยังไม่ได้รัน" แปลว่าลืมขั้นนี้ ไม่ใช่บั๊ก
- ย้ายข้อมูลจาก SQLite เดิม (ถ้าจำเป็น): `npm run migrate:data` (dry-run) แล้วค่อย `-- --execute --approve-pii-transfer` หลังตรวจแล้วเท่านั้น

## ขั้นที่ 3 — สร้างบัญชีผู้ดูแลคนแรก

ฐานข้อมูล production ว่างเปล่า: พนักงานถูกเพิ่มโดย "ผู้จัดการ" และบัญชีที่สมัครเองถูกผูกโดย "ฝ่ายบุคคล" จึงต้องสร้างบัญชีแรกด้วยสคริปต์
(รหัสผ่านอ่านจาก environment ไม่พิมพ์ออกหน้าจอ)

```bash
cd backend
# PowerShell:  $env:BOOTSTRAP_PASSWORD = Read-Host   |  bash: read -s BOOTSTRAP_PASSWORD && export BOOTSTRAP_PASSWORD
npm run bootstrap:user -- --username hr.admin --role hr --employee-code E201 \
  --first-name ชื่อ --last-name นามสกุล --position "เจ้าหน้าที่ฝ่ายบุคคล" --start-date 2024-01-15 --create-employee
# ตรวจแผนที่แสดง แล้วจึงเพิ่ม --execute --confirm-bootstrap
```

สร้างอย่างน้อย `hr` (ผูกบัญชีผู้ใช้) และ `manager` (เพิ่มพนักงาน/จัดการลาออก) และ `finance` ถ้าต้องใช้เงินเดือน
รหัสผ่านต้องยาวอย่างน้อย 12 ตัวอักษร มีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข สคริปต์ไม่สร้างทับของเดิม

## ขั้นที่ 4 — Deploy backend บน Render

**วิธีที่ 1 — Blueprint (แนะนำ):** ที่ Render เลือก **New → Blueprint** ชี้ไป repo นี้ ระบบอ่าน [`render.yaml`](../render.yaml)
แล้วถามค่า 3 ตัวที่เป็นความลับ (`DATABASE_URL`, `DB_SSL_CA_PEM`, `CORS_ORIGINS`) ส่วน `JWT_SECRET` ถูกสร้างให้อัตโนมัติ

**วิธีที่ 2 — ตั้งเอง:** **New → Web Service** แล้วกรอก

| ช่อง | ค่า |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Environment | ตามตาราง [ตัวแปร backend](#ตัวแปรสภาพแวดล้อมทั้งหมด) |

หมายเหตุ:

- `npm start` ใช้ `--env-file-if-exists` จึงทำงานได้แม้ไม่มีไฟล์ `.env` (Render ส่งค่ามาเป็น environment variable)
- ต้องใช้ Node.js ≥ 22.13 (`NODE_VERSION=22` ถูกตั้งไว้ใน `render.yaml`)
- แผนฟรีของ Render หลับเมื่อไม่มีผู้ใช้ — คำขอแรกหลังหลับอาจช้าประมาณ 30–60 วินาที
- เมื่อ deploy สำเร็จ เปิด `https://<ชื่อบริการ>.onrender.com/health` ต้องได้ `{"status":"ok"}` และ `/ready` ต้องได้ `{"status":"ok"}` (ฐานข้อมูลตอบ)

## ขั้นที่ 5 — Deploy frontend บน Vercel

1. **Add New → Project** เลือก repo นี้
2. ตั้งค่า (Vercel อ่าน [`frontend/vercel.json`](../frontend/vercel.json) ให้ด้วย):

| ช่อง | ค่า |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

3. **Environment Variables:** `VITE_API_URL` = origin ของ backend เช่น `https://ems-backend.onrender.com`
   (ต้องเป็น `https` ไม่มี `/` ท้ายและไม่มี `/api`) ดู [`frontend/env.production.example`](../frontend/env.production.example)
4. **Deploy** — ถ้า `VITE_API_URL` ผิดรูปแบบ build จะล้มเหลวพร้อมข้อความอธิบาย (ตั้งใจ)

เรื่องที่จัดการให้แล้ว:

- **รีเฟรชหน้าแล้วไม่ 404:** `vercel.json` rewrite ทุกเส้นทางไป `index.html` (Netlify ใช้ `public/_redirects`)
- **ไม่ใช้ mock ใน production:** build ที่เป็น production บังคับปิด mock เสมอ
- **Security header:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

## ขั้นที่ 6 — ผูก CORS และตรวจระบบ

1. คัดลอก URL ของ frontend (เช่น `https://ems.vercel.app`) ไปตั้ง `CORS_ORIGINS` ที่ Render (origin เดียวเท่านั้น: ไม่มี `/` ท้าย ไม่ใช้ `*`)
   แล้ว **Manual Deploy / Restart** backend (ถ้ามีหลายโดเมน คั่นด้วยจุลภาค)
2. เปิดเว็บ → เข้าสู่ระบบด้วยบัญชีจากขั้นที่ 3 → ตรวจเมนูตามบทบาท
3. ทดสอบ: ค้นหาพนักงาน, เพิ่มพนักงาน (manager), สมัครบัญชีใหม่แล้วผูกที่หน้า "ผูกบัญชีผู้ใช้" (hr)
4. เปิด DevTools → Network: คำขอต้องไป `https://<backend>/api/...` และไม่มี error CORS

## ตัวแปรสภาพแวดล้อมทั้งหมด

### Backend (Render / Railway)

| ตัวแปร | จำเป็น | ตัวอย่าง / ความหมาย |
|---|---|---|
| `NODE_ENV` | ใช่ | `production` — เปิดการตรวจความปลอดภัยทั้งหมดและ HSTS |
| `DATABASE_URL` | ใช่ | Supabase Session pooler URL (🔒 ความลับ) |
| `JWT_SECRET` | ใช่ | อย่างน้อย 32 ตัวอักษรแบบสุ่ม (🔒) สร้างเอง: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_SSL` | ใช่ | `verify` (production บังคับ) |
| `DB_SSL_CA_PEM` | ใช่\* | ข้อความใบรับรอง Supabase Root CA (ไม่ใช่ความลับ) ใส่ได้หลายบรรทัดหรือเขียน `\n` แทนขึ้นบรรทัด |
| `CORS_ORIGINS` | ใช่ | origin ของ frontend เช่น `https://ems.vercel.app` (คั่นหลายค่าด้วย `,`) |
| `TRUST_PROXY` | ใช่ | `1` บน Render/Railway (ไม่ตั้ง = ทุกคนถูกนับเป็น IP เดียวใน rate limit) |
| `PORT` | ไม่ | แพลตฟอร์มกำหนดให้เอง (ค่าเริ่มต้น 3001) |
| `JWT_EXPIRES_IN` | ไม่ | ค่าเริ่มต้น `8h` |
| `DB_POOL_MAX` | ไม่ | ค่าเริ่มต้น 10 (แผนฟรีของ Supabase แนะนำ 5) |
| `AUTO_MIGRATE` | ไม่ | ต้องเป็น `false` (ค่าเริ่มต้น) |

\* หรือใช้ `DB_SSL_CA` (path ไฟล์) แทน ถ้าแพลตฟอร์มรองรับ secret file

### Frontend (Vercel / Netlify) — ใส่ตอน build

| ตัวแปร | จำเป็น | ความหมาย |
|---|---|---|
| `VITE_API_URL` | ใช่ | origin ของ backend (`https://...`) ไม่มี `/api` ท้าย — **ค่านี้เป็นสาธารณะ ห้ามใส่ความลับ** |

ห้ามตั้ง `VITE_USE_MOCK=true` (build จะล้มเหลวตั้งใจ)

### เฉพาะเครื่องของคุณ (ไม่ใส่บนแพลตฟอร์ม)

`BOOTSTRAP_PASSWORD` (สร้างบัญชีแรก), `ROTATE_NEW_PASSWORD` (เปลี่ยนรหัสบัญชีทดสอบ), `SEED_PASSWORD` + `ALLOW_REMOTE_SEED` (seed ข้อมูลทดสอบ — ห้ามใช้บน production)

## SSL: ตรวจใบรับรองของฐานข้อมูล

Production บังคับ `DB_SSL=verify` เพื่อกัน man-in-the-middle ใบรับรองของ Supabase ออกโดย CA ของ Supabase เอง
(ไม่อยู่ใน trust store ของ Node) จึงต้องระบุ Root CA:

1. ดาวน์โหลด **Supabase Root 2021 CA** จาก Dashboard (Database Settings → SSL Configuration) — **ห้ามดึงใบรับรองจากเซิร์ฟเวอร์ฐานข้อมูลเอง** เพราะจะเท่ากับเชื่อสิ่งที่ต้องตรวจสอบ
2. ตรวจ SHA-256 ของไฟล์เทียบกับที่ Dashboard แสดง (`openssl x509 -in <ไฟล์> -noout -fingerprint -sha256` หรือรัน `npm run db:ssl-check`)
3. ตั้งค่า:
   - เครื่องตัวเอง: วางไฟล์ที่ `backend/certs/` (ถูก `.gitignore`) แล้วตั้ง `DB_SSL=verify`, `DB_SSL_CA=./certs/<ไฟล์>.crt`
   - Render: วางข้อความในไฟล์ลงตัวแปร `DB_SSL_CA_PEM`
4. ตรวจ: `npm run db:ssl-check` ต้องแสดง "เชื่อมต่อสำเร็จ — ใบรับรอง… ผ่านการตรวจสอบ"

ถ้าลืมตั้ง CA: server จะไม่เริ่ม (`SELF_SIGNED_CERT_IN_CHAIN`) — เป็นการล้มเหลวอย่างปลอดภัย ไม่ได้ลดระดับการตรวจเอง

## Health check และการแก้ปัญหา

| Endpoint | ใช้ทำอะไร | ผลปกติ |
|---|---|---|
| `GET /health` | liveness — โปรเซสทำงาน (ใช้เป็น Health Check Path ของ Render) | `200 {"status":"ok"}` |
| `GET /ready` | readiness — ฐานข้อมูลตอบ | `200 {"status":"ok"}` หรือ `503 {"status":"unavailable"}` |

ทั้งสองไม่ต้องล็อกอิน ไม่คืนข้อมูลภายใน

| อาการ | สาเหตุที่พบบ่อย / วิธีแก้ |
|---|---|
| Backend ไม่เริ่ม: `ตั้งค่าไม่ถูกต้อง: …` | ตัวแปรขาดหรือไม่ปลอดภัย (`JWT_SECRET` สั้น, `DB_SSL` ไม่ใช่ `verify`, `CORS_ORIGINS` ผิดรูปแบบ) อ่านข้อความแล้วแก้ตามนั้น |
| `ยังมี migration ที่ยังไม่ได้รัน` | รัน `npm run migrate` (ขั้นที่ 2) แล้ว restart |
| `[SELF_SIGNED_CERT_IN_CHAIN]` | ยังไม่ได้ใส่ `DB_SSL_CA_PEM` / `DB_SSL_CA` |
| `[28P01] password authentication failed` | รหัสผ่านใน `DATABASE_URL` ผิด หรือไม่ได้ URL-encode (pooler ใช้ user `postgres.<project-ref>`) |
| `[ENOTFOUND]` / `[ETIMEDOUT]` | URL ผิด หรือใช้ Direct connection ที่ไม่รองรับ IPv4 → ใช้ Session pooler |
| `too many clients` / `[53300]` | ลด `DB_POOL_MAX` |
| เว็บโหลดแต่ล็อกอินไม่ได้ + Console แสดง CORS error | `CORS_ORIGINS` ไม่ตรงกับ origin ของ frontend แบบตัวต่อตัว (ตรวจ `https`, ไม่มี `/` ท้าย) แล้ว restart backend |
| Network แสดงคำขอไป `/api/...` ของโดเมน Vercel (404) | ไม่ได้ตั้ง `VITE_API_URL` ตอน build → ตั้งแล้ว **Redeploy** (ค่า `VITE_*` ถูกฝังตอน build) |
| รีเฟรชหน้าแล้ว 404 | ไม่ได้ใช้ `frontend/vercel.json` (ตรวจ Root Directory = `frontend`) |
| ล็อกอินผิดไม่กี่ครั้งแล้วถูกล็อกทั้งทีม (429) | ไม่ได้ตั้ง `TRUST_PROXY=1` |
| คำขอแรกช้ามาก | แผนฟรีของ Render หลับอยู่ — ปกติ |
| หน้าเว็บขาว | เปิด Console ดู error; มักเกิดหลัง build ที่ตั้ง `VITE_API_URL` ผิดจนล้มเหลว หรือแคชเก่า (Ctrl+Shift+R) |

## อัปเดตระบบหลัง push ขึ้น GitHub

1. พัฒนาบนสาขาแยก → เปิด Pull Request เข้า `main` → ตรวจ → merge (ห้าม push ตรงเข้า `main`)
2. Render และ Vercel ตรวจ `main` แล้ว deploy ใหม่อัตโนมัติ (เปลี่ยนเป็น manual ได้ในการตั้งค่า)
3. **ถ้า PR มีไฟล์ใหม่ใน `backend/src/migrations/`:** รัน `npm run migrate` จากเครื่องคุณ **ก่อน** merge (ดูขั้นที่ 2) ไม่เช่นนั้น backend ใหม่จะไม่เริ่มและ Render จะคงเวอร์ชันเก่าไว้
4. เปลี่ยนตัวแปร `VITE_*` → ต้อง Redeploy frontend; เปลี่ยนตัวแปร backend → restart service
5. ตรวจ `/health`, `/ready` และลองล็อกอินหลังทุกครั้ง
6. ย้อนกลับ: Render/Vercel มีปุ่ม Rollback ไปยัง deploy ก่อนหน้า (migration แบบเพิ่มอย่างเดียวย้อนโค้ดได้โดยไม่ต้องย้อนฐานข้อมูล)

## เช็กลิสต์ความปลอดภัย

- [ ] `JWT_SECRET` สุ่มยาว ≥ 32 และไม่ซ้ำกับตอนพัฒนา
- [ ] `DB_SSL=verify` และ CA ตรวจ SHA-256 แล้ว
- [ ] `CORS_ORIGINS` มีเฉพาะโดเมน frontend จริง
- [ ] `TRUST_PROXY=1` บน Render/Railway
- [ ] ไม่มีบัญชีทดสอบ/รหัสผ่านเริ่มต้นใน production (ไม่รัน `seed`)
- [ ] เปลี่ยนรหัสผ่านบัญชีทดสอบที่เคยใช้ (`npm run rotate:passwords`) ถ้าฐานข้อมูลเคยมีบัญชีเหล่านั้น
- [ ] RLS เปิดทุกตาราง และ `anon`/`authenticated` ไม่มีสิทธิ์ (ตรวจด้วย SQL อ่านอย่างเดียว)
- [ ] เปิด backup ของ Supabase
- [ ] ไม่มีไฟล์ `.env`, ใบรับรอง หรือรหัสผ่านใน Git

### ข้อจำกัดที่ทราบ

- JWT เก็บใน `localStorage` (ความเสี่ยงจาก XSS) — ย้ายไป cookie แบบ httpOnly ต้องแก้ทั้ง frontend และ backend
- Rate limit เก็บในหน่วยความจำของ process เดียว: ใช้ได้กับ backend 1 instance (หลาย instance ต้องใช้ที่เก็บกลาง เช่น Redis)
- `react-router-dom` 6.x มีคำเตือนความเสี่ยงระดับปานกลาง (open redirect ผ่าน `<Link>`/`navigate`) แอปนี้ไม่ได้รับ URL เปลี่ยนเส้นทางจากผู้ใช้ จึงความเสี่ยงต่ำ การแก้ต้องอัปเกรดเป็น v7 (breaking change) ควรทำแยก
