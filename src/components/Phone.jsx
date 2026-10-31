import { money } from '../api'

const QUICK = [200, 500, 1000]

// Müşterinin telefonundaki mobil bankacılık uygulaması (yalnızca Demo Bank müşterileri).
export default function Phone({ cards, phone, canScan, qrRef, onChange, onScan, onApprove, onBack }) {
  const customers = cards.filter((c) => c.bank === '00061' && c.type === 'debit')
  const { step, customer, op, amount, message } = phone
  const holder = customers.find((c) => c.id === customer)?.holder

  return (
    <div className="mobile">
      <p className="wallet-title">Telefon · mobil bankacılık ile kartsız işlem</p>
      <div className="phone">
        <div className="phone-notch" aria-hidden="true" />
        <div className="phone-head">
          <b>Demo Bank Mobil</b>
          <select
            aria-label="Uygulamada oturum açmış müşteri"
            value={customer}
            disabled={step !== 'home'}
            onChange={(e) => onChange({ customer: e.target.value })}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.holder}
              </option>
            ))}
          </select>
        </div>

        <div className="phone-body">
          {step === 'home' && (
            <>
              <p className="phone-text">
                ATM ekranında <b>QR ile İşlem</b> seçin, ardından ekrandaki kodu okutun.
              </p>
              <button type="button" className="phone-btn primary" disabled={!canScan} onClick={onScan}>
                QR Kodu Okut
              </button>
            </>
          )}

          {step === 'scanned' && (
            <>
              <p className="phone-meta">ATM00684 · Ref {qrRef}</p>
              <div className="phone-seg" role="radiogroup" aria-label="İşlem türü">
                {[
                  ['withdraw', 'Para Çek'],
                  ['deposit', 'Para Yatır'],
                ].map(([k, label]) => (
                  <button
                    type="button"
                    key={k}
                    role="radio"
                    aria-checked={op === k}
                    className={op === k ? 'on' : ''}
                    onClick={() => onChange({ op: k })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {op === 'withdraw' ? (
                <>
                  <label className="phone-field">
                    Tutar (10 TL ve katları)
                    <input
                      inputMode="numeric"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => onChange({ amount: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                    />
                  </label>
                  <div className="phone-chips">
                    {QUICK.map((v) => (
                      <button type="button" key={v} onClick={() => onChange({ amount: String(v) })}>
                        {money(v)}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="phone-text">Tutar, banknotlar ATM'de sayıldıktan sonra belli olur.</p>
              )}
              <button
                type="button"
                className="phone-btn primary"
                disabled={op === 'withdraw' && !Number(amount)}
                onClick={onApprove}
              >
                Biyometrik Onayla
              </button>
              <button type="button" className="phone-btn" onClick={onBack}>
                Vazgeç
              </button>
            </>
          )}

          {step === 'waiting' && <p className="phone-text">Onay bankaya gönderiliyor…</p>}

          {step === 'done' && (
            <p className="phone-ok">
              {holder} için onay verildi.
              <br />
              İşleme ATM'den devam edin.
            </p>
          )}

          {message && (
            <p className="phone-alert" role="alert">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
