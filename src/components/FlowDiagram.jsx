// Şemadaki "Bank / Host Systems" bölümünün canlı hali.
const NODES = {
  atm: { x: 70, y: 150, label: 'ATM', sub: 'APTRA + XFS' },
  switch: { x: 210, y: 150, label: 'ATM Switch', sub: 'NDC / ISO 8583' },
  bkm: { x: 350, y: 48, label: 'BKM', sub: 'Bankalar arası' },
  issuer: { x: 500, y: 48, label: 'Karşı Banka', sub: 'Issuer / alıcı' },
  fast: { x: 350, y: 118, label: 'FAST / EFT', sub: 'TCMB ödeme sist.' },
  interapi: { x: 350, y: 190, label: 'InterAPI', sub: 'Entegrasyon' },
  hsm: { x: 500, y: 118, label: 'HSM', sub: 'PIN doğrulama' },
  fraud: { x: 500, y: 182, label: 'Fraud', sub: 'Risk skoru' },
  core: { x: 500, y: 246, label: 'Core Banking', sub: 'Hesap / defter' },
  cards: { x: 500, y: 310, label: 'Kart Sistemi', sub: 'Limit / borç' },
  biller: { x: 350, y: 290, label: 'Fatura Kurumu', sub: 'Kurum API' },
  mobile: { x: 190, y: 268, label: 'Mobil Banka', sub: 'Uygulama + API' },
}
const EDGES = [
  ['atm', 'switch'],
  ['switch', 'bkm'],
  ['bkm', 'issuer'],
  ['switch', 'interapi'],
  ['interapi', 'hsm'],
  ['interapi', 'fraud'],
  ['interapi', 'core'],
  ['interapi', 'biller'],
  ['interapi', 'cards'],
  ['interapi', 'fast'],
  ['fast', 'issuer'],
  ['mobile', 'interapi'],
]
const W = 116
const H = 44

function edgePath(a, b) {
  const p = NODES[a]
  const q = NODES[b]
  const x1 = p.x + W / 2
  const x2 = q.x - W / 2
  if (Math.abs(p.y - q.y) < 2) return `M${x1},${p.y} L${x2},${q.y}`
  if (Math.abs(p.x - q.x) < 2) {
    const down = q.y > p.y
    return `M${p.x},${p.y + (down ? H / 2 : -H / 2)} L${q.x},${q.y + (down ? -H / 2 : H / 2)}`
  }
  const mx = (x1 + x2) / 2
  return `M${x1},${p.y} C${mx},${p.y} ${mx},${q.y} ${x2},${q.y}`
}

export default function FlowDiagram({ hops, meta }) {
  const { list, active } = hops
  const key = (a, b) => `${a}>${b}`
  const done = new Set(list.slice(0, Math.max(active, 0)).map((h) => key(h.from, h.to)))
  const current = active >= 0 && active < list.length ? list[active] : null
  const touched = new Set(list.slice(0, active + 1).flatMap((h) => [h.from, h.to]))

  return (
    <div className="panel flow">
      <div className="panel-head">
        <h3>Mesaj akışı</h3>
        <span className="panel-meta">{meta}</span>
      </div>
      <div className="flow-now" aria-live="polite">
        {current ? (
          <>
            <b>
              {NODES[current.from].label} → {NODES[current.to].label}
            </b>
            <span>
              {current.proto} · {current.ms} ms
            </span>
          </>
        ) : list.length ? (
          <span>Son işlem: {list.length} adım, toplam {list.reduce((s, h) => s + h.ms, 0)} ms</span>
        ) : (
          <span>Bir kart takıp işlem başlattığınızda istekler burada adım adım ilerler.</span>
        )}
      </div>
      <div className="flow-scroll">
        <svg viewBox="0 0 570 340" className="flow-svg" role="img" aria-label="ATM ile banka sistemleri arasındaki mesaj akışı">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--line-strong)" />
            </marker>
            <marker id="arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
            </marker>
          </defs>
          {EDGES.map(([a, b]) => {
            const k = key(a, b)
            const isNow = current && key(current.from, current.to) === k
            const cls = isNow ? 'edge now' : done.has(k) ? 'edge done' : 'edge'
            return (
              <path key={k} d={edgePath(a, b)} className={cls} markerEnd={isNow || done.has(k) ? 'url(#arrow-on)' : 'url(#arrow)'} />
            )
          })}
          {Object.entries(NODES).map(([id, n]) => {
            const isNow = current && (current.to === id || current.from === id)
            return (
              <g key={id} className={`node ${touched.has(id) ? 'touched' : ''} ${isNow ? 'now' : ''}`} transform={`translate(${n.x - W / 2},${n.y - H / 2})`}>
                <rect width={W} height={H} rx="8" />
                <text x={W / 2} y="19" textAnchor="middle" className="n-label">
                  {n.label}
                </text>
                <text x={W / 2} y="34" textAnchor="middle" className="n-sub">
                  {n.sub}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
