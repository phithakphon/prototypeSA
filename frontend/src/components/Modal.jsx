import { useEffect, useRef } from 'react'
import { X } from './icons'

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement
    const node = ref.current
    const first = node.querySelector('input, select, textarea, button:not(.modal-x)') || node
    first.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn modal-x" onClick={onClose} aria-label="ปิด">
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
