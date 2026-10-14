import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, Briefcase, CircleCheck, Crown, Eye, EyeOff, Loader2, Lock, User, UserPlus, UserRound, Users, Wallet,
} from 'lucide-react'
import { useAuth } from './auth/auth'
import { USE_MOCK } from './api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from './mock/seed'
import AuthShell from './components/AuthShell'
import Notice from './components/Notice'
import './App.css'

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true }

const ROLE_ICONS = {
  manager1: Briefcase,
  hr1: Users,
  finance1: Wallet,
  executive1: Crown,
  employee1: UserRound,
}

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

  const busy = phase !== 'idle'
  const registered = location.state?.registered // set by the Register page after a successful sign-up

  return (
    <AuthShell
      heading="ระบบบริหารจัดการข้อมูลพนักงาน"
      description="จัดการข้อมูลบุคลากรอย่างเป็นระบบ เพื่อเพิ่มประสิทธิภาพในการทำงาน"
    >
      <div className="reveal" style={{ '--d': '0ms' }}>
        <p className="welcome-label">WELCOME BACK</p>
        <h2>เข้าสู่ระบบ</h2>
        <p className="login-description">กรุณากรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
      </div>

      {registered && (
        <Notice variant="success" className="auth-notice">
          สมัครบัญชี {registered} เรียบร้อยแล้ว{USE_MOCK ? ' (โหมดสาธิต: เป็นการจำลอง ข้อมูลหายเมื่อรีเฟรชหน้า)' : ''} เข้าสู่ระบบได้เลย
        </Notice>
      )}

      <form onSubmit={handleLogin} noValidate>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-group reveal" style={{ '--d': '80ms' }}>
          <label htmlFor="username">ชื่อผู้ใช้</label>
          <div className="input-wrap">
            <User className="field-icon" {...ICON} />
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
          </div>
          {fieldErrors.username && <p className="field-msg" id="username-error">{fieldErrors.username}</p>}
        </div>

        <div className="form-group reveal" style={{ '--d': '160ms' }}>
          <label htmlFor="password">รหัสผ่าน</label>
          <div className="input-wrap password-wrap">
            <Lock className="field-icon" {...ICON} />
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
              {showPassword ? <EyeOff key="off" {...ICON} /> : <Eye key="on" {...ICON} />}
            </button>
          </div>
          {fieldErrors.password && <p className="field-msg" id="password-error">{fieldErrors.password}</p>}
        </div>

        <button
          className={`login-button reveal${phase === 'success' ? ' is-success' : ''}`}
          style={{ '--d': '240ms' }}
          type="submit"
          disabled={busy}
        >
          {phase === 'loading' && <Loader2 className="spin" size={20} strokeWidth={2} aria-hidden="true" />}
          {phase === 'success' && <CircleCheck size={20} strokeWidth={2} aria-hidden="true" />}
          <span role="status">
            {phase === 'loading' ? 'กำลังเข้าสู่ระบบ...' : phase === 'success' ? 'เข้าสู่ระบบสำเร็จ' : 'เข้าสู่ระบบ'}
          </span>
          {phase === 'idle' && <ArrowRight className="arrow" size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
      </form>

      <p className="auth-switch reveal" style={{ '--d': '300ms' }}>
        ยังไม่มีบัญชี? <Link to="/register"><UserPlus size={18} strokeWidth={1.75} aria-hidden="true" />สมัครบัญชีใหม่</Link>
      </p>

      {USE_MOCK && (
        <div className="demo-box reveal" style={{ '--d': '340ms' }}>
          <p>โหมดสาธิต — เลือกบัญชีทดลอง (รหัสผ่าน {DEMO_PASSWORD})</p>
          <div className="demo-chips">
            {DEMO_ACCOUNTS.map((a) => {
              const Icon = ROLE_ICONS[a.username] || UserRound
              const selected = username === a.username && password === DEMO_PASSWORD
              return (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => fillDemo(a.username)}
                  disabled={busy}
                  aria-pressed={selected}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                  {a.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className="login-note">สำหรับบุคลากรที่ได้รับสิทธิ์เข้าใช้งานเท่านั้น</p>
    </AuthShell>
  )
}

export default App
