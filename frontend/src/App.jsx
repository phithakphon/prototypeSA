import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './auth/auth'
import { USE_MOCK } from './api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './mock/seed'
import { Eye, EyeOff, CheckCircle } from './components/icons'
import './App.css'

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | loading | success

  // Already signed in (and not in the middle of the sign-in animation)
  if (user && phase === 'idle') return <Navigate to="/dashboard" replace />

  const validate = () => {
    const errs = {}
    if (!username.trim()) errs.username = 'กรุณากรอกชื่อผู้ใช้'
    if (!password) errs.password = 'กรุณากรอกรหัสผ่าน'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleLogin(event) {
    event.preventDefault()
    setError('')
    if (!validate()) return

    setPhase('loading')
    try {
      await login(username.trim(), password)
      setPhase('success')
      setTimeout(() => navigate(location.state?.from || '/dashboard', { replace: true }), 900)
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  const fillDemo = (name) => {
    setUsername(name)
    setPassword(DEMO_PASSWORD)
    setFieldErrors({})
    setError('')
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

          <form onSubmit={handleLogin} noValidate>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <div className="form-group">
              <label htmlFor="username">ชื่อผู้ใช้</label>
              <input
                id="username"
                type="text"
                placeholder="กรอกชื่อผู้ใช้"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                aria-invalid={fieldErrors.username ? 'true' : undefined}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              />
              {fieldErrors.username && <p className="field-msg" id="username-error">{fieldErrors.username}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password">รหัสผ่าน</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={fieldErrors.password ? 'true' : undefined}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff width={18} height={18} /> : <Eye width={18} height={18} />}
                </button>
              </div>
              {fieldErrors.password && <p className="field-msg" id="password-error">{fieldErrors.password}</p>}
            </div>

            <button
              className={`login-button${phase === 'success' ? ' is-success' : ''}`}
              type="submit"
              disabled={phase !== 'idle'}
            >
              {phase === 'loading' && <span className="btn-spinner" aria-hidden="true" />}
              {phase === 'success' && <CheckCircle width={20} height={20} />}
              <span role="status">
                {phase === 'loading' ? 'กำลังเข้าสู่ระบบ...' : phase === 'success' ? 'เข้าสู่ระบบสำเร็จ' : 'เข้าสู่ระบบ'}
              </span>
              {phase === 'idle' && <span aria-hidden="true">→</span>}
            </button>
          </form>

          {USE_MOCK && (
            <div className="demo-box">
              <p>โหมดสาธิต — เลือกบัญชีทดลอง (รหัสผ่าน {DEMO_PASSWORD})</p>
              <div className="demo-chips">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.username} type="button" onClick={() => fillDemo(a.username)} disabled={phase !== 'idle'}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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