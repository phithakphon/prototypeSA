import { CircleCheck, CircleX } from 'lucide-react'
import { STATUS } from '../format'

// Status is shown with an icon AND text, so it never relies on colour alone.
export default function StatusBadge({ status }) {
  const s = STATUS[status]
  const Icon = status === 'active' ? CircleCheck : CircleX
  return (
    <span className={`badge ${s.cls}`}>
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      {s.label}
    </span>
  )
}
