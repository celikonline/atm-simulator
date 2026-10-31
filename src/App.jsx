import { useCallback, useEffect, useRef, useState } from 'react'
import { api, money } from './api'
import AtmMachine from './components/AtmMachine'
import Screen from './components/Screen'
import FlowDiagram from './components/FlowDiagram'
import EventLog from './components/EventLog'
import Wallet from './components/Wallet'
import Phone from './components/Phone'
import StatusPanel, { CAPACITY } from './components/StatusPanel'
import ServicePanel from './components/ServicePanel'

// Banka defteri ve kaset durumu istemcide tutulur (Vercel fonksiyonları durumsuz).
const INITIAL_LEDGERS = {
  '4543-0001': { balance: 12500, daily_withdrawn: 0 },
  '9792-0042': { balance: 850, daily_withdrawn: 0 },
  '5170-7788': { balance: 4200, daily_withdrawn: 0 },
  '5400-3311': { limit: 40000, debt: 8750, statement: 6200, minimum: 1240, due: '15.11.2026', daily_withdrawn: 0 },
}
// Aynı cihaz gövdesi, farklı bankaların terminalleri olarak kullanılabilir.
const TERMINALS = {
  ATM00684: { bank: '00061', name: 'Demo Bank' },
  ATM77120: { bank: '00099', name: 'Atlas Bank' },
}
const INITIAL_CASSETTES = {
  ATM00684: { 200: 40, 100: 60, 50: 80, 20: 6 },
  ATM77120: { 200: 30, 100: 50, 50: 40, 20: 30 },
}
const MTI = {
  '0100': 'Yetki isteği',
  '0110': 'Yetki yanıtı',
  '0200': 'Finansal istek',
  '0210': 'Finansal yanıt',
  '0400': 'İptal isteği',
  '0410': 'İptal yanıtı',
  '0420': 'İptal tekrarı (SAF)',
  '0430': 'İptal tekrarı yanıtı',
  '0500': 'Mutabakat isteği',
  '0510': 'Mutabakat yanıtı',
}
// Arıza enjeksiyonu: seçilen arıza bir sonraki uygun işlemde bir kez tetiklenir
const FAULTS_OFF = { jam: false, notTaken: false, timeout: false, cardJam: false }
const RETRACT_MS = 6000
const DENOMS = [200, 100, 50, 20]
const zeroNotes = () => Object.fromEntries(DENOMS.map((d) => [d, 0]))
const addNotes = (a, b, sign = 1) => Object.fromEntries(DENOMS.map((d) => [d, (a[d] || 0) + sign * (b[d] || 0)]))
// Teknisyen tarafı: cihaz durumları, kutular ve gün sonu sayaçları (terminal başına)
const newService = (cassettes, batch = 1) => ({
  cdm: 'ok',
  ptr: 'ok',
  saf: [], // yanıt alınamayan iptaller (store-and-forward)
  lastRecon: null, // son gün sonunun host / ATM karşılaştırması
  captured: 0,
  reject: zeroNotes(),
  retract: zeroNotes(),
  batch,
  opening: { ...cassettes },
  replenished: zeroNotes(),
  recycled: zeroNotes(),
  dispensed: zeroNotes(),
  rejected: zeroNotes(),
  retracted: zeroNotes(),
  debits: { count: 0, amount: 0 },
  credits: { count: 0, amount: 0 },
})
const INITIAL_SERVICES = Object.fromEntries(Object.entries(INITIAL_CASSETTES).map(([id, c]) => [id, newService(c)]))
const INPUT_RULES = { pin: 4, amount: 5, 'bill-sub': 10, cheque: 6, 'transfer-iban': 24, 'transfer-amount': 6 }
const PHONE_HOME = { step: 'home', op: 'withdraw', amount: '', message: null }
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
  const [terminalId, setTerminalId] = useState('ATM00684')
  const [allCassettes, setAllCassettes] = useState(INITIAL_CASSETTES)
  const [payees, setPayees] = useState([])
  const [fees, setFees] = useState({})
  const [log, setLog] = useState([])
  const [hops, setHops] = useState({ list: [], active: -1 })
  const [notice, setNotice] = useState(null)
  const [draft, setDraft] = useState({})
  const [device, setDevice] = useState(null)
  const [cardOut, setCardOut] = useState(false)
  const [cashOut, setCashOut] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [hostError, setHostError] = useState(null)
  const [phone, setPhone] = useState({ ...PHONE_HOME, customer: '4543-0001' })
  const [faults, setFaults] = useState(FAULTS_OFF)
  const [services, setServices] = useState(INITIAL_SERVICES)
  const [maintenance, setMaintenance] = useState(false)
  const [journal, setJournal] = useState([])
  // Hostun kendi defteri. Host durumsuz olduğu için imzalı kayıtlar burada tutulur;
  // gün sonu ve takasta hosta geri gönderilir, host yalnızca kendi imzasına güvenir.
  const [hostBook, setHostBook] = useState([])
  const [clearing, setClearing] = useState(null)
  const [backOfficeBusy, setBackOfficeBusy] = useState(false)
  const logId = useRef(0)
  const retractTimer = useRef(null)
  const retractRef = useRef(null)

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
    Promise.all([api('/api/cards', null), api('/api/payees', null)])
      .then(([c, p]) => {
        setCards(c)
        setPayees(p)
        addLog('info', 'Host simülatörüne bağlanıldı', `${c.length} demo kart yüklendi`)
      })
      .catch(() =>
        setHostError('Host simülatörüne ulaşılamıyor. Yerelde `npm run dev:api` komutunun çalıştığından emin olun.'),
      )
  }, [addLog])

  const terminal = TERMINALS[terminalId]
  const cassettes = allCassettes[terminalId]
  const setCassettes = (next) => setAllCassettes((c) => ({ ...c, [terminalId]: next }))
  const service = services[terminalId]
  const updService = (fn) => setServices((s) => ({ ...s, [terminalId]: fn(s[terminalId]) }))
  // On-us: kart, ATM'nin sahibi olan bankaya ait. Değilse BKM üzerinden kartın bankasına gider.
  const onUs = card ? card.bank === terminal.bank : true
  const isCredit = card?.type === 'credit'

  const playTrace = async (trace) => {
    for (let i = 0; i < trace.length; i++) {
      const h = trace[i]
      setHops({ list: trace, active: i })
      addLog('host', `${h.from} → ${h.to}`, `${h.proto} · ${h.ms} ms`)
      await sleep(Math.min(Math.max(h.ms * 7, 320), 760))
    }
    setHops({ list: trace, active: trace.length })
  }

  // lose: "host yanıtı kaybolsun" arızası. Host onaylar ve hesabı borçlandırır ama yanıt ATM'ye ulaşmaz.
  // quiet: arka ofis istekleri (SAF, takas) ATM ekranını değiştirmez
  const runHost = async (path, payload = {}, { lose = false, quiet = false } = {}) => {
    if (!quiet) setScreen('processing')
    let res
    try {
      res = await api(path, { terminal: terminalId, ...payload }, token)
    } catch (e) {
      setHostError(e.message)
      res = { approved: false, code: '91', message: 'Host sistemine ulaşılamadı' }
    }
    // Yanıt ATM'ye ulaşmasa da host kaydı kendi defterine yazmıştır
    if (res.record) setHostBook((b) => [...b, { ...res.record, settled: false, cleared: false }])
    if (res.iso) addLog('iso', `→ ${res.iso.request.mti} ${MTI[res.iso.request.mti] ?? ''}`, res.iso.request.fields)
    if (res.trace) await playTrace(res.trace)
    if (lose && res.approved) {
      setFaults((f) => ({ ...f, timeout: false }))
      await sleep(900)
      addLog('host', `← ${res.iso?.response.mti ?? 'Yanıt'} alınamadı · zaman aşımı`, 'Host onayladı ama yanıt ATM’ye ulaşmadı; ATM işlemin sonucunu bilmiyor')
      return { ...res, lost: true }
    }
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

  // Kartlı işlemde takılan kartın, kartsız (QR) işlemde mobil onayı veren müşterinin hesabı
  const accountId = card?.id ?? draft.customer
  const ledger = accountId ? ledgers[accountId] : null
  const updateLedger = (next, id = accountId) => setLedgers((l) => ({ ...l, [id]: { ...l[id], ...next } }))

  // Elektronik günlük (EJ): ATM'nin kendi denetim kaydı
  const ejId = useRef(0)
  const addEj = (txn, amount, result, pan = card?.pan_masked ?? 'KARTSIZ · QR') => {
    ejId.current += 1
    const entry = { id: ejId.current, time: new Date().toLocaleString('tr-TR'), terminal: terminalId, pan, txn, amount, result }
    setJournal((j) => [...j.slice(-299), entry])
  }

  const consumeFault = (k) => {
    if (!faults[k]) return false
    setFaults((f) => ({ ...f, [k]: false }))
    return true
  }

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
      const info = await api('/api/card/read', { card_id: c.id, terminal: terminalId })
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
      setFees(res.fees)
      // Başka banka ATM'sinde ücretler işlemden önce müşteriye gösterilir ve onayı alınır
      setScreen(res.on_us ? 'menu' : 'fee-notice')
    } else if (res.code === '75') {
      xfs('idc', 'WFS_CMD_IDC_RETAIN_CARD', 'Kart güvenlik nedeniyle alıkonuldu')
      setRetained((r) => ({ ...r, [card.id]: true }))
      updService((s) => ({ ...s, captured: s.captured + 1 }))
      addEj('PIN DOĞRULAMA', null, 'KART ALIKONDU · 75')
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
    if (consumeFault('cardJam')) {
      addLog('xfs', 'WFS_ERR_IDC_MEDIAJAM', 'Kart iade edilirken okuyucuda sıkıştı')
      xfs('idc', 'WFS_CMD_IDC_RETAIN_CARD', 'Kart alıkonma kutusuna alındı')
      setRetained((r) => ({ ...r, [card.id]: true }))
      updService((s) => ({ ...s, captured: s.captured + 1 }))
      addEj('KART İADESİ', null, 'KART SIKIŞTI · ALIKONDU')
      setToken(null)
      setCard(null)
      setDraft({})
      setNotice({ ok: false, title: 'Kartınız alıkonuldu', text: 'Kart teknik bir arıza nedeniyle iade edilemedi. Lütfen şubenize başvurun.' })
      return setScreen('result-final')
    }
    xfs('idc', 'WFS_CMD_IDC_EJECT_CARD', 'Kart iade ediliyor')
    setCardOut(true)
    setScreen('eject')
  }

  const finish = () => {
    setToken(null)
    setCard(null)
    setDraft({})
    setFees({})
    setInput('')
    setPhone((p) => ({ ...p, ...PHONE_HOME }))
    setScreen('goodbye')
    setTimeout(() => setScreen((s) => (s === 'goodbye' ? 'idle' : s)), 2400)
  }

  const takeCard = () => {
    if (!cardOut) return
    setCardOut(false)
    addLog('xfs', 'WFS_SRVE_IDC_MEDIAREMOVED', 'Müşteri kartı aldı')
    if (screen === 'take-card') presentCash(draft.notes)
    else finish()
  }

  const presentCash = (notes) => {
    setCashOut(notes)
    setScreen('take-cash')
    xfs('cdm', 'WFS_CMD_CDM_PRESENT', 'Shutter açıldı · banknotlar sunuldu')
    if (consumeFault('notTaken')) {
      setDraft((d) => ({ ...d, retractAt: Date.now() + RETRACT_MS }))
      retractTimer.current = setTimeout(() => retractRef.current(), RETRACT_MS)
    }
  }

  const takeCash = () => {
    clearTimeout(retractTimer.current)
    setCashOut(null)
    addLog('xfs', 'WFS_SRVE_CDM_ITEMSTAKEN', 'Banknotlar alındı · shutter kapandı')
    updService((s) => ({
      ...s,
      dispensed: addNotes(s.dispensed, cashOut),
      debits: { count: s.debits.count + 1, amount: s.debits.amount + draft.amount },
    }))
    addEj(draft.receipt[0][1], draft.amount, 'VERİLDİ')
    printReceipt(draft.receipt)
    finish()
  }

  // Müşteri parayı süresinde almazsa banknotlar geri çekilir ve işlem iptal edilir
  const retractCash = async () => {
    if (!cashOut) return
    setCashOut(null)
    xfs('cdm', 'WFS_CMD_CDM_RETRACT', `Banknotlar ${RETRACT_MS / 1000} sn içinde alınmadı · geri çekme kutusuna alındı`)
    updService((s) => ({ ...s, retract: addNotes(s.retract, cashOut), retracted: addNotes(s.retracted, cashOut) }))
    addEj(draft.receipt[0][1], draft.amount, 'GERİ ÇEKİLDİ · İPTAL')
    const { res, id } = draft.reversal
    await sendReversal(res, '17', id)
    setToken(null)
    setCard(null)
    setDraft({})
    setPhone((p) => ({ ...p, ...PHONE_HOME }))
    setNotice({ ok: false, title: 'Paranız geri çekildi', text: 'Banknotlar zamanında alınmadı. Tutar hesabınıza iade edildi.' })
    setScreen('result-final')
  }
  retractRef.current = retractCash

  // 0400 iptal: cihaz arızası ya da para alınmadığında hemen gider
  const sendReversal = async (res, reason, id) => {
    const rev = await runHost('/api/reversal', { reversal_token: res.reversal_token, reason, ledger: res.ledger })
    if (rev?.approved) updateLedger(rev.ledger, id)
    return rev
  }

  // Zaman aşımında ilk 0400 da yanıtsız kalır; mesaj store-and-forward kuyruğunda bekler
  const queueReversal = (res, id, amount) => {
    addLog('iso', '→ 0400 İptal isteği', 'Yanıt alınamadı (hat hâlâ yanıt vermiyor)')
    addLog('info', 'İptal mesajı SAF kuyruğuna alındı', 'Teknisyen → SAF kuyruğunu gönder ile 0420 olarak tekrar gönderilir')
    const item = { token: res.reversal_token, id, amount, rrn: res.iso?.response.fields['37'] }
    updService((s) => ({ ...s, saf: [...s.saf, item] }))
  }

  const flushSaf = async () => {
    const queue = service.saf
    setBackOfficeBusy(true)
    const local = { ...ledgers } // aynı hesaba ait birden çok iptal sırayla uygulanır
    addLog('info', 'SAF kuyruğu boşaltılıyor', `${queue.length} iptal mesajı 0420 olarak gönderiliyor`)
    for (const item of queue) {
      const rev = await runHost('/api/reversal', { reversal_token: item.token, reason: '68', ledger: local[item.id], repeat: true }, { quiet: true })
      if (!rev?.approved) continue
      local[item.id] = { ...local[item.id], ...rev.ledger }
      updateLedger(rev.ledger, item.id)
      updService((s) => ({ ...s, saf: s.saf.filter((q) => q.token !== item.token) }))
      addEj('İPTAL (SAF)', item.amount, 'İADE EDİLDİ', cards.find((c) => c.id === item.id)?.pan_masked)
    }
    setBackOfficeBusy(false)
  }

  const printReceipt = (lines) => {
    if (!lines) return
    if (service.ptr !== 'ok') {
      addLog('xfs', 'WFS_ERR_PTR_PAPEROUT', 'Fiş yazdırılamadı · kağıt yok')
      return
    }
    xfs('ptr', 'WFS_CMD_PTR_PRINT_FORM', 'Termal fiş yazdırılıyor')
    setReceipt({
      lines,
      card: card?.pan_masked ?? 'KARTSIZ İŞLEM · QR',
      date: new Date().toLocaleString('tr-TR'),
    })
  }

  const afterTxn = (res, title, text, receiptLines, extra = {}) => {
    setNotice({ ok: res.approved, title, text, ...extra })
    const txn = receiptLines?.find(([k]) => k === 'İŞLEM')?.[1] ?? title.toLocaleUpperCase('tr-TR')
    const amount = extra.amount ?? receiptLines?.find(([k]) => k === 'TUTAR')?.[1] ?? null
    addEj(txn, amount, res.approved ? 'ONAY' : `RED ${res.code}`)
    if (res.approved && receiptLines) printReceipt(receiptLines)
    setScreen('result')
  }

  const feeLine = (fee) => (fee ? [['ÜCRET', money(fee)]] : [])
  const remainingLine = (l) =>
    l.limit !== undefined ? ['KALAN LİMİT', money(l.limit - l.debt)] : ['KALAN BAKİYE', money(l.balance)]

  // --------------------------------------------------------------- işlemler
  const withdraw = async (amount) => {
    if (!amount || service.cdm !== 'ok') return
    xfs('cdm', 'WFS_CMD_CDM_DENOMINATE', `${money(amount)} için kaset planı isteniyor`)
    const res = await runHost('/api/withdraw', { amount, ledger, cassettes }, { lose: faults.timeout })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, `Talep edilen tutar: ${money(amount)}`)
    await dispense(res, amount, card.id, isCredit ? 'NAKİT AVANS' : 'PARA ÇEKME')
  }

  const cashFailed = (txn, amount, result, title, text) => {
    addEj(txn, amount, result)
    setNotice({ ok: false, title, text })
    setScreen('result')
  }

  // Host onayından sonra paranın verilmesi; arıza olursa 0400 ile iptal edilir
  const dispense = async (res, amount, id, txn, extraLines = [], cardless = false) => {
    updateLedger(res.ledger, id) // host hesabı borçlandırdı
    if (res.lost) {
      // Sonucu bilmeyen ATM para vermez ve güvenli tarafta kalmak için iptal gönderir
      queueReversal(res, id, amount)
      return cashFailed(
        txn,
        amount,
        'ZAMAN AŞIMI · İPTAL KUYRUKTA',
        'İşleminiz tamamlanamadı',
        'Bankadan yanıt alınamadı. Para verilmedi; hesabınızdan düşüldüyse iptal talebi iletilecek ve tutar iade edilecek.',
      )
    }
    setCassettes(res.cassettes)
    const mix = Object.entries(res.notes)
      .sort((a, b) => b[0] - a[0])
      .map(([d, n]) => `${n}×${d}`)
      .join(' + ')
    if (consumeFault('jam')) {
      xfs('cdm', 'WFS_CMD_CDM_DISPENSE', `Banknotlar kasetlerden çekiliyor: ${mix}`)
      await sleep(700)
      addLog('xfs', 'WFS_ERR_CDM_CASHUNITERROR', 'Taşıma yolunda sıkışma · banknotlar red kutusuna alındı, CDM devre dışı')
      updService((s) => ({ ...s, cdm: 'jam', reject: addNotes(s.reject, res.notes), rejected: addNotes(s.rejected, res.notes) }))
      await sendReversal(res, '22', id)
      return cashFailed(txn, amount, 'SIKIŞMA · İPTAL', 'Teknik arıza', 'Para verilemedi. Tutar hesabınıza iade edildi.')
    }
    xfs('cdm', 'WFS_CMD_CDM_DISPENSE', `Banknotlar kasetlerden çekildi: ${mix}`)
    setDraft((d) => ({
      ...d,
      notes: res.notes,
      amount,
      reversal: { res, id },
      receipt: [
        ['İŞLEM', txn],
        ['TUTAR', money(amount)],
        ...feeLine(res.fee),
        ['BANKNOT', mix],
        ['ONAY KODU', res.auth_code],
        remainingLine(res.ledger),
        ...extraLines,
      ],
    }))
    // Kartsız işlemde kart-önce-para adımı yok: banknotlar doğrudan sunulur
    if (cardless) return presentCash(res.notes)
    xfs('idc', 'WFS_CMD_IDC_EJECT_CARD', 'Önce kart iade edilir (card-before-cash)')
    setCardOut(true)
    setScreen('take-card')
  }

  const balance = async () => {
    const res = await runHost('/api/balance', { ledger })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, '')
    updateLedger(res.ledger)
    const c = res.credit
    const rows = c
      ? [
          ['Kart limiti', money(c.limit)],
          ['Güncel borç', money(c.debt)],
          ['Dönem borcu', money(c.statement)],
          ['Asgari ödeme', money(c.minimum)],
          ['Son ödeme', c.due],
        ]
      : []
    if (res.fee) rows.push(['İşlem ücreti', money(res.fee)])
    afterTxn(res, c ? 'Kullanılabilir limit' : 'Hesap bakiyeniz', c ? card.pan_masked : card.account, null, {
      amount: res.balance,
      rows,
    })
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
    const qr = draft.mode === 'qr'
    const res = await runHost(qr ? '/api/qr/deposit' : '/api/deposit', {
      ...(qr ? { approval: draft.approval } : {}),
      notes: draft.notes,
      suspect: draft.suspect || 0,
      ledger,
      cassettes,
    })
    if (!res) return
    if (res.approved) {
      updateLedger(res.ledger)
      setCassettes(res.cassettes)
      updService((s) => ({
        ...s,
        recycled: addNotes(s.recycled, res.accepted), // yalnızca kasetli kupürler sayılır
        credits: { count: s.credits.count + 1, amount: s.credits.amount + res.amount },
      }))
    }
    afterTxn(
      res,
      res.approved ? (isCredit ? 'Kart borcunuza ödendi' : 'Para yatırıldı') : res.message,
      res.retained_suspect
        ? `${res.retained_suspect} şüpheli banknot incelemeye alındı.`
        : isCredit
          ? 'Ödeme kart borcunuzdan düşüldü.'
          : 'Tutar hesabınıza geçti.',
      [
        ['İŞLEM', isCredit ? 'KART BORCU ÖDEME' : 'PARA YATIRMA'],
        ['TUTAR', money(res.amount || 0)],
        ['ŞÜPHELİ', `${res.retained_suspect || 0} ADET`],
        isCredit ? ['KALAN BORÇ', money(res.ledger?.debt || 0)] : ['YENİ BAKİYE', money(res.ledger?.balance || 0)],
        ...(qr ? [['QR REF', draft.qr.ref]] : []),
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

  // --------------------------------------------------------------- para transferi
  const chooseIban = (iban) => {
    setDraft({ iban })
    go('transfer-amount')
  }

  const ibanEntered = () => {
    if (input.length < 24) return
    chooseIban(`TR${input}`)
  }

  const transferInquiry = async () => {
    const amount = Number(input)
    if (!amount) return
    const res = await runHost('/api/transfer/inquiry', { iban: draft.iban, amount, ledger })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, draft.iban)
    setInput('')
    setDraft((d) => ({ ...d, amount, quote: res }))
    setScreen('transfer-confirm')
  }

  const transfer = async () => {
    const { iban, amount } = draft
    const res = await runHost('/api/transfer', { iban, amount, ledger })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, iban)
    updateLedger(res.ledger)
    // Gerçekleşen havale/FAST alıcının hesabına anında geçer; kuyruktaki EFT geçmez
    if (res.recipient_card) {
      setLedgers((l) => {
        const r = l[res.recipient_card]
        return { ...l, [res.recipient_card]: { ...r, balance: Math.round((r.balance + amount) * 100) / 100 } }
      })
    }
    afterTxn(
      res,
      res.message,
      `${res.method_text} · ${res.status}`,
      [
        ['İŞLEM', `${res.method_text.toLocaleUpperCase('tr-TR')} TRANSFER`],
        ['ALICI', res.masked_name],
        ['BANKA', res.bank.toLocaleUpperCase('tr-TR')],
        ['IBAN', `${iban.slice(0, 4)}…${iban.slice(-4)}`],
        ['TUTAR', money(amount)],
        ...feeLine(res.fee),
        ['DURUM', res.queued ? 'İLK İŞ GÜNÜ' : 'GERÇEKLEŞTİ'],
        remainingLine(res.ledger),
      ],
      { amount, rows: [['Alıcı', res.masked_name], ['Banka', res.bank], ['Yöntem', res.method_text]] },
    )
  }

  // --------------------------------------------------------------- kredi kartı borcu (hesaptan)
  const creditCardOf = (c) => cards.find((x) => x.type === 'credit' && x.holder === c.holder && x.bank === c.bank)

  const creditInquiry = async () => {
    const cc = creditCardOf(card)
    if (!cc) {
      setNotice({ ok: false, title: 'Kredi kartı bulunamadı', text: 'Bu müşteriye ait Demo Bank kredi kartı yok.' })
      return setScreen('result')
    }
    const res = await runHost('/api/credit/inquiry', { credit_card_id: cc.id, credit_ledger: ledgers[cc.id] })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, '')
    setDraft({ cc: cc.id, debt: res })
    setScreen('cc-pay')
  }

  const creditPay = async (amount) => {
    const ccId = draft.cc
    const res = await runHost('/api/credit/pay', { credit_card_id: ccId, amount, ledger, credit_ledger: ledgers[ccId] })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, '')
    updateLedger(res.ledger)
    updateLedger(res.credit_ledger, ccId)
    afterTxn(
      res,
      res.message,
      res.pan_masked,
      [
        ['İŞLEM', 'KART BORCU ÖDEME'],
        ['KART', res.pan_masked],
        ['TUTAR', money(amount)],
        ['KALAN BORÇ', money(res.credit_ledger.debt)],
        remainingLine(res.ledger),
      ],
      { amount, rows: [['Kalan kart borcu', money(res.credit_ledger.debt)]] },
    )
  }

  // --------------------------------------------------------------- kartsız işlem (QR)
  const startQr = async () => {
    if (screen !== 'idle' && screen !== 'qr') return
    setNotice(null)
    setReceipt(null)
    setPhone((p) => ({ ...p, ...PHONE_HOME }))
    addLog('info', 'Müşteri kartsız işlem (QR) seçti')
    const res = await runHost('/api/qr/create')
    if (!res) return
    if (!res.approved) {
      setNotice({ ok: false, title: res.message, text: 'Kartsız işlem başlatılamadı.' })
      return setScreen('result-final')
    }
    addLog('info', 'QR kodu ekranda gösteriliyor', `${res.payload} · ${res.expires_in} sn geçerli`)
    setDraft({ mode: 'qr', qr: { ...res, expiresAt: Date.now() + res.expires_in * 1000 } })
    setScreen('qr')
  }

  const cancelQr = () => {
    addLog('info', 'Kartsız işlem iptal edildi')
    setDraft({})
    setNotice(null)
    setPhone((p) => ({ ...p, ...PHONE_HOME }))
    setScreen('idle')
  }

  const scanQr = () => {
    if (screen !== 'qr') return
    addLog('info', 'Mobil uygulama QR kodu okudu', draft.qr.payload)
    setPhone((p) => ({ ...p, step: 'scanned', message: null }))
  }

  const approveQr = async () => {
    const { customer, op } = phone
    const amount = op === 'withdraw' ? Number(phone.amount) : 0
    if (op === 'withdraw' && service.cdm !== 'ok')
      return setPhone((p) => ({ ...p, message: 'Bu ATM şu anda para veremiyor. Para yatırmayı deneyin.' }))
    setPhone((p) => ({ ...p, step: 'waiting', message: null }))
    const res = await runHost('/api/qr/approve', { qr: draft.qr.qr, card_id: customer, op, amount, ledger: ledgers[customer] })
    if (!res) return
    if (!res.approved) {
      setPhone((p) => ({ ...p, step: res.code === '33' ? 'home' : 'scanned', message: res.message }))
      return setScreen('qr')
    }
    setPhone((p) => ({ ...p, step: 'done' }))
    setDraft((d) => ({ ...d, customer, approval: res.approval }))
    addLog('host', 'ATM onay durumunu sorguladı', `Mobil onay alındı · ${op === 'withdraw' ? money(amount) + ' çekim' : 'para yatırma'}`)
    if (op === 'withdraw') return qrWithdraw(customer, res.approval, amount)
    setDraft((d) => ({ ...d, notes: {}, suspect: 0 }))
    setScreen('deposit')
  }

  const qrWithdraw = async (customer, approval, amount) => {
    xfs('cdm', 'WFS_CMD_CDM_DENOMINATE', `${money(amount)} için kaset planı isteniyor`)
    const res = await runHost('/api/qr/withdraw', { approval, ledger: ledgers[customer], cassettes }, { lose: faults.timeout })
    if (!res) return
    if (!res.approved) return afterTxn(res, res.message, `Talep edilen tutar: ${money(amount)}`)
    await dispense(res, amount, customer, 'QR PARA ÇEKME', [['QR REF', draft.qr.ref]], true)
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
    else if (screen === 'transfer-iban') ibanEntered()
    else if (screen === 'transfer-amount') transferInquiry()
  }

  const onCancel = () => {
    if (['idle', 'reading', 'processing', 'eject', 'take-card', 'take-cash', 'goodbye', 'cheque-scan'].includes(screen)) return
    if (screen === 'result-final') return setScreen('idle')
    if (draft.mode === 'qr') return cancelQr()
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
    finish,
    startQr,
    cancelQr,
    chooseIban,
    transfer,
    creditInquiry,
    creditPay,
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

  // --------------------------------------------------------------- teknisyen / operatör
  const toggleMaintenance = () => {
    if (!maintenance && screen !== 'idle') return
    const on = !maintenance
    setMaintenance(on)
    setScreen(on ? 'maintenance' : 'idle')
    addLog('info', on ? 'Operatör bakım moduna geçti' : 'Operatör bakım modundan çıktı', on ? 'Terminal hizmet dışı (out of service)' : 'Terminal hizmete açıldı')
    addEj(on ? 'BAKIM MODU' : 'HİZMETE AÇILDI', null, 'OPERATÖR', '—')
  }

  const refill = () => {
    const added = Object.fromEntries(DENOMS.map((d) => [d, CAPACITY[d] - (cassettes[d] || 0)]))
    xfs('cdm', 'WFS_CMD_CDM_START_EXCHANGE', 'Kaset değişimi başladı')
    setCassettes({ ...CAPACITY })
    updService((s) => ({ ...s, replenished: addNotes(s.replenished, added) }))
    const value = DENOMS.reduce((sum, d) => sum + d * added[d], 0)
    addLog('xfs', 'WFS_CMD_CDM_END_EXCHANGE', `Kasetler dolduruldu · eklenen ${money(value)}`)
    addEj('KASET İKMALİ', value, 'OPERATÖR', '—')
  }

  const clearFaults = () => {
    if (service.cdm !== 'ok') xfs('cdm', 'WFS_CMD_CDM_RESET', 'Sıkışma giderildi · CDM hizmette')
    if (service.ptr !== 'ok') addLog('xfs', 'WFS_CMD_PTR_RESET', 'Yeni fiş rulosu takıldı · yazıcı hizmette')
    updService((s) => ({ ...s, cdm: 'ok', ptr: 'ok' }))
    addEj('ARIZA GİDERME', null, 'OPERATÖR', '—')
  }

  const emptyBins = () => {
    const value = DENOMS.reduce((sum, d) => sum + d * ((service.reject[d] || 0) + (service.retract[d] || 0)), 0)
    addLog('info', 'Red ve geri çekme kutuları boşaltıldı', `${money(value)} · ${service.captured} alıkonan kart şubeye teslim`)
    updService((s) => ({ ...s, reject: zeroNotes(), retract: zeroNotes(), captured: 0 }))
    // Demo kolaylığı: teslim edilen kartlar cüzdana geri döner
    setRetained({})
    setTries({})
    addEj('KUTU BOŞALTMA', value, 'OPERATÖR', '—')
  }

  const settle = async () => {
    const records = hostBook.filter((r) => r.terminal === terminalId && !r.settled)
    const res = await runHost('/api/settlement', { batch: service.batch, totals: { debits: service.debits, credits: service.credits }, records })
    setScreen('maintenance')
    if (!res?.reconciliation) return
    updService((s) => ({ ...s, lastRecon: { ...res.reconciliation, at: new Date().toLocaleString('tr-TR') } }))
    if (!res.approved) {
      addEj('GÜN SONU', null, 'MUTABAKAT FARKI · 95', '—')
      if (service.saf.length)
        addLog('info', `SAF kuyruğunda ${service.saf.length} iptal bekliyor`, 'Host bu çekimleri borçlandırdı ama ATM para vermedi; kuyruğu gönderip gün sonunu tekrarlayın')
      return
    }
    const ids = new Set(res.settled_ids)
    setHostBook((b) => b.map((r) => (ids.has(r.id) ? { ...r, settled: true } : r)))
    addEj('GÜN SONU', service.debits.amount - service.credits.amount, `DÖNEM ${service.batch} KAPANDI`, '—')
    // Yeni dönem: sayaçlar sıfırlanır, cihaz durumu ve kutular olduğu gibi kalır
    const keep = ['cdm', 'ptr', 'captured', 'reject', 'retract', 'saf', 'lastRecon']
    updService((cur) => ({ ...newService(cassettes, res.batch), ...Object.fromEntries(keep.map((k) => [k, cur[k]])) }))
  }

  // Bankalar arası takas: BKM, FAST / EFT ve çek takası bankanın gün sonu defterinden
  const runClearing = async () => {
    const records = hostBook.filter((r) => !r.cleared)
    setBackOfficeBusy(true)
    const res = await runHost('/api/clearing', { records }, { quiet: true })
    setBackOfficeBusy(false)
    if (!res?.approved) return
    setLedgers((l) => {
      const next = { ...l }
      for (const p of res.postings) next[p.card] = { ...next[p.card], balance: Math.round((next[p.card].balance + p.amount) * 100) / 100 }
      return next
    })
    const ids = new Set(res.cleared_ids)
    setHostBook((b) => b.map((r) => (ids.has(r.id) ? { ...r, cleared: true } : r)))
    setClearing(res)
    addLog('info', 'Takas oturumu tamamlandı', `${res.cleared_ids.length} kayıt · ${res.postings.length} hesaba alacak kaydı`)
  }

  const switchTerminal = (id) => {
    if (screen !== 'idle') return
    setTerminalId(id)
    setHops({ list: [], active: -1 })
    addLog('info', `Terminal değişti: ${TERMINALS[id].name} ATM'si`, `${id} · acquirer banka kodu ${TERMINALS[id].bank}`)
  }

  const resetAll = () => {
    clearTimeout(retractTimer.current)
    setLedgers(INITIAL_LEDGERS)
    setAllCassettes(INITIAL_CASSETTES)
    setServices(INITIAL_SERVICES)
    setFaults(FAULTS_OFF)
    setMaintenance(false)
    setJournal([])
    setHostBook([])
    setClearing(null)
    setFees({})
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
    setDraft({})
    setPhone((p) => ({ ...p, ...PHONE_HOME }))
    setScreen('idle')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">NCR SelfServ 84 · Terminal {terminalId}</p>
          <h1>ATM Simülatörü</h1>
        </div>
        <div className="topbar-actions">
          <label className="terminal-pick">
            <span>ATM</span>
            <select
              value={terminalId}
              disabled={screen !== 'idle'}
              onChange={(e) => switchTerminal(e.target.value)}
              title={screen !== 'idle' ? 'Terminal yalnızca boşta değiştirilebilir' : undefined}
            >
              {Object.entries(TERMINALS).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name} · {id}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ghost" onClick={resetAll}>
            Simülasyonu sıfırla
          </button>
        </div>
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
            brand={terminal.name}
            terminalId={terminalId}
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
            <Screen
              screen={screen}
              card={card}
              input={input}
              notice={notice}
              draft={draft}
              actions={actions}
              terminal={terminal}
              onUs={onUs}
              fees={fees}
              ledger={ledger}
              service={service}
              payees={payees.filter((p) => p.iban !== card?.account)}
            />
          </AtmMachine>
          <Wallet
            cards={cards}
            active={card?.id}
            retained={retained}
            disabled={screen !== 'idle'}
            terminalBank={terminal.bank}
            onInsert={insertCard}
          />
          <Phone
            cards={cards}
            phone={phone}
            canScan={screen === 'qr'}
            qrRef={draft.qr?.ref}
            onChange={(patch) => setPhone((p) => ({ ...p, ...patch, message: null }))}
            onScan={scanQr}
            onApprove={approveQr}
            onBack={() => setPhone((p) => ({ ...p, ...PHONE_HOME }))}
          />
        </section>

        <section className="col-insight">
          <FlowDiagram
            hops={hops}
            meta={
              draft.mode === 'qr'
                ? 'Kartsız · QR + mobil onay'
                : !card
                  ? `${terminal.name} ATM'si`
                  : onUs
                    ? `On-us · ${card.bank_name} kartı, ${terminal.name} ATM'si`
                    : `Not-on-us · ${card.bank_name} kartı, BKM rotası`
            }
          />
          <StatusPanel
            cassettes={cassettes}
            terminalId={terminalId}
            ledgers={ledgers}
            cards={cards}
            active={accountId}
          />
          <ServicePanel
            faults={faults}
            onFault={(k, v) => setFaults((f) => ({ ...f, [k]: v }))}
            onPaperOut={() => {
              updService((s) => ({ ...s, ptr: 'paper-out' }))
              addLog('xfs', 'WFS_SRVE_PTR_PAPERTHRESHOLD', 'Fiş kağıdı bitti · fişsiz çalışma')
            }}
            service={service}
            cassettes={cassettes}
            terminalId={terminalId}
            maintenance={maintenance}
            canToggle={maintenance || screen === 'idle'}
            busy={screen === 'processing' || backOfficeBusy}
            onToggleMaintenance={toggleMaintenance}
            onRefill={refill}
            onClearFaults={clearFaults}
            onEmptyBins={emptyBins}
            onSettle={settle}
            onFlushSaf={flushSaf}
            backOffice={(screen === 'idle' || screen === 'maintenance') && !backOfficeBusy}
            hostBook={hostBook}
            clearing={clearing}
            onClearing={runClearing}
            cards={cards}
            journal={journal.filter((e) => e.terminal === terminalId)}
          />
          <EventLog entries={log} />
        </section>
      </main>
    </div>
  )
}
