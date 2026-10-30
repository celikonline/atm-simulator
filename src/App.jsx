import { useCallback, useEffect, useRef, useState } from 'react'
import { api, money } from './api'
import AtmMachine from './components/AtmMachine'
import Screen from './components/Screen'
import FlowDiagram from './components/FlowDiagram'
import EventLog from './components/EventLog'
import Wallet from './components/Wallet'
import StatusPanel from './components/StatusPanel'

// Banka defteri ve kaset durumu istemcide tutulur (Vercel fonksiyonları durumsuz).
const INITIAL_LEDGERS = {
  '4543-0001': { balance: 12500, daily_withdrawn: 0 },
  '9792-0042': { balance: 850, daily_withdrawn: 0 },
  '5170-7788': { balance: 4200, daily_withdrawn: 0 },
}
const INITIAL_CASSETTES = { 200: 40, 100: 60, 50: 80, 20: 6 }
const MTI = { '0100': 'Yetki isteği', '0110': 'Yetki yanıtı', '0200': 'Finansal istek', '0210': 'Finansal yanıt' }
const INPUT_RULES = { pin: 4, amount: 5, 'bill-sub': 10, cheque: 6 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toLocaleTimeString('tr-TR')

export default function App() {
  const [cards, setCards] = useState([])
  const [screen, setScreen] = useState('idle')
  const [card, setCard] = useState(null)
  const [token, setToken] = useState(null)
  const [input, setInput] = useState('')
  const [tries, setTries] = useState({})
  const [retained, setRetained] = useState({})
  const [ledgers, setLedgers] = useState(INITIAL_LEDGERS)
  const [cassettes, setCassettes] = useState(INITIAL_CASSETTES)
  const [log, setLog] = useState([])
  const [hops, setHops] = useState({ list: [], active: -1 })
  const [notice, setNotice] = useState(null)
  const [draft, setDraft] = useState({})
  const [device, setDevice] = useState(null)
  const [cardOut, setCardOut] = useState(false)
  const [cashOut, setCashOut] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [hostError, setHostError] = useState(null)
  const logId = useRef(0)

  const addLog = useCallback((layer, text, detail) => {
    logId.current += 1
    const entry = { id: logId.current, time: now(), layer, text, detail }
    setLog((l) => [...l.slice(-199), entry])
  }, [])

  const xfs = useCallback(
    (dev, cmd, text) => {
      setDevice(dev)
      addLog('xfs', cmd, text)
      setTimeout(() => setDevice((d) => (d === dev ? null : d)), 1100)
    },
    [addLog],
  )

  useEffect(() => {
    api('/api/cards', null)
      .then((c) => {
        setCards(c)
        addLog('info', 'Host simülatörüne bağlanıldı', `${c.length} demo kart yüklendi`)
      })
      .catch(() =>
        setHostError('Host simülatörüne ulaşılamıyor. Yerelde `npm run dev:api` komutunun çalıştığından emin olun.'),
      )
  }, [addLog])

  const playTrace = async (trace) => {
    for (let i = 0; i < trace.length; i++) {
      const h = trace[i]
      setHops({ list: trace, active: i })
      addLog('host', `${h.from} → ${h.to}`, `${h.proto} · ${h.ms} ms`)
      await sleep(Math.min(Math.max(h.ms * 7, 320), 760))
    }
    setHops({ list: trace, active: trace.length })
  }

  const runHost = async (path, payload = {}) => {
    setScreen('processing')
    let res
    try {
      res = await api(path, payload, token)
    } catch (e) {
      setHostError(e.message)
      res = { approved: false, code: '91', message: 'Host sistemine ulaşılamadı' }
    }
    if (res.iso) addLog('iso', `→ ${res.iso.request.mti} ${MTI[res.iso.request.mti] ?? ''}`, res.iso.request.fields)
    if (res.trace) await playTrace(res.trace)
    if (res.iso)
      addLog('iso', `← ${res.iso.response.mti} · Alan 39 = ${res.iso.response.fields['39']} (${res.message})`, res.iso.response.fields)
    else addLog('host', `Yanıt: ${res.code} · ${res.message}`)
    if (res.code === '54') {
      setNotice({ ok: false, title: 'Oturum sona erdi', text: 'Güvenliğiniz için kartınız iade ediliyor.' })
      ejectCard()
      return null
    }
    return res
  }

  const ledger = card ? ledgers[card.id] : null
  const updateLedger = (next) => setLedgers((l) => ({ ...l, [card.id]: { ...l[card.id], ...next } }))

  // --------------------------------------------------------------- kart ve PIN
  const insertCard = async (c) => {
    if (screen !== 'idle' || retained[c.id]) return
    setCard(c)
    setNotice(null)
    setReceipt(null)
    setScreen('reading')
    xfs('idc', 'WFS_CMD_IDC_READ_RAW_DATA', 'Kart takıldı · manyetik iz ve çip okunuyor')
    await sleep(700)
    try {
      const info = await api('/api/card/read', { card_id: c.id })
      xfs('idc', 'WFS_CMD_IDC_CHIP_IO', `${info.chip.emv} · AID ${info.chip.aid}`)
    } catch {
      setHostError('Kart bilgisi hosta iletilemedi.')
    }
    await sleep(500)
    setInput('')
    setScreen('pin')
    xfs('pin', 'WFS_CMD_PIN_GET_PIN', 'EPP şifreli PIN girişi moduna geçti')
  }

  const submitPin = async () => {
    if (input.length < 4) return
    xfs('pin', 'WFS_CMD_PIN_GET_PINBLOCK', 'PIN bloğu ISO-0 formatında EPP içinde şifrelendi')
    const pin = input
    setInput('')
    const res = await runHost('/api/pin/verify', { card_id: card.id, pin, tries: tries[card.id] || 0 })
    if (!res) return
    if (res.approved) {
      setToken(res.token)
      setTries((t) => ({ ...t, [card.id]: 0 }))
      setNotice(null)
      setScreen('menu')
    } else if (res.code === '75') {
      xfs('idc', 'WFS_CMD_IDC_RETAIN_CARD', 'Kart güvenlik nedeniyle alıkonuldu')
      setRetained((r) => ({ ...r, [card.id]: true }))
      setNotice({ ok: false, title: 'Kartınız alıkonuldu', text: 'PIN 3 kez hatalı girildi. Lütfen şubenize başvurun.' })
      setCard(null)
      setScreen('result-final')
    } else {
      setTries((t) => ({ ...t, [card.id]: (t[card.id] || 0) + 1 }))
      setNotice({ ok: false, title: res.message, text: `Kalan deneme hakkınız: ${res.tries_left}` })
      setScreen('pin')
    }
  }

  const ejectCard = () => {
    xfs('idc', 'WFS_CMD_IDC_EJECT_CARD', 'Kart iade ediliyor')
    setCardOut(true)
    setScreen('eject')
  }

  const finish = () => {
    setToken(null)
    setCard(null)
    setDraft({})
    setInput('')
    setScreen('goodbye')
    setTimeout(() => setScreen((s) => (s === 'goodbye' ? 'idle' : s)), 2400)
  }

  const takeCard = () => {
    if (!cardOut) return
    setCardOut(false)
    addLog('xfs', 'WFS_SRVE_IDC_MEDIAREMOVED', 'Müşteri kartı aldı')
    if (screen === 'take-card') {
      setCashOut(draft.notes)
      setScreen('take-cash')
      xfs('cdm', 'WFS_CMD_CDM_PRESENT', 'Shutter açıldı · banknotlar sunuldu')
    } else {
      finish()
    }
  }

  const takeCash = () => {
    setCashOut(null)
    addLog('xfs', 'WFS_SRVE_CDM_ITEMSTAKEN', 'Banknotlar alındı · shutter kapandı')
    printReceipt(draft.receipt)
    finish()
  }

  const printReceipt = (lines) => {
    if (!lines) return
    xfs('ptr', 'WFS_CMD_PTR_PRINT_FORM', 'Termal fiş yazdırılıyor')
    setReceipt({
      lines,
      card: card?.pan_masked,
      date: new Date().toLocaleString('tr-TR'),
    })
  }

  const afterTxn = (res, title, text, receiptLines, extra = {}) => {
    setNotice({ ok: res.approved, title, text, ...extra })
    if (res.approved && receiptLines) printReceipt(receiptLines)
    setScreen('result')
  }

  // --------------------------------------------------------------- işlemler
  const withdraw = async (amount) => {
    if (!amount) return
    xfs('cdm', 'WFS_CMD_CDM_DENOMINATE', `${money(amount)} için kaset planı isteniyor`)
    const res = await runHost('/api/withdraw', { amount, ledger, cassettes })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, `Talep edilen tutar: ${money(amount)}`)
    updateLedger(res.ledger)
    setCassettes(res.cassettes)
    const mix = Object.entries(res.notes)
      .sort((a, b) => b[0] - a[0])
      .map(([d, n]) => `${n}×${d}`)
      .join(' + ')
    xfs('cdm', 'WFS_CMD_CDM_DISPENSE', `Banknotlar kasetlerden çekildi: ${mix}`)
    setDraft({
      notes: res.notes,
      receipt: [
        ['İŞLEM', 'PARA ÇEKME'],
        ['TUTAR', money(amount)],
        ['BANKNOT', mix],
        ['ONAY KODU', res.auth_code],
        ['KALAN BAKİYE', money(res.ledger.balance)],
      ],
    })
    xfs('idc', 'WFS_CMD_IDC_EJECT_CARD', 'Önce kart iade edilir (card-before-cash)')
    setCardOut(true)
    setScreen('take-card')
  }

  const balance = async () => {
    const res = await runHost('/api/balance', { ledger })
    if (!res) return
    afterTxn(res, 'Hesap bakiyeniz', card.account, null, { amount: res.balance })
  }

  const depositInsert = async () => {
    const notes = draft.notes || {}
    const count = Object.values(notes).reduce((a, b) => a + b, 0)
    if (!count) return
    xfs('cim', 'WFS_CMD_CIM_CASH_IN_START', 'Para yatırma haznesi açıldı')
    await sleep(500)
    const suspect = draft.suspect || 0
    xfs('cim', 'WFS_CMD_CIM_CASH_IN', `Banknot tanıma: ${count} geçerli${suspect ? `, ${suspect} şüpheli (alıkonuldu)` : ''}`)
    await sleep(600)
    setScreen('deposit-confirm')
  }

  const depositConfirm = async () => {
    xfs('cim', 'WFS_CMD_CIM_CASH_IN_END', 'Banknotlar kasete/recycler’a alındı')
    const res = await runHost('/api/deposit', { notes: draft.notes, suspect: draft.suspect || 0, ledger, cassettes })
    if (!res) return
    if (res.approved) {
      updateLedger(res.ledger)
      setCassettes(res.cassettes)
    }
    afterTxn(
      res,
      res.approved ? 'Para yatırıldı' : res.message,
      res.retained_suspect ? `${res.retained_suspect} şüpheli banknot incelemeye alındı.` : 'Tutar hesabınıza geçti.',
      [
        ['İŞLEM', 'PARA YATIRMA'],
        ['TUTAR', money(res.amount || 0)],
        ['ŞÜPHELİ', `${res.retained_suspect || 0} ADET`],
        ['YENİ BAKİYE', money(res.ledger?.balance || 0)],
      ],
      { amount: res.amount },
    )
  }

  const billInquiry = async () => {
    if (input.length < 6) return
    const res = await runHost('/api/bill/inquiry', { biller: draft.biller, subscriber: input })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, '')
    setDraft((d) => ({ ...d, bill: res, subscriber: input }))
    setInput('')
    setScreen('bill-confirm')
  }

  const billPay = async () => {
    const b = draft.bill
    const res = await runHost('/api/bill/pay', { biller: draft.biller, subscriber: draft.subscriber, amount: b.amount, ledger })
    if (!res) return
    if (res.approved) updateLedger(res.ledger)
    afterTxn(
      res,
      res.message,
      `${b.biller} · Abone ${b.subscriber}`,
      [
        ['İŞLEM', 'FATURA ÖDEME'],
        ['KURUM', b.biller.toLocaleUpperCase('tr-TR')],
        ['ABONE NO', b.subscriber],
        ['TUTAR', money(b.amount)],
      ],
      { amount: b.amount },
    )
  }

  const chequeDeposit = async () => {
    const amount = Number(input)
    if (!amount) return
    const chequeNo = String(Math.floor(1000000 + Math.random() * 8999999))
    setInput('')
    setScreen('cheque-scan')
    xfs('ipm', 'WFS_CMD_IPM_MEDIA_IN', 'Çek alındı · ön ve arka yüz taranıyor')
    await sleep(900)
    xfs('ipm', 'WFS_CMD_IPM_READ_IMAGE', `MICR satırı okundu · çek no ${chequeNo}`)
    await sleep(500)
    const res = await runHost('/api/cheque', { amount, cheque_no: chequeNo })
    if (!res) return
    afterTxn(
      res,
      res.approved ? 'Çekiniz alındı' : res.message,
      res.approved ? `${res.status}. Takas tamamlanınca hesabınıza geçecek.` : '',
      [
        ['İŞLEM', 'ÇEK YATIRMA'],
        ['ÇEK NO', chequeNo],
        ['TUTAR', money(amount)],
        ['DURUM', 'TAKASTA'],
      ],
      { amount, micr: res.micr },
    )
  }

  // --------------------------------------------------------------- tuş takımı
  const onDigit = (d) => {
    const max = INPUT_RULES[screen]
    if (!max) return
    setInput((v) => (v.length < max ? v + d : v))
  }

  const onEnter = () => {
    if (screen === 'pin') submitPin()
    else if (screen === 'amount') withdraw(Number(input))
    else if (screen === 'bill-sub') billInquiry()
    else if (screen === 'cheque') chequeDeposit()
  }

  const onCancel = () => {
    if (['idle', 'reading', 'processing', 'eject', 'take-card', 'take-cash', 'goodbye', 'cheque-scan'].includes(screen)) return
    if (screen === 'result-final') return setScreen('idle')
    addLog('info', 'Müşteri İPTAL tuşuna bastı')
    setNotice(null)
    ejectCard()
  }

  const keyHandler = useRef()
  keyHandler.current = (e) => {
    if (/^\d$/.test(e.key)) onDigit(e.key)
    else if (e.key === 'Enter') onEnter()
    else if (e.key === 'Backspace') setInput('')
    else if (e.key === 'Escape') onCancel()
  }
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT') return
      keyHandler.current(e)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const go = (s) => {
    setNotice(null)
    setInput('')
    setScreen(s)
  }

  const actions = {
    go,
    withdraw,
    balance,
    depositInsert,
    depositConfirm,
    billPay,
    setDraft,
    onEnter,
    eject: ejectCard,
    selectBiller: (b) => {
      setDraft({ biller: b })
      go('bill-sub')
    },
    startDeposit: () => {
      setDraft({ notes: {}, suspect: 0 })
      go('deposit')
    },
    reset: () => go('idle'),
  }

  const resetAll = () => {
    setLedgers(INITIAL_LEDGERS)
    setCassettes(INITIAL_CASSETTES)
    setRetained({})
    setTries({})
    setLog([])
    setHops({ list: [], active: -1 })
    setReceipt(null)
    setCashOut(null)
    setCardOut(false)
    setCard(null)
    setToken(null)
    setNotice(null)
    setScreen('idle')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">NCR SelfServ 84 · Terminal ATM00684</p>
          <h1>ATM Simülatörü</h1>
        </div>
        <button type="button" className="ghost" onClick={resetAll}>
          Simülasyonu sıfırla
        </button>
      </header>

      {hostError && (
        <div className="banner" role="alert">
          {hostError}
          <button type="button" className="ghost small" onClick={() => setHostError(null)}>
            Kapat
          </button>
        </div>
      )}

      <main className="layout">
        <section className="col-machine">
          <AtmMachine
            device={device}
            cardIn={!!card && !cardOut}
            cardOut={cardOut}
            cashOut={cashOut}
            receipt={receipt}
            onTakeCard={takeCard}
            onTakeCash={takeCash}
            onTakeReceipt={() => setReceipt(null)}
            onDigit={onDigit}
            onEnter={onEnter}
            onClear={() => setInput('')}
            onCancel={onCancel}
          >
            <Screen screen={screen} card={card} input={input} notice={notice} draft={draft} actions={actions} />
          </AtmMachine>
          <Wallet cards={cards} active={card?.id} retained={retained} disabled={screen !== 'idle'} onInsert={insertCard} />
        </section>

        <section className="col-insight">
          <FlowDiagram hops={hops} foreign={card?.issuer === 'other'} />
          <StatusPanel cassettes={cassettes} ledgers={ledgers} cards={cards} active={card?.id} />
          <EventLog entries={log} />
        </section>
      </main>
    </div>
  )
}
