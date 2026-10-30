import { money } from '../api'

const CAPACITY = { 200: 60, 100: 80, 50: 100, 20: 60 }

export default function StatusPanel({ cassettes, ledgers, cards, active }) {
  return (
    <div className="panel status">
      <div className="status-col">
        <div className="panel-head">
          <h3>Kasetler</h3>
          <span className="panel-meta">CDM / recycler</span>
        </div>
        <ul className="cassettes">
          {Object.keys(CAPACITY)
            .sort((a, b) => b - a)
            .map((d) => {
              const n = cassettes[d] ?? 0
              const pct = Math.min(100, Math.round((n / CAPACITY[d]) * 100))
              const level = pct < 15 ? 'low' : pct < 40 ? 'mid' : 'ok'
              return (
                <li key={d}>
                  <span className="cas-denom">{d} ₺</span>
                  <span className="cas-bar">
                    <span className={`cas-fill ${level}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="cas-count">{n} adet</span>
                </li>
              )
            })}
        </ul>
      </div>
      <div className="status-col">
        <div className="panel-head">
          <h3>Hesaplar</h3>
          <span className="panel-meta">Core banking defteri</span>
        </div>
        <ul className="ledger">
          {cards.map((c) => (
            <li key={c.id} className={active === c.id ? 'active' : ''}>
              <span className="led-name">{c.holder}</span>
              <span className="led-bal">{money(ledgers[c.id]?.balance ?? 0)}</span>
              <span className="led-sub">Bugün çekilen {money(ledgers[c.id]?.daily_withdrawn ?? 0)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
