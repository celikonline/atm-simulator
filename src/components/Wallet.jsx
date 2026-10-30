const PINS = { '4543-0001': '1234', '9792-0042': '4321', '5170-7788': '0000' }

export default function Wallet({ cards, active, retained, disabled, onInsert }) {
  return (
    <div className="wallet">
      <p className="wallet-title">Cüzdan · takmak için bir karta tıklayın</p>
      <div className="wallet-cards">
        {cards.map((c) => {
          const isRetained = retained[c.id]
          const inUse = active === c.id
          return (
            <button
              type="button"
              key={c.id}
              className={`plastic ${c.scheme.toLowerCase()} ${inUse ? 'in-use' : ''}`}
              disabled={disabled || isRetained || inUse}
              onClick={() => onInsert(c)}
            >
              <span className="plastic-top">
                <span className="chip-ic" aria-hidden="true" />
                <span className="plastic-scheme">{c.scheme}</span>
              </span>
              <span className="plastic-pan">{c.pan_masked}</span>
              <span className="plastic-foot">
                <span>{c.holder}</span>
                <span className="plastic-pin">{isRetained ? 'ALIKONULDU' : inUse ? 'ATM’DE' : `PIN ${PINS[c.id]}`}</span>
              </span>
              {c.issuer === 'other' && <span className="plastic-flag">Başka banka</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
