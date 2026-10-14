import { useCallback, useRef, useState } from 'react'
import { ToastContext } from './toast'
import { NOTICE_TYPES } from './noticeTypes'

const SHOW_MS = 6000
const LEAVE_MS = 200

// Floating notifications: toast(message, 'success' | 'info' | 'warning' | 'error')
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const push = useCallback((message, type = 'success') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, type, leaving: false }])
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), SHOW_MS)
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), SHOW_MS + LEAVE_MS)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, label } = NOTICE_TYPES[t.type] || NOTICE_TYPES.info
          return (
            <div
              key={t.id}
              className={`notice-box toast nb-${t.type}${t.leaving ? ' is-leaving' : ''}`}
            >
              <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <span className="sr-only">{label}: </span>
                <span>{t.message}</span>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
