import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'

// Header profile control with a small dropdown (name, role, account, logout).
export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const firstName = user.displayName.split(' ')[0]

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="profile-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="profile"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="profile-dropdown"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">{firstName.charAt(0)}</span>
        <span className="profile-text">
          <strong>สวัสดี, คุณ{firstName}</strong>
          <span>{user.roleLabel}</span>
        </span>
        <ChevronDown className="profile-chevron" size={20} strokeWidth={2} aria-hidden="true" />
      </button>

      {open && (
        <div id="profile-dropdown" className="dropdown" role="menu" aria-label="เมนูผู้ใช้">
          <div className="dropdown-head">
            <span className="avatar avatar-lg" aria-hidden="true">{firstName.charAt(0)}</span>
            <div>
              <p className="dropdown-name">{user.displayName}</p>
              <p className="dropdown-role">{user.roleLabel}</p>
              <p className="dropdown-user">ชื่อผู้ใช้: {user.username}</p>
            </div>
          </div>
          <button type="button" role="menuitem" className="dropdown-item" onClick={onLogout} autoFocus>
            <LogOut size={20} strokeWidth={1.75} aria-hidden="true" />
            ออกจากระบบ
          </button>
        </div>
      )}
    </div>
  )
}
