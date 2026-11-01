import { useId, useState } from 'react'

// Eğitim sayfalarının ortak yapı taşları: sequence diyagramı, akış şeması, sekmeler, tablo, bilgi kutusu.

const CH = 6.4 // 12px yazıda yaklaşık karakter genişliği

const MARKERS = [
  ['n', 'var(--muted)'],
  ['ok', 'var(--accent)'],
  ['bad', 'var(--bad)'],
  ['warn', 'var(--warn)'],
]

/**
 * Sequence (sıra) diyagramı.
 *   actors: [{ id, label, sub? }]
 *   steps:  { sep }                                   bölüm çizgisi
 *           { from, to, label, sub?, tone?, res?, lost? }   mesaj (from === to ise kendi üzerine)
 *           { note, at | span: [a, b], tone? }        not kutusu
 *   label/note içinde \n satır kırar. tone: ok | bad | warn. res: kesikli (yanıt). lost: mesaj yolda kaybolur.
 */
export function Sequence({ actors, steps, label }) {
  const uid = useId().replace(/:/g, '')
  const n = actors.length
  const gap = n <= 2 ? 300 : n === 3 ? 250 : n === 4 ? 205 : 175
  const x0 = 90
  const xs = Object.fromEntries(actors.map((a, i) => [a.id, x0 + i * gap]))
  const right0 = x0 + (n - 1) * gap + 90
  let minX = 0
  let maxX = right0
  const grow = (a, b) => {
    minX = Math.min(minX, a)
    maxX = Math.max(maxX, b)
  }
  const LH = 15
  const items = []
  let y = 66

  steps.forEach((s, i) => {
    if (s.sep) {
      items.push(
        <g key={i} className="seq-sep">
          <text x={10} y={y + 12}>
            {s.sep}
          </text>
          <line x1={10} x2={right0 - 10} y1={y + 18} y2={y + 18} />
        </g>,
      )
      y += 36
      return
    }
    if (s.note) {
      const lines = s.note.split('\n')
      const ids = s.span ?? [s.at]
      const xa = xs[ids[0]]
      const xb = xs[ids[ids.length - 1]]
      const cx = (xa + xb) / 2
      const w = Math.max(Math.max(...lines.map((l) => l.length)) * CH + 26, Math.abs(xb - xa) + 70)
      const h = lines.length * LH + 12
      grow(cx - w / 2 - 4, cx + w / 2 + 4)
      items.push(
        <g key={i} className={`seq-note ${s.tone ?? ''}`}>
          <rect x={cx - w / 2} y={y} width={w} height={h} rx="6" />
          {lines.map((l, k) => (
            <text key={k} x={cx} y={y + 18 + k * LH} textAnchor="middle">
              {l}
            </text>
          ))}
        </g>,
      )
      y += h + 12
      return
    }
    const lines = String(s.label).split('\n')
    const tone = s.tone ?? 'n'
    const cls = `seq-msg ${s.tone ?? ''} ${s.res ? 'res' : ''}`
    if (s.from === s.to) {
      const x = xs[s.from]
      const top = y + 8
      const tx = x + 50
      grow(0, tx + Math.max(...lines.map((l) => l.length)) * CH + 10)
      items.push(
        <g key={i}>
          <path d={`M${x},${top} h42 v26 h-42`} className={cls} markerEnd={`url(#${uid}-${tone})`} />
          {lines.map((l, k) => (
            <text key={k} x={tx} y={top + 12 + k * LH} className="seq-text">
              {l}
            </text>
          ))}
        </g>,
      )
      y = top + Math.max(40, lines.length * LH + 14) + 6
      return
    }
    const x1 = xs[s.from]
    const x2 = xs[s.to]
    const dir = Math.sign(x2 - x1)
    const arrowY = y + lines.length * LH + 8
    const xe = s.lost ? x1 + (x2 - x1) * 0.6 : x2 - dir * 1
    const cx = (x1 + x2) / 2
    items.push(
      <g key={i}>
        {lines.map((l, k) => (
          <text key={k} x={cx} y={y + 12 + k * LH} textAnchor="middle" className="seq-text">
            {l}
          </text>
        ))}
        <path d={`M${x1 + dir * 3},${arrowY} L${xe},${arrowY}`} className={cls} markerEnd={s.lost ? undefined : `url(#${uid}-${tone})`} />
        {s.lost && (
          <text x={xe + dir * 12} y={arrowY + 5} textAnchor="middle" className="seq-lost">
            ✕
          </text>
        )}
        {s.sub && (
          <text x={cx} y={arrowY + 15} textAnchor="middle" className="seq-sub">
            {s.sub}
          </text>
        )}
      </g>,
    )
    y = arrowY + (s.sub ? 24 : 14)
  })

  const H = y + 10
  const width = maxX - minX
  return (
    <figure className="seq">
      <div className="seq-scroll">
        <svg
          viewBox={`${minX} 0 ${width} ${H}`}
          className="seq-svg"
          style={{ minWidth: Math.round(width * 0.8) }}
          role="img"
          aria-label={label}
        >
          <defs>
            {MARKERS.map(([k, c]) => (
              <marker key={k} id={`${uid}-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" style={{ fill: c }} />
              </marker>
            ))}
          </defs>
          {actors.map((a) => (
            <line key={a.id} x1={xs[a.id]} x2={xs[a.id]} y1={50} y2={H - 6} className="seq-life" />
          ))}
          {items}
          {actors.map((a) => (
            <g key={a.id} className="seq-actor">
              <rect x={xs[a.id] - 70} y={6} width={140} height={44} rx="8" />
              <text x={xs[a.id]} y={a.sub ? 24 : 32} textAnchor="middle" className="a-label">
                {a.label}
              </text>
              {a.sub && (
                <text x={xs[a.id]} y={40} textAnchor="middle" className="a-sub">
                  {a.sub}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}

/**
 * Dikey akış şeması. Her öğe: { title, tag?, text?, decision?, branches?: [{ label, text, tone? }] }
 */
export function Flow({ items, startAt = 1 }) {
  let n = startAt - 1
  return (
    <ol className="tr-flow">
      {items.map((it, i) => {
        if (!it.decision) n += 1
        return (
          <li key={i} className={it.decision ? 'dec' : ''}>
            <span className="tr-flow-n" aria-hidden="true">
              {it.decision ? '?' : n}
            </span>
            <div className="tr-flow-card">
              <div className="tr-flow-head">
                <b>{it.title}</b>
                {it.tag && <code>{it.tag}</code>}
              </div>
              {it.text && <p>{it.text}</p>}
              {it.branches && (
                <div className="tr-branches">
                  {it.branches.map((b, k) => (
                    <div key={k} className={`tr-branch ${b.tone ?? ''}`}>
                      <span>{b.label}</span>
                      {b.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Erişilebilir sekmeler (ok tuşlarıyla gezilir). tabs: [{ label, content }] */
export function Tabs({ tabs, label }) {
  const [i, setI] = useState(0)
  const id = useId().replace(/:/g, '')
  const onKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
    setI(next)
    document.getElementById(`${id}-t${next}`)?.focus()
  }
  return (
    <div className="tr-tabs">
      <div role="tablist" aria-label={label} className="tr-tablist" onKeyDown={onKey}>
        {tabs.map((t, k) => (
          <button
            key={t.label}
            id={`${id}-t${k}`}
            type="button"
            role="tab"
            aria-selected={k === i}
            aria-controls={`${id}-p${k}`}
            tabIndex={k === i ? 0 : -1}
            onClick={() => setI(k)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} className="tr-tabpanel">
        {tabs[i].content}
      </div>
    </div>
  )
}

export function Table({ head, rows }) {
  return (
    <div className="tr-tablewrap">
      <table className="tr-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Callout({ tone = 'info', title, children }) {
  return (
    <aside className={`tr-callout ${tone}`}>
      {title && <b>{title}</b>}
      <div>{children}</div>
    </aside>
  )
}

/** Numaralı açıklama listesi (diyagramın altında adım adım anlatım). */
export function Notes({ items }) {
  return (
    <ol className="tr-notes">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  )
}

export function Sim({ children = 'simülatörde' }) {
  return <span className="tr-sim">{children}</span>
}

export function TryInSim({ children }) {
  return (
    <p className="tr-try">
      <span>Simülatörde dene</span>
      <span>{children}</span>
      <a className="ghost small" href="#/">
        Simülatöre git →
      </a>
    </p>
  )
}

export function PageHead({ eyebrow, title, lead }) {
  return (
    <header className="tr-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="tr-lead">{lead}</p>
    </header>
  )
}

/** Kod bloğu (klavye ile kaydırılabilir). */
export function Code({ title, children }) {
  return (
    <figure className="tr-codefig">
      {title && <figcaption>{title}</figcaption>}
      <pre className="tr-code" tabIndex={0}>
        <code>{children}</code>
      </pre>
    </figure>
  )
}

/**
 * UML sınıf diyagramı (elle yerleşimli).
 *   classes: [{ id, x, y, w, name, stereo?, abstract?, attrs?: [], methods?: [] }]
 *   links:   [{ from, to, kind: 'extends' | 'implements' | 'composes' | 'uses', label? }]
 * extends/implements: from = alt sınıf, uç ok üst sınıfa. composes: from = bütün (elmas), to = parça.
 */
export function ClassDiagram({ classes, links, width, height, label }) {
  const uid = useId().replace(/:/g, '')
  const LH = 15
  const box = Object.fromEntries(
    classes.map((c) => {
      const attrs = c.attrs ?? []
      const methods = c.methods ?? []
      const head = 28 + (c.stereo ? 14 : 0)
      const h = head + (attrs.length ? attrs.length * LH + 8 : 0) + (methods.length ? methods.length * LH + 8 : 0) + (attrs.length || methods.length ? 0 : 6)
      return [c.id, { ...c, attrs, methods, head, h }]
    }),
  )
  const anchor = (a, b) => {
    const A = box[a]
    const B = box[b]
    const acx = A.x + A.w / 2
    const bcx = B.x + B.w / 2
    if (A.y + A.h < B.y - 4) return [[acx, A.y + A.h], [bcx, B.y]]
    if (B.y + B.h < A.y - 4) return [[acx, A.y], [bcx, B.y + B.h]]
    return A.x < B.x ? [[A.x + A.w, A.y + A.h / 2], [B.x, B.y + B.h / 2]] : [[A.x, A.y + A.h / 2], [B.x + B.w, B.y + B.h / 2]]
  }
  return (
    <figure className="seq">
      <div className="seq-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} className="seq-svg" style={{ minWidth: Math.round(width * 0.8) }} role="img" aria-label={label}>
          <defs>
            <marker id={`${uid}-tri`} viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto">
              <path d="M1,1 L11,6 L1,11 z" className="cd-tri" />
            </marker>
            <marker id={`${uid}-dia`} viewBox="0 0 14 10" refX="0" refY="5" markerWidth="13" markerHeight="10" orient="auto-start-reverse">
              <path d="M0,5 L6,1 L12,5 L6,9 z" className="cd-dia" />
            </marker>
            <marker id={`${uid}-open`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M1,1 L9,5 L1,9" className="cd-open" />
            </marker>
          </defs>
          {links.map((l, i) => {
            const [[x1, y1], [x2, y2]] = anchor(l.from, l.to)
            const dash = l.kind === 'implements' || l.kind === 'uses'
            const mark = l.kind === 'composes' ? { markerStart: `url(#${uid}-dia)` } : { markerEnd: `url(#${uid}-${l.kind === 'uses' ? 'open' : 'tri'})` }
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} className={`cd-link ${dash ? 'dash' : ''}`} {...mark} />
                {l.label && (
                  <text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2 - 4} className="seq-sub">
                    {l.label}
                  </text>
                )}
              </g>
            )
          })}
          {Object.values(box).map((c) => (
            <g key={c.id} className="cd-box">
              <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="6" />
              <rect x={c.x} y={c.y} width={c.w} height={c.head} rx="6" className="cd-head" />
              {c.stereo && (
                <text x={c.x + c.w / 2} y={c.y + 15} textAnchor="middle" className="cd-stereo">
                  {`«${c.stereo}»`}
                </text>
              )}
              <text x={c.x + c.w / 2} y={c.y + (c.stereo ? 29 : 19)} textAnchor="middle" className={`cd-name ${c.abstract ? 'abs' : ''}`}>
                {c.name}
              </text>
              {c.attrs.map((t, k) => (
                <text key={`a${k}`} x={c.x + 8} y={c.y + c.head + 15 + k * LH} className="cd-text">
                  {t}
                </text>
              ))}
              {c.attrs.length > 0 && c.methods.length > 0 && <line x1={c.x} x2={c.x + c.w} y1={c.y + c.head + c.attrs.length * LH + 6} y2={c.y + c.head + c.attrs.length * LH + 6} className="cd-sep" />}
              {c.methods.map((t, k) => (
                <text key={`m${k}`} x={c.x + 8} y={c.y + c.head + (c.attrs.length ? c.attrs.length * LH + 8 : 0) + 15 + k * LH} className="cd-text">
                  {t}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
