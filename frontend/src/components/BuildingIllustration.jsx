// CONCEPTUAL illustration of a modern audit-firm headquarters.
// It is NOT a depiction of any real building: no public source for the real office of
// บริษัท ศุภชัยสอบบัญชี could be verified, so this is an original, text-free architectural concept.
//
// Drawn as a true perspective render (pinhole camera) from simple 3D boxes, so every edge
// converges correctly. Pure SVG, no images and no 3D library.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => {
  const l = Math.hypot(...a)
  return a.map((n) => n / l)
}

// --- camera: low, slightly left of the building, looking at its entrance side ---
const CAM = [-31, -47, 5.2]
const TARGET = [2.5, 0, 9.6]
const FWD = norm(sub(TARGET, CAM))
const RIGHT = norm(cross(FWD, [0, 0, 1]))
const UP = cross(RIGHT, FWD)
const F = 1120
const CX = 468
const CY = 322

const pr = (X, Y, Z) => {
  const d = sub([X, Y, Z], CAM)
  const z = dot(d, FWD)
  return [CX + (F * dot(d, RIGHT)) / z, CY - (F * dot(d, UP)) / z, z]
}
const fmt = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
const pts = (list) => list.map((p) => fmt(pr(...p))).join(' ')
const Q = ({ p, ...rest }) => <polygon points={pts(p)} {...rest} />

// point on a plane: origin + s*u + t*v
const plane = (o, u, v) => (s, t) => [o[0] + s * u[0] + t * v[0], o[1] + s * u[1] + t * v[1], o[2] + s * u[2] + t * v[2]]

function Tree({ x, y, h, r, tone = 0 }) {
  const [bx, by, bz] = pr(x, y, 0)
  const [, ty] = pr(x, y, h)
  const k = F / bz // screen px per metre at the trunk
  const R = r * k
  const cy = ty + R * 0.15
  const dark = tone ? '#1d6b57' : '#256b45'
  const mid = tone ? '#3a9a7c' : '#45a06a'
  const light = tone ? '#86d4b5' : '#9be0ae'
  const blobs = [
    [-0.62, 0.3, 0.4], [0.62, 0.28, 0.4], [-0.35, -0.2, 0.48], [0.38, -0.18, 0.46], [0, -0.5, 0.45],
    [-0.15, 0.4, 0.46], [0.3, 0.5, 0.38], [-0.5, 0.52, 0.34], [0, 0.05, 0.55],
  ]
  return (
    <g>
      <ellipse cx={bx + R * 0.55} cy={by + 1} rx={R * 1.05} ry={R * 0.26} fill="#06182a" opacity="0.38" />
      <path d={`M${bx.toFixed(1)},${by.toFixed(1)}L${bx.toFixed(1)},${(cy + R * 0.4).toFixed(1)}`} stroke="#4d392c" strokeWidth={Math.max(2, 0.42 * k)} strokeLinecap="round" />
      {blobs.map(([dx, dy, rr], i) => (
        <circle key={i} cx={bx + dx * R} cy={cy + dy * R * 0.9} r={rr * R} fill={i % 3 === 0 ? mid : dark} />
      ))}
      {blobs.slice(2, 6).map(([dx, dy, rr], i) => (
        <circle key={'h' + i} cx={bx + dx * R - R * 0.1} cy={cy + dy * R * 0.9 - R * 0.12} r={rr * R * 0.55} fill={light} opacity="0.38" />
      ))}
    </g>
  )
}

function Hedge({ x0, x1, y0, y1, h = 0.9 }) {
  const top = '#3f9a63'
  return (
    <g>
      <Q p={[[x0, y0, 0], [x0, y1, 0], [x0, y1, h], [x0, y0, h]]} fill="#1f6a43" />
      <Q p={[[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]]} fill="#2a8052" />
      <Q p={[[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]]} fill={top} />
    </g>
  )
}

function Lamp({ x, y, h = 5 }) {
  const [bx, by, bz] = pr(x, y, 0)
  const [, ty] = pr(x, y, h)
  const k = F / bz
  return (
    <g>
      <line x1={bx} y1={by} x2={bx} y2={ty} stroke="#16324d" strokeWidth={Math.max(1.5, 0.12 * k)} />
      <circle cx={bx} cy={ty} r={0.5 * k} fill="#fff1c2" />
      <circle cx={bx} cy={ty} r={2.2 * k} fill="#ffe9a8" opacity="0.18" />
    </g>
  )
}

export default function BuildingIllustration({ className = '' }) {
  // ------- main glazed block (front facade on plane y = 0) -------
  const FX0 = -5.5
  const FX1 = 9
  const FH = 21
  const bays = 10
  const bayW = (FX1 - FX0) / bays
  const floors = 7
  const fp = plane([FX0, 0, 0], [FX1 - FX0, 0, 0], [0, 0, FH])
  const facadeTL = pr(FX0, 0, FH)
  const facadeBR = pr(FX1, 0, 0)

  const spandrels = []
  const glass = []
  const lit = []
  for (let f = 0; f < floors; f++) {
    const z0 = f * 3
    spandrels.push(
      <Q key={`s${f}`} p={[[FX0, 0, z0], [FX1, 0, z0], [FX1, 0, z0 + 0.95], [FX0, 0, z0 + 0.95]]} fill="#f1f5f8" />,
      <Q key={`sh${f}`} p={[[FX0, 0, z0 + 0.95], [FX1, 0, z0 + 0.95], [FX1, 0, z0 + 1.15], [FX0, 0, z0 + 1.15]]} fill="#06182a" opacity="0.28" />,
    )
    for (let i = 0; i < bays; i++) {
      const x0 = FX0 + i * bayW + 0.12
      const x1 = FX0 + (i + 1) * bayW - 0.04
      const q = [[x0, 0, z0 + 0.95], [x1, 0, z0 + 0.95], [x1, 0, z0 + 3], [x0, 0, z0 + 3]]
      glass.push(<Q key={`g${f}-${i}`} p={q} fill="url(#glassFront)" />)
      if (f > 0 && (f * 3 + i * 5) % 11 === 0) lit.push(<Q key={`l${f}-${i}`} p={q} fill="#ffe3a0" className="bld-lit" style={{ animationDelay: `${(f + i) % 5}s` }} />)
    }
  }
  const fins = []
  for (let i = 0; i <= bays; i++) {
    const x = FX0 + i * bayW - 0.04
    fins.push(
      <Q key={`fl${i}`} p={[[x, -0.45, 0], [x, 0, 0], [x, 0, FH], [x, -0.45, FH]]} fill="#c9d9e6" />,
      <Q key={`ff${i}`} p={[[x, -0.45, 0], [x + 0.17, -0.45, 0], [x + 0.17, -0.45, FH], [x, -0.45, FH]]} fill="#f6f9fb" />,
    )
  }

  // ------- navy core on the left -------
  const CORE = { x0: -9, x1: -5.5, y0: -1.5, y1: 10, h: 23.6 }
  const coreFront = []
  const coreSide = []
  for (let f = 0; f < floors; f++) {
    const z0 = f * 3 + 1.15
    coreFront.push(
      <Q key={`cf${f}`} p={[[-8.5, CORE.y0, z0], [-6.0, CORE.y0, z0], [-6.0, CORE.y0, z0 + 1.35], [-8.5, CORE.y0, z0 + 1.35]]} fill="url(#glassCore)" opacity="0.85" />,
    )
    coreSide.push(
      <Q key={`cs${f}`} p={[[CORE.x0, 1.2, z0], [CORE.x0, 8.6, z0], [CORE.x0, 8.6, z0 + 1.35], [CORE.x0, 1.2, z0 + 1.35]]} fill="url(#glassCore)" opacity="0.8" />,
    )
  }

  // ------- lobby + canopy -------
  const LB = { x0: 0.5, x1: 8.5, y0: -6, y1: 0, h: 5.4 }
  const lobbyFront = []
  for (let i = 0; i <= 8; i++) {
    const x = LB.x0 + i
    lobbyFront.push(<line key={`m${i}`} x1={pr(x, LB.y0, 0)[0]} y1={pr(x, LB.y0, 0)[1]} x2={pr(x, LB.y0, LB.h)[0]} y2={pr(x, LB.y0, LB.h)[1]} stroke="#f2f7fb" strokeWidth="2.2" opacity="0.9" />)
  }

  const ground = (
    <g mask="url(#groundFade)">
      <polygon points={pts([[-46, -24, 0], [58, -24, 0], [58, 40, 0], [-46, 40, 0]])} fill="url(#pave)" />
      {/* lawns */}
      <polygon points={pts([[-34, -16, 0], [-6.5, -16, 0], [-6.5, -4.2, 0], [-34, -4.2, 0]])} fill="url(#lawn)" />
      <polygon points={pts([[10.5, -17, 0], [40, -17, 0], [40, -3, 0], [10.5, -3, 0]])} fill="url(#lawn)" />
      {/* walkway to the entrance */}
      <polygon points={pts([[2.6, -24, 0], [6.4, -24, 0], [6.4, -6, 0], [2.6, -6, 0]])} fill="#f7fbfe" />
      {[-22, -18, -14, -10, -7].map((y) => (
        <polygon key={y} points={pts([[2.6, y, 0], [6.4, y, 0], [6.4, y + 0.12, 0], [2.6, y + 0.12, 0]])} fill="#b9ccdb" opacity="0.8" />
      ))}
      <polygon points={pts([[2.4, -24, 0], [2.6, -24, 0], [2.6, -6, 0], [2.4, -6, 0]])} fill="#8fb7d1" />
      <polygon points={pts([[6.4, -24, 0], [6.6, -24, 0], [6.6, -6, 0], [6.4, -6, 0]])} fill="#8fb7d1" />
      {/* soft contact shadow under the building */}
      <g filter="url(#blur8)" opacity="0.42">
        <polygon points={pts([[-9.6, -2.2, 0], [-0.5, -2.2, 0], [0, -7, 0], [9.8, -7.5, 0], [11.5, 1.5, 0], [-9, 11, 0]])} fill="#041526" />
      </g>
      {/* warm light pooling in front of the entrance */}
      <ellipse cx={pr(4.5, -9.5, 0)[0]} cy={pr(4.5, -9.5, 0)[1]} rx="130" ry="26" fill="#ffd98a" opacity="0.3" className="bld-lit" />
    </g>
  )

  return (
    <svg
      className={`bld ${className}`}
      viewBox="0 0 800 640"
      role="img"
      aria-label="ภาพประกอบเชิงแนวคิดของอาคารสำนักงานสมัยใหม่"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="glassFront" gradientUnits="userSpaceOnUse" x1={facadeTL[0]} y1={facadeTL[1]} x2={facadeBR[0]} y2={facadeBR[1]}>
          <stop offset="0" stopColor="#d9f1fb" />
          <stop offset="0.3" stopColor="#8fd0ee" />
          <stop offset="0.65" stopColor="#4b94c4" />
          <stop offset="1" stopColor="#235f90" />
        </linearGradient>
        <linearGradient id="glassCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7cc9e8" />
          <stop offset="1" stopColor="#2b6f9f" />
        </linearGradient>
        <linearGradient id="navyFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23547d" />
          <stop offset="1" stopColor="#102d4a" />
        </linearGradient>
        <linearGradient id="navySide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173f64" />
          <stop offset="1" stopColor="#0a2238" />
        </linearGradient>
        <linearGradient id="lobbyGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fcbe8" />
          <stop offset="0.55" stopColor="#d9ecf5" />
          <stop offset="1" stopColor="#ffe6a6" />
        </linearGradient>
        <linearGradient id="pave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#aac6da" />
          <stop offset="1" stopColor="#e9f1f7" />
        </linearGradient>
        <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f946a" />
          <stop offset="1" stopColor="#62b886" />
        </linearGradient>
        <linearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="fade" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id="groundFade" maskUnits="userSpaceOnUse" x="0" y="300" width="800" height="340">
          <ellipse cx="440" cy="492" rx="400" ry="128" fill="url(#fade)" />
        </mask>
        <linearGradient id="sideFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.12" stopColor="#fff" />
          <stop offset="0.9" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id="sceneFade" maskUnits="userSpaceOnUse" x="0" y="0" width="800" height="640">
          <rect width="800" height="640" fill="url(#sideFade)" />
        </mask>
        <clipPath id="facadeClip">
          <polygon points={pts([[FX0, 0, 0], [FX1, 0, 0], [FX1, 0, FH], [FX0, 0, FH]])} />
        </clipPath>
        <filter id="blur8" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      <g mask="url(#sceneFade)">
      <g className="bld-float">
        {ground}

        {/* back-left tree sits behind the core */}
        <Tree x={-16} y={4} h={7} r={3} />

        {/* ===== main glazed block ===== */}
        <Q p={[[FX0, 0, 0], [FX1, 0, 0], [FX1, 0, FH], [FX0, 0, FH]]} fill="#dbe6ee" />
        {spandrels}
        {glass}
        {lit}
        {/* sky reflection streaks across the curtain wall */}
        <g clipPath="url(#facadeClip)">
          <polygon points={`${fmt(fp(0.1, 1.0))} ${fmt(fp(0.26, 1.0))} ${fmt(fp(0.02, 0))} ${fmt(fp(-0.14, 0))}`} fill="url(#streak)" transform="translate(40 0)" />
          <polygon points={`${fmt(fp(0.4, 1.0))} ${fmt(fp(0.5, 1.0))} ${fmt(fp(0.32, 0))} ${fmt(fp(0.22, 0))}`} fill="url(#streak)" transform="translate(40 0)" />
          <polygon points={`${fmt(fp(0.72, 1.0))} ${fmt(fp(0.82, 1.0))} ${fmt(fp(0.64, 0))} ${fmt(fp(0.54, 0))}`} fill="url(#streak)" transform="translate(40 0)" />
        </g>
        {fins}
        {/* parapet */}
        <Q p={[[FX0, -0.5, FH], [FX1, -0.5, FH], [FX1, -0.5, FH + 0.9], [FX0, -0.5, FH + 0.9]]} fill="#f7fafc" />
        <Q p={[[FX0, -0.5, FH], [FX0, 0.5, FH], [FX0, 0.5, FH + 0.9], [FX0, -0.5, FH + 0.9]]} fill="#cfdde8" />

        {/* ===== navy core ===== */}
        <Q p={[[CORE.x0, CORE.y0, 0], [CORE.x0, CORE.y1, 0], [CORE.x0, CORE.y1, CORE.h], [CORE.x0, CORE.y0, CORE.h]]} fill="url(#navySide)" />
        <Q p={[[CORE.x0, CORE.y0, 0], [CORE.x1, CORE.y0, 0], [CORE.x1, CORE.y0, CORE.h], [CORE.x0, CORE.y0, CORE.h]]} fill="url(#navyFront)" />
        {coreSide}
        {coreFront}
        <Q p={[[CORE.x0, CORE.y0, CORE.h - 0.5], [CORE.x1, CORE.y0, CORE.h - 0.5], [CORE.x1, CORE.y0, CORE.h], [CORE.x0, CORE.y0, CORE.h]]} fill="#e8f0f6" />

        {/* ===== lobby ===== */}
        <Q p={[[LB.x0, LB.y1, 0], [LB.x0, LB.y0, 0], [LB.x0, LB.y0, LB.h], [LB.x0, LB.y1, LB.h]]} fill="#7fb4d3" />
        <Q p={[[LB.x0, LB.y0, 0], [LB.x1, LB.y0, 0], [LB.x1, LB.y0, LB.h], [LB.x0, LB.y0, LB.h]]} fill="url(#lobbyGlass)" />
        {lobbyFront}
        <Q p={[[4.0, LB.y0, 0], [5.0, LB.y0, 0], [5.0, LB.y0, 3.1], [4.0, LB.y0, 3.1]]} fill="#12395c" opacity="0.55" />
        <Q p={[[LB.x0, LB.y0, 0.05], [LB.x1, LB.y0, 0.05], [LB.x1, LB.y0, 0.4], [LB.x0, LB.y0, 0.4]]} fill="#0f3354" />
        {/* canopy */}
        <Q p={[[-0.4, -7.2, 5.4], [9.4, -7.2, 5.4], [9.4, -7.2, 6.05], [-0.4, -7.2, 6.05]]} fill="#fbfdff" />
        <Q p={[[-0.4, 0, 5.4], [-0.4, -7.2, 5.4], [-0.4, -7.2, 6.05], [-0.4, 0, 6.05]]} fill="#c3d5e3" />
        <Q p={[[-0.4, -7.2, 5.4], [9.4, -7.2, 5.4], [9.4, -7.2, 5.55], [-0.4, -7.2, 5.55]]} fill="#06182a" opacity="0.25" />
        {[1.2, 7.8].map((x) => (
          <g key={x}>
            <Q p={[[x, -6.8, 0], [x, -6.45, 0], [x, -6.45, 5.4], [x, -6.8, 5.4]]} fill="#c9d9e6" />
            <Q p={[[x, -6.8, 0], [x + 0.35, -6.8, 0], [x + 0.35, -6.8, 5.4], [x, -6.8, 5.4]]} fill="#f6f9fb" />
          </g>
        ))}

        {/* ===== landscaping in front ===== */}
        <Hedge x0={-5.2} x1={-0.2} y0={-3.4} y1={-2.2} />
        <Hedge x0={9.2} x1={13.6} y0={-3.4} y1={-2.2} />
        <Lamp x={1.6} y={-13} />
        <Lamp x={7.4} y={-13} />
        <Tree x={-18} y={-7} h={7} r={3} />
        <Tree x={-24} y={-13} h={7.5} r={3.3} tone={1} />
        <Tree x={15} y={-6} h={7} r={3} />
        <Tree x={20} y={-12} h={7.6} r={3.3} tone={1} />
        <Tree x={-9.5} y={-11} h={4.2} r={1.7} tone={1} />
      </g>
      </g>
    </svg>
  )
}
