import markUrl from '../assets/logo/logo-mark.svg'

// The product mark: a rounded tile with "S" and "A" drawn as flowchart-style letterforms
// (circle = start, diamond = decision, square = process) for System Analysis and Design.
// Same identity as public/favicon.svg. Decorative by default because the product name is always written next
// to it; pass `label` to expose it to screen readers.
export default function BrandLogo({ size = 48, label, className = '' }) {
  return (
    <img
      className={`brand-mark ${className}`.trim()}
      src={markUrl}
      width={size}
      height={size}
      alt={label || ''}
      aria-hidden={label ? undefined : 'true'}
      draggable="false"
    />
  )
}
