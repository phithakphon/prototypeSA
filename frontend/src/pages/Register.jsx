import { useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Circle, CircleAlert, CircleCheck, Eye, EyeOff, Info, KeyRound, Loader2, Lock, ShieldCheck, User, UserPlus,
} from 'lucide-react'
import { api, USE_MOCK } from '../api'
import { useAuth } from '../auth/auth'
import { PASSWORD_CHECKS, passwordStrength, validateRegistration } from '../auth/registerRules'
import AuthShell from '../components/AuthShell'
import Notice from '../components/Notice'
import '../App.css'

const ICON = { size: 18, strokeWidth: 1.75, 'aria-hidden': true }
const EMPTY = { username: '', password: '', confirmPassword: '' }

// One labelled input with an icon and Thai feedback underneath:
// error (red + alert icon) / valid (green + check icon) / neutral hint.
function Field({ id, label, icon: Icon, hint, error, valid, delay, wrapClass = '', children }) {
  return (
    <div className="form-group reveal" style={{ '--d': `${delay}ms` }}>
      <label htmlFor={id}>{label}</label>
      <div className={`input-wrap ${wrapClass}${valid ? ' is-valid' : ''}`.trim()}>
        <Icon className="field-icon" {...ICON} />
        {children}
      </div>
      {error ? (
        <p className="field-msg" id={`${id}-msg`}><CircleAlert size={16} strokeWidth={2} aria-hidden="true" />{error}</p>
      ) : valid ? (
        <p className="field-ok" id={`${id}-msg`}><CircleCheck size={16} strokeWidth={2} aria-hidden="true" />กรอกถูกต้อง</p>
      ) : (
        hint && <p className="field-hint" id={`${id}-msg`}>{hint}</p>
      )}
    </div>
  )
}

function PasswordGuide({ password }) {
  const strength = passwordStrength(password)
  return (
    <div className="pw-guide" aria-live="polite">
      <div className="pw-meter">
        <span className="pw-meter-label">ความแข็งแรงของรหัสผ่าน: <strong>{strength.label}</strong></span>
        <span className={`pw-bars s${password ? strength.score : 0}`} aria-hidden="true">
          <i /><i /><i /><i />
        </span>
      </div>
      <ul className="pw-checks">
        {PASSWORD_CHECKS.map((c) => {
          const ok = c.test(password)
          return (
            <li key={c.key} className={ok ? 'is-ok' : ''}>
              {ok ? <CircleCheck size={16} strokeWidth={2} aria-hidden="true" /> : <Circle size={16} strokeWidth={2} aria-hidden="true" />}
              {c.label}
              <span className="sr-only">{ok ? ' (ครบแล้ว)' : ' (ยังไม่ครบ)'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Register() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [phase, setPhase] = useState('idle') // idle | loading | done
  const [created, setCreated] = useState(null)
  const [show, setShow] = useState({ password: false, confirmPassword: false })
  const busy = useRef(false) // blocks duplicate submissions even before React re-renders

  const clientErrors = useMemo(() => validateRegistration(form), [form])

  if (user && phase !== 'done') return <Navigate to="/dashboard" replace />

  const errorOf = (k) => ((touched[k] || submitted) ? clientErrors[k] : '') || serverErrors[k] || ''
  const validOf = (k) => (touched[k] || submitted) && !clientErrors[k] && !serverErrors[k] && form[k] !== ''

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (serverErrors[k]) setServerErrors((s) => ({ ...s, [k]: '' }))
  }
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }))
  const a11y = (k) => ({
    'aria-invalid': errorOf(k) ? 'true' : undefined,
    'aria-describedby': `f-${k}-msg`,
    onBlur: blur(k),
  })

  async function submit(e) {
    e.preventDefault()
    if (busy.current) return
    setSubmitted(true)
    setFormError('')
    const first = Object.keys(clientErrors)[0]
    if (first) {
      document.getElementById(`f-${first}`)?.focus()
      return
    }
    busy.current = true
    setPhase('loading')
    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: { username: form.username, password: form.password, confirmPassword: form.confirmPassword },
      })
      setCreated(res)
      setForm(EMPTY) // do not keep the password in component state once finished
      setPhase('done')
    } catch (err) {
      const fields = err.errors && Object.keys(err.errors).length ? err.errors : null
      setServerErrors(fields || {})
      if (!fields) {
        setFormError(
          err.status === 404 || err.status === 0
            ? 'ระบบสมัครบัญชียังไม่พร้อมใช้งาน (ฝั่งเซิร์ฟเวอร์ยังไม่มี API สำหรับสมัครบัญชี) กรุณาติดต่อผู้ดูแลระบบ'
            : err.message,
        )
      } else {
        const k = Object.keys(fields)[0]
        requestAnimationFrame(() => document.getElementById(`f-${k}`)?.focus())
      }
      setPhase('idle')
    } finally {
      busy.current = false
    }
  }

  const toggle = (k) => (
    <button
      type="button"
      className="toggle-password"
      onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))}
      aria-label={show[k] ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
      aria-pressed={show[k]}
    >
      {show[k] ? <EyeOff key="off" {...ICON} /> : <Eye key="on" {...ICON} />}
    </button>
  )

  return (
    <AuthShell
      eyebrow="EMPLOYEE ACCOUNT"
      heading="เริ่มต้นใช้งานระบบ"
      description="สร้างบัญชีผู้ใช้ด้วยชื่อผู้ใช้และรหัสผ่าน เพื่อเข้าใช้งานระบบบริหารจัดการข้อมูลพนักงานได้อย่างปลอดภัย"
    >
      {phase === 'done' ? (
        <div className="reg-success" role="status">
          <span className="reg-success-icon"><CircleCheck size={40} strokeWidth={1.75} aria-hidden="true" /></span>
          <h2>สมัครบัญชีสำเร็จ</h2>
          <p>
            ชื่อผู้ใช้ <strong>{created.username}</strong> ได้รับสิทธิ์เป็น <strong>{created.roleLabel}</strong>
          </p>
          {created.mock && (
            <Notice variant="warning" icon={Info} title="โหมดสาธิต">
              เป็นการจำลองการสมัครเท่านั้น ไม่ได้สร้างบัญชีถาวรในระบบจริง บัญชีนี้ใช้เข้าสู่ระบบได้จนกว่าจะรีเฟรชหน้า
            </Notice>
          )}
          <button
            type="button"
            className="login-button"
            onClick={() => navigate('/login', { state: { registered: created.username } })}
          >
            ไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      ) : (
        <>
          <Link to="/login" className="auth-back">
            <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" /> ย้อนกลับ
          </Link>

          <div className="reveal" style={{ '--d': '0ms' }}>
            <p className="welcome-label">CREATE ACCOUNT</p>
            <h2>สมัครบัญชีใหม่</h2>
            <p className="login-description">กรอกข้อมูลเพื่อสร้างบัญชีสำหรับเข้าใช้งานระบบ</p>
          </div>

          {USE_MOCK && (
            <Notice variant="warning" icon={Info} title="โหมดสาธิต" className="auth-notice">
              การสมัครนี้เป็นการจำลอง ไม่ได้สร้างบัญชีจริงและไม่เก็บข้อมูลถาวร
            </Notice>
          )}
          {formError && <Notice variant="error" className="auth-notice">{formError}</Notice>}

          <form className="reg-form" onSubmit={submit} noValidate>

            <Field id="f-username" label="ชื่อผู้ใช้" icon={User} delay={110} hint="4-20 ตัวอักษร ขึ้นต้นด้วยตัวอักษร ใช้ a-z, 0-9, . _ -" error={errorOf('username')} valid={validOf('username')}>
              <input id="f-username" name="username" type="text" autoComplete="username" spellCheck="false" placeholder="ตั้งชื่อผู้ใช้" value={form.username} onChange={set('username')} {...a11y('username')} />
            </Field>

            <Field id="f-password" label="รหัสผ่าน" icon={Lock} delay={210} wrapClass="password-wrap " error={errorOf('password')} valid={validOf('password')}>
              <input id="f-password" name="password" type={show.password ? 'text' : 'password'} autoComplete="new-password" placeholder="ตั้งรหัสผ่าน" value={form.password} onChange={set('password')} {...a11y('password')} />
              {toggle('password')}
            </Field>
            <PasswordGuide password={form.password} />

            <Field id="f-confirmPassword" label="ยืนยันรหัสผ่าน" icon={KeyRound} delay={260} wrapClass="password-wrap " error={errorOf('confirmPassword')} valid={validOf('confirmPassword')}>
              <input id="f-confirmPassword" name="confirmPassword" type={show.confirmPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" value={form.confirmPassword} onChange={set('confirmPassword')} {...a11y('confirmPassword')} />
              {toggle('confirmPassword')}
            </Field>

            <button className="login-button reveal" style={{ '--d': '310ms' }} type="submit" disabled={phase === 'loading'}>
              {phase === 'loading' ? <Loader2 className="spin" size={20} strokeWidth={2} aria-hidden="true" /> : <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" />}
              <span role="status">{phase === 'loading' ? 'กำลังสมัครบัญชี...' : 'สมัครบัญชี'}</span>
            </button>
          </form>

          <p className="auth-note reveal" style={{ '--d': '340ms' }}>
            <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            บัญชีใหม่จะได้รับสิทธิ์เป็น &quot;พนักงาน&quot; เท่านั้น ไม่สามารถเลือกสิทธิ์เองได้
          </p>

          <p className="auth-switch reveal" style={{ '--d': '370ms' }}>
            มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}

export default Register
