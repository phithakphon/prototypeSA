import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const CLOSE_MS = 160

// Page scroll lock shared by every open dialog (counted, so stacked dialogs restore correctly).
let locks = 0
let saved = null
function lockScroll() {
  if (locks++ > 0) return
  const body = document.body
  saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  body.style.overflow = 'hidden'
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px` // avoid a layout jump when the scrollbar disappears
}
function unlockScroll() {
  if (--locks > 0) return
  document.body.style.overflow = saved.overflow
  document.body.style.paddingRight = saved.paddingRight
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Accessible dialog. Layout: fixed header, scrollable body, optional fixed footer (`footer`),
 * so the action buttons are always reachable however tall the content is.
 *
 * Props: title, icon (lucide component), onClose, wide, footer, closeOnBackdrop (default true).
 */
export default function Modal({ title, icon: Icon, onClose, wide = false, footer, closeOnBackdrop = true, children }) {
  const ref = useRef(null)
  const bodyRef = useRef(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    closeRef.current = onClose
  })

  const requestClose = useCallback(() => {
    if (reducedMotion()) return closeRef.current()
    setClosing(true)
    return setTimeout(() => closeRef.current(), CLOSE_MS)
  }, [])

  useEffect(() => {
    const previous = document.activeElement
    const node = ref.current
    lockScroll()
    ;(bodyRef.current.querySelector('input:not([readonly]), select, textarea, button') || node).focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        requestClose()
        return
      }
      if (e.key !== 'Tab') return
      // keep keyboard focus inside the dialog
      const items = [...node.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!node.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      unlockScroll()
      previous?.focus?.() // back to the button that opened the dialog
    }
  }, [requestClose])

  // Rendered into document.body: an ancestor with transform/animation (the page transition) would
  // otherwise become the containing block of this position:fixed overlay and push the dialog off-screen.
  return createPortal(
    <div
      className={`modal-backdrop${closing ? ' is-closing' : ''}`}
      onMouseDown={(e) => closeOnBackdrop && e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={ref}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={titleId}>
            {Icon && <Icon size={24} strokeWidth={1.75} aria-hidden="true" />}
            {title}
          </h2>
          <button type="button" className="icon-btn modal-x" onClick={requestClose} aria-label="ปิดหน้าต่าง">
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body" ref={bodyRef}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
