import { useEffect, useRef, useState } from 'react'

const LAYERS = {
  xfs: { tag: 'XFS', title: 'Cihaz katmanı' },
  host: { tag: 'HOST', title: 'Ağ / servis adımı' },
  iso: { tag: 'ISO', title: 'ISO 8583 mesajı' },
  info: { tag: 'INFO', title: 'Bilgi' },
}
const FIELD_NAMES = {
  2: 'PAN',
  3: 'İşlem kodu',
  4: 'Tutar',
  7: 'İletim zamanı',
  11: 'STAN',
  12: 'Yerel saat',
  13: 'Yerel tarih',
  15: 'Mutabakat tarihi',
  28: 'İşlem ücreti',
  37: 'RRN',
  38: 'Onay kodu',
  39: 'Yanıt kodu',
  41: 'Terminal ID',
  48: 'Ek veri',
  49: 'Para birimi',
  52: 'PIN bloğu',
  50: 'Mutabakat para birimi',
  54: 'Bakiye',
  74: 'Alacak adedi',
  76: 'Borç adedi',
  86: 'Alacak tutarı',
  88: 'Borç tutarı',
  90: 'Orijinal işlem',
  97: 'Net tutar',
  100: 'Alıcı kurum',
  103: 'Alacaklı hesap',
}

export default function EventLog({ entries }) {
  const [filter, setFilter] = useState('all')
  const box = useRef(null)
  const shown = filter === 'all' ? entries : entries.filter((e) => e.layer === filter)

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [shown.length])

  return (
    <div className="panel log">
      <div className="panel-head">
        <h3>Olay günlüğü</h3>
        <div className="filters" role="tablist">
          {['all', 'xfs', 'host', 'iso'].map((f) => (
            <button
              type="button"
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={`chip ${filter === f ? 'on' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Tümü' : LAYERS[f].tag}
            </button>
          ))}
        </div>
      </div>
      <ol className="log-list" ref={box}>
        {shown.length === 0 && <li className="log-empty">Henüz olay yok. Cüzdandan bir kart takın.</li>}
        {shown.map((e) => (
          <li key={e.id} className={`log-item ${e.layer}`}>
            <span className="log-time">{e.time}</span>
            <span className={`log-tag ${e.layer}`} title={LAYERS[e.layer].title}>
              {LAYERS[e.layer].tag}
            </span>
            <div className="log-body">
              <span className="log-text">{e.text}</span>
              {typeof e.detail === 'string' && <span className="log-detail">{e.detail}</span>}
              {e.detail && typeof e.detail === 'object' && (
                <details>
                  <summary>Alanlar ({Object.keys(e.detail).length})</summary>
                  <table className="iso-table">
                    <tbody>
                      {Object.entries(e.detail).map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{FIELD_NAMES[k] || ''}</td>
                          <td>{v || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
