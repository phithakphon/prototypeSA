import { NOTICE_TYPES } from './noticeTypes'

// Inline message. Colour + icon + (visually hidden) type label, so meaning never depends on colour alone.
export default function Notice({ variant = 'info', icon, title, className = '', role, children }) {
  const type = NOTICE_TYPES[variant]
  const Icon = icon || type.icon
  return (
    <div className={`notice-box nb-${variant} ${className}`.trim()} role={role ?? (variant === 'error' ? 'alert' : 'note')}>
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      <div>
        {title ? <strong>{title}</strong> : <span className="sr-only">{type.label}: </span>}
        {children}
      </div>
    </div>
  )
}
