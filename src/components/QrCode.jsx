import { useMemo } from 'react'

// Gösterim amaçlı QR deseni: konum işaretleri gerçek QR gibi, veri modülleri
// içerikten türetilen sözde rastgele bir dizi. Telefon kamerasıyla okunmaz.
const N = 25

function seedOf(text) {
  let h = 2166136261
  for (const ch of text) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inFinderZone = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8)

function finderOn(x, y) {
  const fx = x >= N - 8 ? x - (N - 7) : x
  const fy = y >= N - 8 ? y - (N - 7) : y
  if (fx < 0 || fy < 0 || fx > 6 || fy > 6) return false // beyaz ayraç
  return Math.max(Math.abs(fx - 3), Math.abs(fy - 3)) !== 2
}

export default function QrCode({ value, size = 150 }) {
  const cells = useMemo(() => {
    const rnd = mulberry32(seedOf(value))
    const on = []
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dark = inFinderZone(x, y) ? finderOn(x, y) : y === 6 || x === 6 ? (x + y) % 2 === 0 : rnd() < 0.5
        if (dark) on.push([x, y])
      }
    return on
  }, [value])

  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${N + 4} ${N + 4}`} role="img" aria-label="Kartsız işlem QR kodu" shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={N + 4} height={N + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0a1b2a" />
      ))}
    </svg>
  )
}
