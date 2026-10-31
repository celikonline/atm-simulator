import { useEffect, useState } from 'react'
import { money } from '../api'
import QrCode from './QrCode'

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

function Entry({ value, mask, prefix, placeholder, compact }) {
  return (
    <div className={`scr-entry ${compact ? 'compact' : ''}`} aria-live="polite">
      {prefix && <span className="scr-entry-prefix">{prefix}</span>}
      <span>{value ? (mask ? '●'.repeat(value.length) : value) : <em>{placeholder}</em>}</span>
      <span className="caret" />
    </div>
  )
}

const keyHint = <span className="scr-hint">Tuş takımını veya klavyenizi kullanın · Onay ile devam</span>

function Rows({ rows }) {
  return (
    <table className="scr-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td>{k}</td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const groupIban = (digits) => digits.replace(/(.{4})/g, '$1 ').trim()
const shortIban = (iban) => `${iban.slice(0, 4)} … ${iban.slice(-4)}`

const secondsLeft = (at) => Math.max(0, Math.round((at - Date.now()) / 1000))

function QrPanel({ qr, actions: a }) {
  const [left, setLeft] = useState(() => secondsLeft(qr.expiresAt))
  useEffect(() => {
    setLeft(secondsLeft(qr.expiresAt))
    const t = setInterval(() => setLeft(secondsLeft(qr.expiresAt)), 500)
    return () => clearInterval(t)
  }, [qr.expiresAt])
  const expired = left === 0

  return (
    <Frame
      title="QR ile İşlem"
      sub={expired ? 'QR kodun süresi doldu' : 'Mobil uygulamanızla okutun'}
      footer={
        <div className="scr-grid">
          <Btn tone="muted" onClick={a.cancelQr}>
            İptal
          </Btn>
          {expired && (
            <Btn side="right" tone="primary" onClick={a.startQr}>
              Yeni QR
            </Btn>
          )}
        </div>
      }
    >
      <div className="qr-row">
        <div className={`qr-box ${expired ? 'expired' : ''}`}>
          <QrCode value={qr.payload} />
        </div>
        <p className="qr-meta">
          <span>Ref {qr.ref}</span>
          <b>{expired ? 'Süre doldu' : `${left} sn`}</b>
          <span>geçerli</span>
        </p>
      </div>
    </Frame>
  )
}

// Para alınmazsa banknotların geri çekilmesine kalan süre
function RetractCountdown({ at }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((at - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, Math.ceil((at - Date.now()) / 1000))), 250)
    return () => clearInterval(t)
  }, [at])
  return <p className="scr-alert">Banknotlar {left} sn içinde alınmazsa geri çekilecek</p>
}

export default function Screen({ screen, card, input, notice, draft, actions, terminal, onUs, fees, ledger, payees, service }) {
  const a = actions
  const cashOk = service.cdm === 'ok'
  const cashBtn = (label) => (
    <Btn tone={cashOk ? undefined : 'off'} onClick={cashOk ? () => a.go('withdraw') : undefined}>
      {label}
    </Btn>
  )
  const deviceNote = (!cashOk || service.ptr !== 'ok') && (
    <p className="scr-note warn">
      {[!cashOk && 'Para verme geçici olarak hizmet dışı', service.ptr !== 'ok' && 'Fiş verilemiyor'].filter(Boolean).join(' · ')}
    </p>
  )
  const qrMode = draft.mode === 'qr'
  const credit = card?.type === 'credit'
  const back = qrMode ? a.cancelQr : () => a.go('menu')
  switch (screen) {
    case 'idle':
      return (
        <Frame>
          <div className="idle">
            <div className="idle-mark">{terminal.name.toLocaleUpperCase('tr-TR')}</div>
            <p className="idle-big">Hoş geldiniz</p>
            <p className="idle-small">İşlem için kartınızı takınız</p>
            <div className="idle-arrow" aria-hidden="true">
              ↓
            </div>
            <p className="idle-small dim">Aşağıdaki cüzdandan bir kart seçin</p>
            {deviceNote}
            {/* Kartsız işlem bankanın kendi mobil uygulamasıyla çalışır; demo yalnızca Demo Bank'ta */}
            {terminal.bank === '00061' && (
              <button type="button" className="scr-btn idle-qr" onClick={a.startQr}>
                Kartsız İşlem · QR ile
              </button>
            )}
          </div>
        </Frame>
      )

    case 'fee-notice':
      return (
        <Frame
          title="Başka banka ATM'si"
          sub={`Kartınız ${card?.bank_name}'a ait, bu ATM ${terminal.name}'a ait.`}
          footer={
            <div className="scr-grid">
              <Btn tone="muted" onClick={a.eject}>
                Vazgeç
              </Btn>
              <Btn side="right" tone="primary" onClick={() => a.go('menu')}>
                Kabul Ediyorum
              </Btn>
            </div>
          }
        >
          <Rows
            rows={[
              [credit ? 'Nakit avans ücreti' : 'Para çekme ücreti', money(fees.withdraw ?? 0)],
              [credit ? 'Limit sorgulama ücreti' : 'Bakiye sorgulama ücreti', money(fees.balance ?? 0)],
            ]}
          />
          <p className="scr-note">Ücretler kartınızı çıkaran banka tarafından alınır. Bu ATM'de yalnızca çekim ve sorgulama yapılabilir.</p>
        </Frame>
      )

    case 'more':
      return (
        <Frame title="Diğer İşlemler" sub={`${card?.scheme} · ${card?.pan_masked}`}>
          <div className="scr-grid">
            <Btn onClick={() => a.go('bill')}>Fatura Ödeme</Btn>
            <Btn side="right" onClick={() => a.go('cheque')}>
              Çek Yatırma
            </Btn>
            <Btn onClick={a.creditInquiry}>Kredi Kartı Borcu</Btn>
            <Btn side="right" tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
          </div>
        </Frame>
      )

    case 'qr':
      return <QrPanel qr={draft.qr} actions={a} />

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

    case 'menu': {
      const sub = `${credit ? 'Kredi kartı' : card?.scheme} · ${card?.pan_masked}`
      if (!onUs)
        return (
          <Frame title="İşlem seçiniz" sub={`${sub} · ${card?.bank_name}`}>
            <div className="scr-grid">
              {cashBtn(credit ? 'Nakit Avans' : 'Para Çekme')}
              <Btn side="right" onClick={a.balance}>
                {credit ? 'Limit Sorgulama' : 'Bakiye Sorgulama'}
              </Btn>
              <Btn side="right" tone="muted" onClick={a.eject}>
                Kartımı Ver
              </Btn>
            </div>
            {deviceNote}
          </Frame>
        )
      if (credit)
        return (
          <Frame title="İşlem seçiniz" sub={sub}>
            <div className="scr-grid">
              {cashBtn('Nakit Avans')}
              <Btn side="right" onClick={a.startDeposit}>
                Borç Öde (Nakit)
              </Btn>
              <Btn onClick={a.balance}>Limit / Borç Bilgisi</Btn>
              <Btn side="right" tone="muted" onClick={a.eject}>
                Kartımı Ver
              </Btn>
            </div>
            {deviceNote}
          </Frame>
        )
      return (
        <Frame title="İşlem seçiniz" sub={sub}>
          <div className="scr-grid">
            {cashBtn('Para Çekme')}
            <Btn side="right" onClick={a.startDeposit}>
              Para Yatırma
            </Btn>
            <Btn onClick={a.balance}>Bakiye Sorgulama</Btn>
            <Btn side="right" onClick={() => a.go('transfer')}>
              Para Transferi
            </Btn>
            <Btn onClick={() => a.go('more')}>Diğer İşlemler</Btn>
            <Btn side="right" tone="muted" onClick={a.eject}>
              Kartımı Ver
            </Btn>
          </div>
          {deviceNote}
        </Frame>
      )
    }

    case 'withdraw':
      return (
        <Frame
          title={credit ? 'Nakit Avans' : 'Para Çekme'}
          sub={
            fees.withdraw
              ? `Tutar seçiniz · işlem ücreti ${money(fees.withdraw)}`
              : credit
                ? `Kullanılabilir limit ${money(ledger.limit - ledger.debt)}`
                : 'Tutar seçiniz'
          }
        >
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
        <Frame title="Paranızı alınız" sub={qrMode ? 'Kartsız işlem · banknotlar doğrudan sunuldu' : 'Banknotlar para çıkış haznesinde'}>
          <div className="pulse-hint">Para haznesindeki banknotlara tıklayın</div>
          {draft.retractAt && <RetractCountdown at={draft.retractAt} />}
        </Frame>
      )

    case 'maintenance':
      return (
        <Frame>
          <div className="idle">
            <div className="idle-mark">{terminal.name.toLocaleUpperCase('tr-TR')}</div>
            <p className="idle-big">Geçici olarak hizmet dışı</p>
            <p className="idle-small">Bakım çalışması yapılmaktadır</p>
            <p className="idle-small dim">Servis panelindeki Teknisyen sekmesinden işlem yapın</p>
          </div>
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
            {notice?.ok && notice.rows?.length > 0 && <Rows rows={notice.rows} />}
            {!notice?.ok && notice?.amount === undefined && <p className="scr-amount small">İşlem tamamlanamadı</p>}
          </div>
          {screen === 'result' && qrMode ? (
            <div className="scr-grid">
              <Btn side="right" onClick={a.finish}>
                Bitir
              </Btn>
            </div>
          ) : screen === 'result' ? (
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
        <Frame
          title={credit ? 'Kart Borcu Ödeme' : 'Para Yatırma'}
          sub={credit ? `Güncel borç ${money(ledger.debt)} · banknotları belirleyin` : 'Hazneye koyacağınız banknotları belirleyin'}
        >
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
            <Btn tone="muted" onClick={back}>
              {qrMode ? 'İptal' : 'Geri'}
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
            <Btn tone="muted" onClick={qrMode ? a.cancelQr : a.eject}>
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

    case 'transfer':
      return (
        <Frame title="Para Transferi" sub="Alıcı IBAN seçiniz veya giriniz">
          <div className="scr-grid">
            {payees.map((p, i) => (
              <Btn key={p.iban} side={i % 2 ? 'right' : 'left'} onClick={() => a.chooseIban(p.iban)}>
                <span className="btn-two">
                  {p.bank}
                  <small>{shortIban(p.iban)}</small>
                </span>
              </Btn>
            ))}
            <Btn side={payees.length % 2 ? 'right' : 'left'} onClick={() => a.go('transfer-iban')}>
              IBAN Gir
            </Btn>
            <Btn side="right" tone="muted" onClick={() => a.go('menu')}>
              Geri
            </Btn>
          </div>
        </Frame>
      )

    case 'transfer-iban':
      return (
        <Frame title="Alıcı IBAN" sub="TR'den sonraki 24 haneyi giriniz" footer={keyHint}>
          <Entry value={groupIban(input)} prefix="TR" placeholder="00 0000 0000 0000 0000 0000 00" compact />
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('transfer')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.onEnter}>
              Devam
            </Btn>
          </div>
        </Frame>
      )

    case 'transfer-amount':
      return (
        <Frame title="Transfer tutarı" sub={shortIban(draft.iban)} footer={keyHint}>
          <Entry value={input} prefix="₺" placeholder="0" />
          <div className="scr-grid">
            <Btn tone="muted" onClick={() => a.go('transfer')}>
              Geri
            </Btn>
            <Btn side="right" tone="primary" onClick={a.onEnter}>
              Alıcıyı Sorgula
            </Btn>
          </div>
        </Frame>
      )

    case 'transfer-confirm': {
      const q = draft.quote
      return (
        <Frame
          title="Transferi onaylayın"
          sub={q.queued ? 'EFT mesai dışında: talimat ilk iş günü gönderilecek' : `${q.method_text} ile gönderilecek`}
          footer={
            <div className="scr-grid">
              <Btn tone="muted" onClick={() => a.go('menu')}>
                Vazgeç
              </Btn>
              <Btn side="right" tone="primary" onClick={a.transfer}>
                Gönder
              </Btn>
            </div>
          }
        >
          <Rows
            rows={[
              ['Alıcı', q.masked_name],
              ['Banka', q.bank],
              ['IBAN', shortIban(q.iban)],
              ['Tutar', money(draft.amount)],
              ['Ücret', money(q.fee)],
              ['Toplam', money(draft.amount + q.fee)],
            ]}
          />
        </Frame>
      )
    }

    case 'cc-pay': {
      const d = draft.debt
      const options = [
        ['Dönem Borcu', d.statement],
        ['Asgari Ödeme', d.minimum],
        ['Tüm Borç', d.debt],
      ].filter(([, v]) => v > 0)
      return (
        <Frame title="Kredi Kartı Borcu" sub={`${d.pan_masked} · Son ödeme ${d.due}`}>
          <Rows
            rows={[
              ['Güncel borç', money(d.debt)],
              ['Hesap bakiyesi', money(ledger.balance)],
            ]}
          />
          <div className="scr-grid">
            {options.map(([label, v], i) => (
              <Btn key={label} side={i % 2 ? 'right' : 'left'} onClick={() => a.creditPay(v)}>
                <span className="btn-two">
                  {label}
                  <small>{money(v)}</small>
                </span>
              </Btn>
            ))}
            <Btn side="right" tone="muted" onClick={() => a.go('more')}>
              Geri
            </Btn>
          </div>
        </Frame>
      )
    }

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
