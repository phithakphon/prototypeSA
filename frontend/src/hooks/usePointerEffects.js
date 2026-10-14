import { useEffect } from 'react'

// Mouse-driven lighting for the login page. Writes CSS custom properties straight onto the
// elements (no React state, so typing is never re-rendered) and eases them with requestAnimationFrame.
//   root  --gx / --gy  : glow position in px (smoothed)
//   root  --px / --py  : parallax offset, -1..1 (smoothed)
//   card  --cx / --cy  : cursor position inside the card, in px
// Disabled for touch/coarse pointers and for prefers-reduced-motion.
export default function usePointerEffects(rootRef, cardRef, { viewport = false } = {}) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const off =
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (off) return undefined

    let raf = 0
    const target = { x: 0, y: 0, gx: 0, gy: 0, on: 0 }
    const cur = { x: 0, y: 0, gx: 0, gy: 0, on: 0 }
    let initialised = false

    const tick = () => {
      const k = 0.09
      cur.x += (target.x - cur.x) * k
      cur.y += (target.y - cur.y) * k
      cur.gx += (target.gx - cur.gx) * 0.14
      cur.gy += (target.gy - cur.gy) * 0.14
      cur.on += (target.on - cur.on) * 0.08
      root.style.setProperty('--px', cur.x.toFixed(3))
      root.style.setProperty('--py', cur.y.toFixed(3))
      root.style.setProperty('--gx', `${cur.gx.toFixed(1)}px`)
      root.style.setProperty('--gy', `${cur.gy.toFixed(1)}px`)
      root.style.setProperty('--glow', cur.on.toFixed(3))
      const settled =
        Math.abs(target.x - cur.x) < 0.002 && Math.abs(target.y - cur.y) < 0.002 &&
        Math.abs(target.gx - cur.gx) < 0.5 && Math.abs(target.gy - cur.gy) < 0.5 &&
        Math.abs(target.on - cur.on) < 0.01
      raf = settled ? 0 : requestAnimationFrame(tick)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      // viewport mode: coordinates for a position:fixed decoration layer
      const r = viewport ? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight } : root.getBoundingClientRect()
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1
      target.y = ((e.clientY - r.top) / r.height) * 2 - 1
      target.gx = e.clientX - r.left
      target.gy = e.clientY - r.top
      target.on = 1
      if (!initialised) {
        cur.gx = target.gx
        cur.gy = target.gy
        initialised = true
      }
      kick()
    }
    const onLeave = () => {
      target.x = 0
      target.y = 0
      target.on = 0
      kick()
    }

    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)

    const card = cardRef?.current
    const onCardMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const r = card.getBoundingClientRect()
      card.style.setProperty('--cx', `${(e.clientX - r.left).toFixed(0)}px`)
      card.style.setProperty('--cy', `${(e.clientY - r.top).toFixed(0)}px`)
    }
    card?.addEventListener('pointermove', onCardMove)

    return () => {
      cancelAnimationFrame(raf)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      card?.removeEventListener('pointermove', onCardMove)
    }
  }, [rootRef, cardRef, viewport])
}
