import { money } from '../api'

const BILLERS = [
  ['elektrik', 'Elektrik'],
  ['su', 'Su'],
  ['dogalgaz', 'Doğalgaz'],
  ['gsm', 'GSM / Telefon'],
]
const QUICK = [200, 500, 1000, 2000, 3000, 5000]
const DEPOSIT_DENOMS = [200, 100, 50, 20, 10, 5]

function Btn({ children, onClick, side = 'left', tone }) {
  return (
    <button type="button" className={`scr-btn ${side} ${tone || ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

function Frame({ title, sub, children, footer }) {
  return (
    <div className="scr-frame">
      {title && <h2 className="scr-title">{title}</h2>}
      {sub && <p className="scr-sub">{sub}</p>}
      <div className="scr-body">{children}</div>
      {footer && <div className="scr-footer">{footer}</div>}
    </div>
  )
}

function Entry({ value, mask, prefix, placeholder }) {
  return (
    <div className="scr-entry" aria-live="polite">
      {prefix && <span className="scr-entry-prefix">{prefix}</span>}
      <span>{value ? (mask ? '●'.repeat(value.length) : value) : <em>{placeholder}</em>}</span>
      <span className="caret" />
    </div>
  )
}

const keyHint = <span className="scr-hint">Tuş takımını veya klavyenizi kullanın · Onay ile devam</span>

export default function Screen({ screen, card, input, notice, draft, actions }) {
  const a = actions
  switch (screen) {
    case 'idle':
      return (
        <Frame>
          <div className="idle">
            <div className="idle-mark">DEMO BANK</div>
            <p className="idle-big">Hoş geldiniz</p>
            <p className="idle-small">İşlem için kartınızı takınız</p>
            <div className="idle-arrow" aria-hidden="true">
              ↓
            </div>
            <p className="idle-small dim">Aşağıdaki cüzdandan bir kart seçin</p>
          </div>
        </Frame>
      )

    case 'reading':
      return (
        <Frame title="Kartınız okunuyor" sub="Lütfen bekleyiniz">
          <div className="spinner" />
        </Frame>
      )

    case 'pin':
      return (
        <Frame title={`Sayın ${card?.holder}`} sub="Lütfen 4 haneli şifrenizi giriniz" footer={keyHint}>
          <Entry value={input} mask placeholder="" />
          {notice && (
            <p className="scr-alert">
              {notice.title} · {notice.text}
            </p>
          )}
          <p className="scr-note">Şifrenizi girerken tuş takımını elinizle kapatınız.</p>
        </Frame>
      )

    case 'processing':
      return (
        <Frame title="İşleminiz yapılıyor" sub="Banka sistemleriyle iletişim kuruluyor">
          <div className="spinner" />
        </Frame>
      )

    case 'menu':
      return (
        <Frame title="İşlem seçiniz" sub={`${card?.scheme} · ${card?.pan_masked}`}>
          <div className="scr-grid">
            <Btn onClick={() => a.go('withdraw')}>Para Çekme</Btn>
            <Btn side="right" onClick={a.startDeposit}>
              Para Yatırma
            </Btn>
            <Btn onClick={a.balance}>Bakiye Sorgulama</Btn>
            <Btn side="right" onClick={() => a.go('bill')}>
              Fatura Ödeme
            </Btn>
            <Btn onClick={() => a.go('cheque')}>Çek Yatırma</Btn>
            <Btn side="right" tone="muted" onClick={a.eject}>
              Kartımı Ver
            </Btn>
          </div>
        </Frame>
      )

    case 'withdraw':
      return (
        <Frame title="Para Çekme" sub="Tutar seçiniz">
          <div className="scr-grid">
            {QUICK.map((v, i) => (
              <Btn key={v} side={i % 2 ? 'right' : 'left'} onClick={() => a.withdraw(v)}>
                {money(v)}
              </Btn>
            ))}
            <Btn onClick={() => a.go('amount')}>Diğer Tutar</Btn>
            <Btn side="right" tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
          </div>
        </Frame>
      )

    case 'amount':
      return (
        <Frame title="Diğer Tutar" sub="10 TL ve katları · Günlük limit 10.000 TL" footer={keyHint}>
          <Entry value={input} prefix="₺" placeholder="0" />
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('withdraw')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.onEnter}>
              Onayla
            </Btn>
          </div>
        </Frame>
      )

    case 'take-card':
      return (
        <Frame title="Kartınızı alınız" sub="Paranız kartınızı aldıktan sonra verilecektir">
          <div className="pulse-hint">Kart haznesindeki kartın üzerine tıklayın</div>
        </Frame>
      )

    case 'take-cash':
      return (
        <Frame title="Paranızı alınız" sub="Banknotlar para çıkış haznesinde">
          <div className="pulse-hint">Para haznesindeki banknotlara tıklayın</div>
        </Frame>
      )

    case 'eject':
      return (
        <Frame title={notice?.title || 'Kartınızı alınız'} sub={notice?.text || 'Bizi tercih ettiğiniz için teşekkür ederiz'}>
          <div className="pulse-hint">Kart haznesindeki kartın üzerine tıklayın</div>
        </Frame>
      )

    case 'goodbye':
      return (
        <Frame>
          <div className="idle">
            <p className="idle-big">İyi günler</p>
            <p className="idle-small">Fişinizi almayı unutmayınız</p>
          </div>
        </Frame>
      )

    case 'result':
    case 'result-final':
      return (
        <Frame title={notice?.title} sub={notice?.text}>
          <div className={`scr-result ${notice?.ok ? 'ok' : 'bad'}`}>
            {notice?.amount !== undefined && <p className="scr-amount">{money(notice.amount)}</p>}
            {notice?.micr && <p className="scr-micr">{notice.micr}</p>}
            {!notice?.ok && notice?.amount === undefined && <p className="scr-amount small">İşlem tamamlanamadı</p>}
          </div>
          {screen === 'result' ? (
            <div className="scr-grid">
              <Btn onClick={() => a.go('menu')}>Başka İşlem</Btn>
              <Btn side="right" tone="muted" onClick={a.eject}>
                Kartımı Ver
              </Btn>
            </div>
          ) : (
            <div className="scr-grid">
              <Btn side="right" onClick={a.reset}>
                Ana Ekran
              </Btn>
            </div>
          )}
        </Frame>
      )

    case 'deposit': {
      const notes = draft.notes || {}
      const total = Object.entries(notes).reduce((s, [d, n]) => s + d * n, 0)
      const set = (d, delta) =>
        a.setDraft((dr) => ({ ...dr, notes: { ...dr.notes, [d]: Math.max(0, (dr.notes?.[d] || 0) + delta) } }))
      return (
        <Frame title="Para Yatırma" sub="Hazneye koyacağınız banknotları belirleyin">
          <div className="notes-grid">
            {DEPOSIT_DENOMS.map((d) => (
              <div className="note-row" key={d}>
                <span className={`note-chip n${d}`}>{d} ₺</span>
                <button type="button" className="mini" onClick={() => set(d, -1)} aria-label={`${d} TL azalt`}>
                  −
                </button>
                <span className="note-count">{notes[d] || 0}</span>
                <button type="button" className="mini" onClick={() => set(d, 1)} aria-label={`${d} TL artır`}>
                  +
                </button>
              </div>
            ))}
          </div>
          <label className="suspect">
            <input
              id="suspect"
              type="checkbox"
              checked={!!draft.suspect}
              onChange={(e) => a.setDraft((dr) => ({ ...dr, suspect: e.target.checked ? 1 : 0 }))}
            />
            Destenin içine bir şüpheli banknot ekle
          </label>
          <p className="scr-total">Toplam: {money(total)}</p>
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.depositInsert}>
              Banknotları Yerleştir
            </Btn>
          </div>
        </Frame>
      )
    }

    case 'deposit-confirm': {
      const notes = draft.notes || {}
      const total = Object.entries(notes).reduce((s, [d, n]) => s + d * n, 0)
      return (
        <Frame title="Sayım sonucu" sub="Banknotlar tanındı ve sayıldı">
          <table className="scr-table">
            <tbody>
              {Object.entries(notes)
                .filter(([, n]) => n)
                .sort((x, y) => y[0] - x[0])
                .map(([d, n]) => (
                  <tr key={d}>
                    <td>{d} ₺</td>
                    <td>× {n}</td>
                    <td>{money(d * n)}</td>
                  </tr>
                ))}
              {draft.suspect ? (
                <tr className="warn">
                  <td colSpan={2}>Şüpheli banknot</td>
                  <td>1 adet · alıkonuldu</td>
                </tr>
              ) : null}
            </tbody>
          </table>
          <p className="scr-total">Yatırılacak: {money(total)}</p>
          <div className="scr-grid">
            <Btn tone="muted" onClick={a.eject}>
              İptal
            </Btn>
            <Btn side="right" tone="primary" onClick={a.depositConfirm}>
              Onayla
            </Btn>
          </div>
        </Frame>
      )
    }

    case 'bill':
      return (
        <Frame title="Fatura Ödeme" sub="Kurum seçiniz">
          <div className="scr-grid">
            {BILLERS.map(([k, label], i) => (
              <Btn key={k} side={i % 2 ? 'right' : 'left'} onClick={() => a.selectBiller(k)}>
                {label}
              </Btn>
            ))}
            <Btn tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
          </div>
        </Frame>
      )

    case 'bill-sub':
      return (
        <Frame title="Abone numarası" sub="6–10 haneli abone / tesisat numaranızı giriniz" footer={keyHint}>
          <Entry value={input} placeholder="Örn. 4410278" />
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('bill')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.onEnter}>
              Sorgula
            </Btn>
          </div>
        </Frame>
      )

    case 'bill-confirm': {
      const b = draft.bill
      return (
        <Frame title={b.biller} sub={`Abone ${b.subscriber} · Son ödeme ${b.due}`}>
          <p className="scr-amount">{money(b.amount)}</p>
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('menu')}>
              Vazgeç
            </Btn>
            <Btn side="right" tone="primary" onClick={a.billPay}>
              Öde
            </Btn>
          </div>
        </Frame>
      )
    }

    case 'cheque':
      return (
        <Frame title="Çek Yatırma" sub="Çek tutarını giriniz, ardından çeki çek haznesine yerleştiriniz" footer={keyHint}>
          <Entry value={input} prefix="₺" placeholder="0" />
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.onEnter}>
              Çeki Yerleştir
            </Btn>
          </div>
        </Frame>
      )

    case 'cheque-scan':
      return (
        <Frame title="Çekiniz taranıyor" sub="Ön yüz, arka yüz ve MICR satırı okunuyor">
          <div className="cheque-scan">
            <div className="cheque-paper">
              <span>ÇEK</span>
              <span className="micr-line">⑈•••••••⑈ ⑆0006100⑆</span>
            </div>
            <div className="scan-bar" />
          </div>
        </Frame>
      )

    default:
      return null
  }
}
