const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '']

function Led({ on }) {
  return <span className={`led ${on ? 'on' : ''}`} aria-hidden="true" />
}

export default function AtmMachine({
  children,
  brand,
  terminalId,
  device,
  cardIn,
  cardOut,
  cashOut,
  receipt,
  onTakeCard,
  onTakeCash,
  onTakeReceipt,
  onDigit,
  onEnter,
  onClear,
  onCancel,
}) {
  const noteList = cashOut
    ? Object.entries(cashOut)
        .sort((a, b) => b[0] - a[0])
        .flatMap(([d, n]) => Array.from({ length: Math.min(n, 4) }, (_, i) => `${d}-${i}`))
    : []

  return (
    <div className="atm" aria-label="ATM önden görünüm">
      <div className="atm-head">
        <span className="atm-brand">{brand.toLocaleUpperCase('tr-TR')}</span>
        <span className="atm-model">SelfServ 84</span>
      </div>

      <div className="atm-bezel">
        <div className="atm-screen">{children}</div>
      </div>

      <div className="atm-deck">
        {/* Fiş yazıcı */}
        <div className="slot-group printer">
          <span className="slot-label">
            <Led on={device === 'ptr'} /> Fiş
          </span>
          <div className="slot thin">
            {receipt && (
              <button type="button" className="receipt" onClick={onTakeReceipt} title="Fişi al">
                <strong>{brand.toLocaleUpperCase('tr-TR')}</strong>
                <span>
                  {terminalId} · {receipt.date}
                </span>
                <span>{receipt.card}</span>
                <hr />
                {receipt.lines.map(([k, v]) => (
                  <span key={k} className="r-line">
                    <em>{k}</em>
                    <b>{v}</b>
                  </span>
                ))}
                <hr />
                <span className="r-foot">Fişi almak için tıklayın</span>
              </button>
            )}
          </div>
        </div>

        {/* EPP / PIN pad */}
        <div className={`epp ${device === 'pin' ? 'active' : ''}`}>
          <div className="epp-hood" aria-hidden="true" />
          <div className="epp-keys">
            {KEYS.map((k, i) =>
              k ? (
                <button type="button" key={i} className="key" onClick={() => onDigit(k)}>
                  {k}
                </button>
              ) : (
                <span key={i} className="key blank" aria-hidden="true" />
              ),
            )}
          </div>
          <div className="epp-fn">
            <button type="button" className="key fn cancel" onClick={onCancel}>
              İPTAL
            </button>
            <button type="button" className="key fn clear" onClick={onClear}>
              DÜZELT
            </button>
            <button type="button" className="key fn enter" onClick={onEnter}>
              ONAY
            </button>
          </div>
        </div>

        {/* Kart okuyucu + çek */}
        <div className="slot-group right">
          <span className="slot-label">
            <Led on={device === 'idc'} /> Kart
          </span>
          <div className="slot card-slot">
            <div className="slot-mouth" />
            {(cardIn || cardOut) && (
              <button
                type="button"
                className={`card-in ${cardOut ? 'out' : ''}`}
                onClick={onTakeCard}
                disabled={!cardOut}
                aria-label={cardOut ? 'Kartı al' : 'Kart içeride'}
              />
            )}
          </div>
          <span className="slot-label">
            <Led on={device === 'ipm'} /> Çek
          </span>
          <div className="slot thin" />
        </div>
      </div>

      <div className="atm-lower">
        <div className="slot-group grow">
          <span className="slot-label">
            <Led on={device === 'cdm'} /> Para çıkışı
          </span>
          <div className={`dispenser ${cashOut ? 'open' : ''}`}>
            {cashOut && (
              <button type="button" className="cash-stack" onClick={onTakeCash} aria-label="Paranızı alın">
                {noteList.map((k, i) => {
                  const d = k.split('-')[0]
                  return (
                    <span key={k} className={`note n${d}`} style={{ '--i': i }}>
                      {d}
                    </span>
                  )
                })}
              </button>
            )}
          </div>
        </div>
        <div className="slot-group">
          <span className="slot-label">
            <Led on={device === 'cim'} /> Para girişi
          </span>
          <div className={`cim ${device === 'cim' ? 'active' : ''}`} />
        </div>
      </div>
    </div>
  )
}
