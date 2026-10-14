import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

// jsdom has no matchMedia; the dashboard count-up reads prefers-reduced-motion
window.matchMedia ??= (query) => ({
  matches: true,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})
