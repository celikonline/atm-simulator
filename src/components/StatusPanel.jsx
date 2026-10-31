import { money } from '../api'

export const CAPACITY = { 200: 60, 100: 80, 50: 100, 20: 60 }

export default function StatusPanel({ cassettes, terminalId, ledgers, cards, active }) {
  return (
    <div className="panel status">
      <div className="status-col">
        <div className="panel-head">
          <h3>Kasetler</h3>
          <span className="panel-meta">CDM / recycler · {terminalId}</span>
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
          <span className="panel-meta">Banka defterleri</span>
        </div>
        <ul className="ledger">
          {cards.map((c) => {
            const l = ledgers[c.id] ?? {}
            const credit = c.type === 'credit'
            return (
              <li key={c.id} className={active === c.id ? 'active' : ''}>
                <span className="led-name">
                  {c.holder}
                  <small>{credit ? `${c.bank_name} · kredi kartı` : c.bank_name}</small>
                </span>
                <span className="led-bal">{money(credit ? l.debt : l.balance ?? 0)}</span>
                <span className="led-sub">
                  {credit
                    ? `Borç · limit ${money(l.limit)}, kullanılabilir ${money(l.limit - l.debt)}`
                    : `Bugün çekilen ${money(l.daily_withdrawn ?? 0)}`}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
