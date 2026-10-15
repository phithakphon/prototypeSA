// Minimal CORS for a token-in-header API (no cookies, so no credentials mode).
// Only origins listed explicitly in CORS_ORIGINS get Access-Control-Allow-Origin; there is no wildcard.
// Same-origin requests (e.g. the Vite proxy or a hosting rewrite) never send an Origin header and are unaffected.
export function cors(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins)
  return (req, res, next) => {
    const origin = req.headers.origin
    if (!origin) return next()
    res.vary('Origin')
    const preflight = req.method === 'OPTIONS' && Boolean(req.headers['access-control-request-method'])
    if (!allowed.has(origin)) {
      // The browser enforces CORS; refuse the preflight so the real request is never sent.
      if (preflight) return res.status(403).json({ message: 'origin นี้ไม่ได้รับอนุญาต' })
      return next()
    }
    res.set('Access-Control-Allow-Origin', origin)
    if (preflight) {
      res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.set('Access-Control-Max-Age', '600')
      return res.status(204).end()
    }
    next()
  }
}
