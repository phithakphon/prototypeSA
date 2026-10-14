import { useState } from 'react'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleLogin(event) {
    event.preventDefault()

    if (!username.trim() || !password) {
      alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
      return
    }

    alert('หน้า Login แสดงผลแล้ว ขั้นตอนต่อไปจะเชื่อมระบบตรวจสอบบัญชี')
  }

  return (
    <main className="login-page">
      <section className="login-banner">
        <div className="banner-overlay">
          <div className="company-brand">
            <div className="brand-mark">HR</div>
            <span>HUMAN RESOURCE</span>
          </div>

          <div className="banner-content">
            <p className="eyebrow">EMPLOYEE MANAGEMENT SYSTEM</p>
            <h1>ระบบบริหารจัดการ<br />ข้อมูลพนักงาน</h1>
            <p className="banner-description">
              จัดการข้อมูลบุคลากรอย่างเป็นระบบ
              เพื่อการทำงานที่สะดวกและมีประสิทธิภาพ
            </p>
          </div>

          <p className="banner-footer">
            EMPLOYEE INFORMATION · PEOPLE · ORGANIZATION
          </p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand">HR MANAGEMENT</div>

          <p className="welcome-label">WELCOME BACK</p>
          <h2>เข้าสู่ระบบ</h2>
          <p className="login-description">
            กรุณากรอกข้อมูลเพื่อเข้าใช้งานระบบ
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">ชื่อผู้ใช้</label>
              <input
                id="username"
                type="text"
                placeholder="กรอกชื่อผู้ใช้"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">รหัสผ่าน</label>
              <input
                id="password"
                type="password"
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <button className="login-button" type="submit">
              เข้าสู่ระบบ <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="login-note">
            สำหรับบุคลากรที่ได้รับสิทธิ์เข้าใช้งานเท่านั้น
          </p>
        </div>

        <footer className="panel-footer">
          © 2026 Employee Management System
        </footer>
      </section>
    </main>
  )
}

export default App