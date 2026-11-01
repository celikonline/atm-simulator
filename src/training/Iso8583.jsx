import { useState } from 'react'
import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- veri
// [alan, ad, biçim, açıklama, simülatör kullanıyor mu]
const FIELDS = [
  [2, 'Birincil hesap no (PAN)', 'n..19 LLVAR', 'Kart numarası. Başına uzunluk öneki (LL) gelir; bu yüzden değişken uzunlukta olabilir.', true],
  [3, 'İşlem kodu', 'n 6', 'Üç çift hane: işlem türü · hesaptan · hesaba. 00 satın alma, 01 nakit çekme, 20 iade, 31 bakiye sorgu, 40 transfer. Hesap türü: 00 belirtilmedi, 10 tasarruf, 20 vadesiz, 30 kredi kartı.', true],
  [4, 'İşlem tutarı', 'n 12', 'Kuruş cinsinden, sıfırla doldurulmuş: 500,00 TL → 000000050000.', true],
  [7, 'İletim tarih/saati', 'n 10', 'MMDDhhmmss biçiminde (normalde GMT).', true],
  [11, 'STAN', 'n 6', 'System Trace Audit Number: gönderenin işlem sıra numarası. Yanıtta aynen döner, istek–yanıt eşleştirmesinin anahtarıdır.', true],
  [12, 'Yerel saat', 'n 6', 'Terminalin yerel saati, hhmmss.', true],
  [13, 'Yerel tarih', 'n 4', 'Terminalin yerel tarihi, MMDD.', true],
  [14, 'Son kullanma tarihi', 'n 4', 'YYAA.', false],
  [18, 'Satıcı kategori kodu (MCC)', 'n 4', 'İş yeri türü. 6011 = ATM’den nakit çekim.', false],
  [22, 'POS giriş modu', 'n 3', 'İlk iki hane kartın nasıl okunduğunu verir: 02 manyetik şerit, 05 çip, 07 temassız çip, 80 çipten şeride fallback. Üçüncü hane PIN yetisi.', false],
  [23, 'Kart sıra numarası', 'n 3', 'Aynı PAN ile basılmış kartları ayırır (EMV PSN).', false],
  [25, 'POS koşul kodu', 'n 2', '00 normal; 02 gözetimsiz terminal gibi değerler.', false],
  [28, 'İşlem ücreti', 'x+n 8', 'C/D işareti + 8 hane tutar. Simülatörde D + kuruş (ör. D00000500).', true],
  [32, 'Acquirer kurum kodu', 'n..11 LLVAR', 'İşlemi ağa sokan (ATM’nin sahibi) bankanın kodu.', false],
  [35, 'Track 2 verisi', 'z..37 LLVAR', 'Manyetik şerit ya da çip eşdeğeri: PAN, ayraç (=), son kullanma, servis kodu.', false],
  [37, 'Referans no (RRN)', 'an 12', 'İşlemi sonradan bulmak için (itiraz, iade). Simülatörde yıl+gün+saat+sayaç.', true],
  [38, 'Onay kodu', 'an 6', 'Issuer onay verdiğinde yanıtta döner.', true],
  [39, 'Yanıt kodu', 'an 2', '00 = onay. Sonucun makine tarafından okunan hali; ayrıntı aşağıdaki tabloda.', true],
  [41, 'Terminal kimliği', 'ans 8', 'ATM/POS’un numarası (ATM00684).', true],
  [42, 'Kabul eden kimliği', 'ans 15', 'Üye işyeri numarası.', false],
  [43, 'Kabul eden adı/yeri', 'ans 40', 'İş yeri adı, şehir, ülke.', false],
  [48, 'Ek özel veri', 'ans..999 LLLVAR', 'Kuruma özel serbest alan. Simülatör kartsız işlemde “Kartsız işlem · QR …” yazar.', true],
  [49, 'İşlem para birimi', 'n 3', 'ISO 4217 sayısal kodu: 949 TRY, 840 USD, 978 EUR.', true],
  [52, 'PIN verisi', 'b 64', 'Şifreli PIN bloğu (8 bayt). Açık PIN ağda asla taşınmaz.', true],
  [54, 'Ek tutarlar', 'an..120 LLLVAR', 'Bakiye gibi ek tutarlar. Bakiye sorgusunun yanıtı bunu kullanır.', true],
  [55, 'ICC (çip) verisi', 'b..255 LLLVAR', 'EMV TLV verisi: ARQC, ATC, TVR… Ayrıntısı EMV sayfasında.', false],
  [70, 'Ağ yönetim kodu', 'n 3', '001 sign-on, 002 sign-off, 101 anahtar değişimi, 301 echo test.', false],
  [90, 'Orijinal veri öğeleri', 'n 42', 'İptalde asıl işlemi gösterir: MTI + STAN + tarih/saat + acquirer + forwarding kodu.', true],
  [102, 'Hesap no 1 (gönderen)', 'ans..28 LLVAR', 'Hesaptan.', false],
  [103, 'Hesap no 2 (alıcı)', 'ans..28 LLVAR', 'Hesaba. Simülatör transferde IBAN’ı, kart borcu ödemede kart numarasını buraya koyar.', true],
  [128, 'MAC', 'b 64', 'Mesajın bütünlüğünü ve kaynağını doğrulayan kod.', false],
]
const NAME = Object.fromEntries(FIELDS.map(([no, name]) => [no, name]))
const LLVAR = new Set([2, 32, 35, 102, 103])

const MTI_NAMES = {
  '0100': 'Yetki isteği',
  '0110': 'Yetki yanıtı',
  '0200': 'Finansal istek',
  '0210': 'Finansal yanıt',
  '0220': 'Finansal advice',
  '0400': 'İptal isteği',
  '0410': 'İptal yanıtı',
  '0420': 'İptal tekrarı (advice)',
  '0430': 'İptal tekrarı yanıtı',
  '0500': 'Mutabakat isteği',
  '0510': 'Mutabakat yanıtı',
  '0800': 'Ağ yönetimi isteği',
  '0810': 'Ağ yönetimi yanıtı',
}
const MTI_DIGITS = [
  ['Sürüm', { 0: 'ISO 8583:1987', 1: 'ISO 8583:1993', 2: 'ISO 8583:2003', 8: 'Ulusal kullanım', 9: 'Özel kullanım' }],
  [
    'Mesaj sınıfı',
    {
      1: 'Yetkilendirme (authorization)',
      2: 'Finansal (financial)',
      3: 'Dosya işlemleri',
      4: 'Ters kayıt / iptal (reversal)',
      5: 'Mutabakat (reconciliation)',
      6: 'Yönetim (administrative)',
      7: 'Ücret toplama',
      8: 'Ağ yönetimi (network management)',
    },
  ],
  ['Mesaj işlevi', { 0: 'İstek (request)', 1: 'İstek yanıtı', 2: 'Advice (bilgi)', 3: 'Advice yanıtı', 4: 'Bildirim (notification)' }],
  ['Kaynak', { 0: 'Acquirer', 1: 'Acquirer tekrarı (repeat)', 2: 'Issuer', 3: 'Issuer tekrarı', 4: 'Diğer', 5: 'Diğer tekrarı' }],
]

// Alan listesinden bitmap üretir: 1. bit "ikincil bitmap var" bayrağıdır.
function buildBitmap(nums) {
  const secondary = nums.some((n) => n > 64)
  const bits = Array(secondary ? 128 : 64).fill(0)
  if (secondary) bits[0] = 1
  nums.forEach((n) => (bits[n - 1] = 1))
  let hex = ''
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4).join(''), 2).toString(16).toUpperCase()
  return hex
}

function parseBitmap(hex) {
  const bits = [...hex].flatMap((c) => parseInt(c, 16).toString(2).padStart(4, '0').split('').map(Number))
  return bits
}

// ---------------------------------------------------------------- örnek mesajlar (simülatörün 500 TL çekimi)
const REQUEST = [
  [2, '4543990000010001', 'Kart numarası (örnek, uydurma). Gerçekte günlüğe maskelenerek yazılır.'],
  [3, '010000', '01 = nakit çekme · 00 = vadesiz hesaptan · 00 = hesaba (belirtilmedi)'],
  [4, '000000050000', '500,00 — kuruş cinsinden 12 hane'],
  [7, '1101123456', '1 Kasım, 12:34:56 (MMDDhhmmss)'],
  [11, '004217', 'STAN: ATM’nin 4217. işlemi'],
  [12, '123456', 'Yerel saat 12:34:56'],
  [13, '1101', 'Yerel tarih 1 Kasım'],
  [41, 'ATM00684', 'İsteği gönderen terminal'],
  [49, '949', 'Para birimi TRY'],
]
const RESPONSE = [
  [2, '4543990000010001', 'İstekten aynen'],
  [3, '010000', 'İstekten aynen'],
  [4, '000000050000', 'İstekten aynen'],
  [7, '1101123456', 'İstekten aynen'],
  [11, '004217', 'Aynen döner: ATM yanıtı bu STAN ile eşler'],
  [12, '123456', 'İstekten aynen'],
  [13, '1101', 'İstekten aynen'],
  [37, '263051200417', 'Issuer’ın verdiği referans numarası (RRN)'],
  [38, '482915', 'Onay kodu — fişte “ONAY KODU” olarak basılır'],
  [39, '00', 'Onaylandı'],
  [41, 'ATM00684', 'İstekten aynen'],
  [49, '949', 'İstekten aynen'],
]

function encodeField(no, v) {
  return LLVAR.has(no) ? String(v.length).padStart(2, '0') + v : v
}

function Anatomy({ mti, fields }) {
  const bitmap = buildBitmap(fields.map(([n]) => n))
  const segs = [
    { k: 'MTI', t: mti, c: 'mti' },
    { k: 'Bitmap', t: bitmap, c: 'bmp' },
    ...fields.map(([n, v]) => ({ k: `Alan ${n}`, t: encodeField(n, v), c: 'de' })),
  ]
  return (
    <>
      <div className="iso-raw" role="group" aria-label={`${mti} mesajının ham hali`}>
        {segs.map((s) => (
          <span key={s.k} className={`iso-seg ${s.c}`}>
            <code>{s.t}</code>
            <small>{s.k}</small>
          </span>
        ))}
      </div>
      <Table
        head={['Alan', 'Ad', 'Değer', 'Anlamı']}
        rows={[
          ['MTI', 'Mesaj türü', <code key="m">{mti}</code>, MTI_NAMES[mti]],
          ['Bitmap', `${fields.map(([n]) => n).join(', ')} alanları var`, <code key="b">{bitmap}</code>, 'Hangi alanların mesajda bulunduğunu işaretler (aşağıda çözümlü)'],
          ...fields.map(([n, v, why]) => [n, NAME[n], <code key={n}>{encodeField(n, v)}</code>, why]),
        ]}
      />
    </>
  )
}

// ---------------------------------------------------------------- etkileşimli çözücüler
function MtiLab() {
  const [mti, setMti] = useState('0200')
  const ok = /^\d{4}$/.test(mti)
  return (
    <div className="tr-lab">
      <div className="tr-lab-row">
        <label>
          MTI
          <input
            className="tr-input mono"
            value={mti}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setMti(e.target.value.replace(/\D/g, ''))}
            aria-describedby="mti-name"
          />
        </label>
        <div className="tr-chips" aria-label="Hazır örnekler">
          {Object.keys(MTI_NAMES).map((m) => (
            <button key={m} type="button" className={`tr-chip ${m === mti ? 'on' : ''}`} onClick={() => setMti(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <p id="mti-name" className="tr-lab-out">
        {ok ? <b>{MTI_NAMES[mti] ?? 'Bu birleşim sık kullanılanlar arasında değil — haneleri aşağıdan okuyun'}</b> : 'Dört haneli bir MTI girin.'}
      </p>
      {ok && (
        <div className="tr-digits">
          {MTI_DIGITS.map(([title, map], i) => (
            <div key={title} className="tr-digit">
              <span className="d">{mti[i]}</span>
              <small>{title}</small>
              <b>{map[mti[i]] ?? '—'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PRESETS = {
  'İstek (0200)': buildBitmap([2, 3, 4, 7, 11, 12, 13, 41, 49]),
  'Yanıt (0210)': buildBitmap([2, 3, 4, 7, 11, 12, 13, 37, 38, 39, 41, 49]),
  'Transfer (alan 103 ile)': buildBitmap([2, 3, 4, 7, 11, 12, 13, 28, 41, 49, 103]),
}

function BitmapLab() {
  const [hex, setHex] = useState(PRESETS['İstek (0200)'])
  const clean = hex.replace(/\s/g, '').toUpperCase()
  const valid = /^([0-9A-F]{16}|[0-9A-F]{32})$/.test(clean)
  const bits = valid ? parseBitmap(clean) : []
  const hasSecondary = bits[0] === 1
  const warn = !valid
    ? 'Birincil bitmap 16, ikincil ile birlikte 32 onaltılık hane olmalı.'
    : hasSecondary && clean.length === 16
      ? '1. bit 1 ama ikincil bitmap yok — mesaj bozuk.'
      : !hasSecondary && clean.length === 32
        ? '1. bit 0 olduğu halde ikincil bitmap gelmiş.'
        : null
  const present = bits.map((b, i) => (b && i > 0 ? i + 1 : 0)).filter(Boolean)
  return (
    <div className="tr-lab">
      <div className="tr-lab-row">
        <label>
          Bitmap (hex)
          <input className="tr-input mono wide" value={hex} onChange={(e) => setHex(e.target.value)} spellCheck={false} aria-invalid={!valid} />
        </label>
        <div className="tr-chips" aria-label="Hazır örnekler">
          {Object.entries(PRESETS).map(([label, v]) => (
            <button key={label} type="button" className={`tr-chip ${v === clean ? 'on' : ''}`} onClick={() => setHex(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {warn && <p className="tr-lab-warn" role="alert">{warn}</p>}
      {valid && (
        <>
          <div className="bm-grid" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }} aria-hidden="true">
            {bits.map((b, i) => (
              <span key={i} className={`bm-cell ${b ? 'on' : ''} ${i === 0 ? 'flag' : ''} ${i === 64 ? 'sec' : ''}`} title={`Bit ${i + 1}${NAME[i + 1] ? ' · ' + NAME[i + 1] : ''}`}>
                {i + 1}
              </span>
            ))}
          </div>
          <p className="tr-lab-out">
            <b>{present.length} veri alanı var:</b>
          </p>
          <div className="tr-chips">
            {present.map((n) => (
              <span key={n} className="tr-tag">
                <code>{n}</code> {NAME[n] ?? 'Alan ' + n}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- sayfa
const ACT = {
  atm: { id: 'atm', label: 'ATM', sub: 'Terminal' },
  sw: { id: 'sw', label: 'ATM Switch', sub: 'Acquirer tarafı' },
  host: { id: 'host', label: 'Banka Host', sub: 'Core + HSM' },
  bkm: { id: 'bkm', label: 'BKM', sub: 'Ulusal ağ' },
  issuer: { id: 'issuer', label: 'Karşı Banka', sub: 'Issuer' },
}

export default function Iso8583() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Ödeme mesajlaşması"
        title="ISO 8583"
        lead="ATM, POS, ağ (BKM, Visa, Mastercard) ve banka sistemleri kartlı işlemleri aynı dilde konuşsun diye var. Simülatördeki günlükte gördüğünüz “→ 0200”, “← 0210 · Alan 39 = 00” satırlarının tamamı bu standarttır."
      />

      <h2 id="giris">ISO 8583 nedir?</h2>
      <p>
        ISO 8583, kart kaynaklı finansal işlemler için <b>mesaj formatı standardıdır</b>. Bir ATM’de PIN girdiğinizde ya da bir POS’ta kartınızı
        okuttuğunuzda, cihaz ile banka arasında bu formatta bir <b>istek</b> gider ve bir <b>yanıt</b> döner. Standart; mesajın hangi parçalardan
        oluştuğunu, hangi bilginin hangi alanda taşınacağını ve sonucun hangi kodla bildirileceğini tanımlar.
      </p>
      <ul>
        <li>
          <b>Üç sürüm</b> vardır: 1987 (en yaygın), 1993 ve 2003. Sahada hâlâ ağırlıklı olarak 1987 kullanılır.
        </li>
        <li>
          <b>Ağa özel “lehçeler”</b> vardır: ISO 8583 bir çerçevedir. Visa, Mastercard, BKM gibi her ağ hangi alanı nasıl kullanacağını kendi
          şartnamesinde belirler. Aynı 0200 mesajı iki ağda küçük farklar taşıyabilir.
        </li>
        <li>
          Mesaj <b>ikili (binary) ya da metin (ASCII/EBCDIC)</b> olarak, genellikle TCP üzerinden ve TLS ya da özel hat ile taşınır. Başına 2
          baytlık bir uzunluk başlığı eklenmesi yaygındır (standardın parçası değil, taşıma katmanının işi).
        </li>
      </ul>
      <Callout title="Simülatörle ilişkisi">
        Simülatör ATM ile switch arasındaki gerçek protokol olan NDC/DDC’yi değil, host tarafındaki ISO 8583 mesajlarını gösterir. Her işlemde{' '}
        <b>Olay günlüğü</b> panelinde istek ve yanıt mesajlarının alanlarını açabilirsiniz.
      </Callout>

      <h2 id="mesaj">Mesajın anatomisi</h2>
      <p>Her ISO 8583 mesajı, sırayla dört parçadan oluşur:</p>
      <div className="iso-anatomy" role="img" aria-label="Mesaj yapısı: uzunluk başlığı, MTI, bitmap, veri alanları">
        <div className="part opt">
          <b>Uzunluk başlığı</b>
          <span>2 bayt · isteğe bağlı, taşıma katmanı</span>
        </div>
        <div className="part mti">
          <b>MTI</b>
          <span>4 hane · mesajın ne olduğu</span>
        </div>
        <div className="part bmp">
          <b>Bitmap</b>
          <span>8 bayt (+8) · hangi alanlar var</span>
        </div>
        <div className="part de">
          <b>Veri alanları</b>
          <span>Bitmap’te 1 olanlar, sırayla</span>
        </div>
      </div>
      <p>
        Bitmap sayesinde mesajda yalnızca gerekli alanlar bulunur. 128 alanın hepsini göndermek yerine, işleme uygun 8–12 alan seçilir. Aşağıda
        simülatörün 500 TL’lik bir para çekme işlemi için ürettiği mesaj çifti ham halde ve alan alan çözümlenmiş olarak görünüyor.
      </p>
      <Tabs
        label="Örnek mesaj çifti"
        tabs={[
          { label: '0200 · İstek', content: <Anatomy mti="0200" fields={REQUEST} /> },
          { label: '0210 · Yanıt', content: <Anatomy mti="0210" fields={RESPONSE} /> },
        ]}
      />
      <h3>Veri tipleri ve uzunluk öneki</h3>
      <Table
        head={['Gösterim', 'Anlamı', 'Örnek']}
        rows={[
          [<code key="1">n 6</code>, 'Sayısal, sabit 6 hane', <code key="a">010000</code>],
          [<code key="2">an 12</code>, 'Harf+rakam, sabit 12 karakter', <code key="b">263051200417</code>],
          [<code key="3">ans 8</code>, 'Harf, rakam ve özel karakter', <code key="c">ATM00684</code>],
          [<code key="4">b 64</code>, 'İkili veri, 64 bit (8 bayt)', <code key="d">PIN bloğu</code>],
          [<code key="5">z</code>, 'Track 2 karakter kümesi', <code key="e">4543…=2812…</code>],
          [<code key="6">n..19 LLVAR</code>, 'En çok 19 hane; başında 2 haneli uzunluk', <code key="f">16 4543990000010001</code>],
          [<code key="7">LLLVAR</code>, 'Başında 3 haneli uzunluk (daha uzun alanlar)', <code key="g">003 abc</code>],
        ]}
      />

      <h2 id="mti">MTI: mesaj türü</h2>
      <p>
        MTI dört hanedir ve her hane ayrı bir anlam taşır: <b>sürüm · sınıf · işlev · kaynak</b>. Bu yüzden 0200’ü “1987 sürümü, finansal,
        istek, acquirer’dan” diye okursunuz. Yanıt mesajı, istek MTI’sının işlev hanesine 1 eklenmiş halidir (0200 → 0210).
      </p>
      <MtiLab />
      <Callout tone="warn" title="Yetkilendirme mi, finansal mı?">
        <b>01xx</b> yalnızca “bu işlem yapılabilir mi?” sorusudur; para hareketi bankanın ayrı bir adımında olur (çift mesajlı model, kredi
        kartı/POS dünyası). <b>02xx</b> sorulan şeyi aynı mesajda gerçekleştirir (tek mesajlı model, ATM dünyası). Simülatörde PIN doğrulama ve bakiye
        sorgusu 0100/0110 ile, para çekme 0200/0210 ile gider.
      </Callout>

      <h2 id="bitmap">Bitmap: hangi alanlar var?</h2>
      <p>
        Bitmap, her biri bir alana karşılık gelen 64 bittir. Bit <i>n</i> = 1 ise <i>n</i>. alan mesajda vardır. Alanlar hep numara sırasıyla
        dizilir. <b>1. bit özel bir bayraktır:</b> 1 ise ikinci bir 64 bitlik bitmap daha gelir ve 65–128. alanlar kullanılabilir.
      </p>
      <p>
        Aşağıdaki çözücüde hex bitmap’i değiştirin ya da hazır örneklerden birini seçin. Örneğin <code>7238000000808000</code> değerinde ilk bayt{' '}
        <code>72</code> = <code>0111 0010</code> olduğu için 2, 3, 4 ve 7. alanlar vardır.
      </p>
      <BitmapLab />

      <h2 id="alanlar">Sık kullanılan veri alanları</h2>
      <p>
        Hepsini ezberlemek gerekmez; çoğu iş akışı 15–20 alanın etrafında döner. <Sim>sim</Sim> işaretli olanlar simülatörün gerçekten kullandığı
        alanlardır.
      </p>
      <Table
        head={['Alan', 'Ad', 'Biçim', 'Açıklama']}
        rows={FIELDS.map(([no, name, fmt, why, sim]) => [
          <b key={no}>{no}</b>,
          <>
            {name} {sim && <Sim>sim</Sim>}
          </>,
          <code key="f">{fmt}</code>,
          why,
        ])}
      />

      <h2 id="akis">Mesaj akışı: kim kime ne gönderir?</h2>
      <p>
        Üç rol vardır: <b>acquirer</b> (işlemi alan; ATM/POS’un bağlı olduğu banka), <b>issuer</b> (kartı çıkaran banka, hesabı tutan taraf) ve
        aralarında yönlendirme yapan <b>ağ/switch</b>. Kart ATM’nin sahibi olan bankaya aitse (<i>on-us</i>) switch doğrudan kendi host’una gider;
        başka bankaysa (<i>not-on-us</i>) ağ üzerinden karşı bankaya taşınır.
      </p>
      <Flow
        items={[
          { title: 'ATM istek oluşturur', tag: 'alan 2, 3, 4, 11, 41, 52', text: 'Kart verisi, işlem kodu, tutar, terminal kimliği ve (EPP’de şifrelenmiş) PIN bloğu bir 0100/0200 mesajına konur.' },
          { title: 'Switch yönlendirir', tag: 'BIN / alan 2', text: 'PAN’ın ilk hanelerine (BIN) bakarak kartın hangi bankaya ait olduğunu bulur.' },
          { decision: true, title: 'Kart bizim bankaya mı ait?', branches: [{ label: 'Evet · on-us', text: 'Kendi host’una sorar; PIN, bakiye ve hesap aynı bankada.', tone: 'ok' }, { label: 'Hayır · not-on-us', text: 'BKM (veya Visa/Mastercard) üzerinden karşı bankaya gönderir; ek ücret söz konusu olabilir.', tone: 'warn' }] },
          { title: 'Issuer karar verir', tag: 'HSM · bakiye · risk', text: 'PIN’i HSM’de doğrular, bakiye/limit ve risk kurallarını işletir, hesaptan düşer ve onay kodu üretir.' },
          { title: 'Yanıt aynı yoldan döner', tag: 'alan 39, 38, 37', text: 'Yanıt kodu ve onay kodu STAN ile eşleşir; ATM sonucu görünce parayı verir ya da işlemi reddeder.' },
        ]}
      />

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Senaryoların her biri simülatörde yeniden üretilebilir. Diyagramdaki <span className="tr-key ok">yeşil</span> oklar başarılı,{' '}
        <span className="tr-key bad">kırmızı</span> oklar red/hata, kesikli oklar yanıt mesajlarıdır.
      </p>
      <Tabs
        label="ISO 8583 senaryoları"
        tabs={[
          {
            label: '1 · Para çekme (on-us)',
            content: (
              <>
                <Sequence
                  label="Demo Bank kartıyla Demo Bank ATM’sinden 500 TL çekim"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { sep: 'PIN doğrulama' },
                    { from: 'atm', to: 'sw', label: '0100 · PIN doğrulama', sub: 'alan 3=310000 · 52=PIN bloğu', tone: 'ok' },
                    { from: 'sw', to: 'host', label: 'PIN’i HSM’de doğrula', tone: 'ok' },
                    { from: 'host', to: 'sw', label: 'PIN doğru', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0110 · alan 39 = 00', res: true, tone: 'ok' },
                    { sep: 'Para çekme' },
                    { from: 'atm', to: 'sw', label: '0200 · 500,00 TRY', sub: 'alan 3=010000 · 4=000000050000', tone: 'ok' },
                    { from: 'sw', to: 'host', label: 'Bakiye/limit kontrolü', tone: 'ok' },
                    { note: 'Hesap borçlandırılır\nOnay kodu üretilir', at: 'host' },
                    { from: 'host', to: 'sw', label: 'Onay + onay kodu', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00 · 38=482915', res: true, tone: 'ok' },
                    { note: 'Banknotlar sunulur,\nfiş basılır', at: 'atm' },
                  ]}
                />
                <Notes
                  items={[
                    <>PIN, ATM’nin güvenli tuş takımında (EPP) şifrelenir ve <b>alan 52</b>’de gider. Switch bu bloğu hiçbir zaman açmaz; yalnızca HSM çözer.</>,
                    <>Para çekme <b>0200</b> ile gider. <b>Alan 3 = 010000</b>: 01 nakit çekme, vadesiz hesaptan.</>,
                    <>Yanıt <b>alan 11 (STAN)</b> ile eşleşir. 39 = 00 gelmeden ATM banknot dağıtmaz.</>,
                    <>ATM parayı verdikten sonra ayrıca bir “tamam” mesajı göndermez; mesaj akışı burada biter. Fiziksel başarısızlıklar ayrı senaryodadır (4).</>,
                  ]}
                />
                <TryInSim>Cüzdandan Ayşe Yılmaz’ın Visa banka kartını (PIN 1234) takıp 500 TL çekin; sonra Olay günlüğündeki 0100 ve 0200 satırlarının alanlarına bakın.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Başka banka ATM’si',
            content: (
              <>
                <Sequence
                  label="Atlas Bank kartı, Demo Bank ATM’sinde (not-on-us)"
                  actors={[ACT.atm, ACT.sw, ACT.bkm, ACT.issuer]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0100 / 0200', sub: 'BIN başka banka', tone: 'ok' },
                    { note: 'Switch BIN’den kartın\nbaşka bankaya ait olduğunu görür', at: 'sw' },
                    { from: 'sw', to: 'bkm', label: '0200 + alan 32', sub: 'acquirer kodu eklenir', tone: 'warn' },
                    { from: 'bkm', to: 'issuer', label: '0200', tone: 'warn' },
                    { note: 'PIN, bakiye ve\nhesap issuer’da', at: 'issuer' },
                    { from: 'issuer', to: 'bkm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { from: 'bkm', to: 'sw', label: '0210', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210', res: true, tone: 'ok' },
                    { sep: 'Gün sonu' },
                    { note: 'Bankalar arası takas: acquirer, ATM’den verdiği parayı\nissuer’dan netleştirme (clearing) ile tahsil eder', span: ['sw', 'issuer'] },
                  ]}
                />
                <Notes
                  items={[
                    <>PIN doğrulama dahil <b>her şey issuer’da</b> yapılır; acquirer kartın bakiyesini bilmez.</>,
                    <>Ağ üzerinden giden mesaj ağın lehçesinde olur; switch gerekli alanları (ör. alan 32) ekler/dönüştürür.</>,
                    <>Başka banka ATM’sinde müşteriden <b>işlem ücreti (alan 28)</b> alınabilir. Simülatör ücreti çekimden önce ekranda gösterip onay ister.</>,
                    <>Para gerçekte gün sonu takasında bankalar arasında el değiştirir; anlık olan yalnızca provizyondur.</>,
                  ]}
                />
                <TryInSim>Elif Demir’in Atlas Bank kartını (PIN 0000) Demo Bank ATM’sine takın; Mesaj akışı panelinde BKM durağının yandığını ve ücret ekranını görün. Sonra Takas &amp; Mutabakat sekmesinde “Takas oturumunu çalıştır”ı deneyin.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Red durumları',
            content: (
              <>
                <Sequence
                  label="Yetersiz bakiye ve hatalı PIN"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { sep: 'A · Yetersiz bakiye' },
                    { from: 'atm', to: 'sw', label: '0200 · 3.000 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: 'Bakiye kontrolü', tone: 'ok' },
                    { from: 'host', to: 'sw', label: 'Bakiye yetersiz', res: true, tone: 'bad' },
                    { from: 'sw', to: 'atm', label: '0210 · alan 39 = 51', res: true, tone: 'bad' },
                    { note: 'Para verilmez, hesapta\nhareket olmaz', at: 'atm', tone: 'bad' },
                    { sep: 'B · Hatalı PIN (3. denemede)' },
                    { from: 'atm', to: 'sw', label: '0100 · yanlış PIN', tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0110 · 39 = 55', sub: '1. ve 2. deneme', res: true, tone: 'bad' },
                    { from: 'atm', to: 'sw', label: '0100 · yanlış PIN', tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0110 · 39 = 75', sub: 'deneme sayısı aşıldı', res: true, tone: 'bad' },
                    { note: 'ATM kartı alıkoyar', at: 'atm', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Red de bir yanıttır.</b> Mesaj tipi 0210/0110 aynı kalır; sonucu yalnızca <b>alan 39</b> belirler.</>,
                    <>Red yanıtında genelde az alan döner (39 ve 37); onay kodu (38) yalnızca onayda vardır.</>,
                    <>51 ile reddedilen işlemde para hareketi olmadığı için iptal (0400) gerekmez. İptal, host’un parayı <i>düştüğü</i> ama ATM’nin vermediği durumlar içindir.</>,
                    <>Simülatörde PIN deneme sayısını host takip eder: 55, 55, sonra 75 ve kart alıkonur. Teknisyen kutuyu boşaltınca kart cüzdana döner.</>,
                  ]}
                />
                <TryInSim>Bir kartı takıp üst üste üç kez yanlış PIN girin (75, kart alıkonur). Sonra Mehmet Kaya’nın kartıyla (PIN 4321, bakiye 850 TL) 3.000 TL çekmeyi deneyin (51).</TryInSim>
              </>
            ),
          },
          {
            label: '4 · Zaman aşımı ve iptal',
            content: (
              <>
                <Sequence
                  label="Host onayladı ama yanıt ATM’ye ulaşmadı"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', tone: 'ok' },
                    { note: 'Host hesabı borçlandırdı', at: 'host' },
                    { from: 'host', to: 'sw', label: '0210 · 39=00', lost: true, res: true, tone: 'bad' },
                    { note: 'ATM zaman aşımı: sonuç bilinmiyor.\nPara VERİLMEZ, güvenli taraf seçilir', at: 'atm', tone: 'warn' },
                    { sep: 'İptal' },
                    { from: 'atm', to: 'sw', label: '0400 · iptal isteği', sub: '39=68 · 90=asıl işlem', lost: true, tone: 'warn' },
                    { note: 'Hat hâlâ cevap vermiyor →\nmesaj SAF kuyruğuna alınır', at: 'atm', tone: 'warn' },
                    { sep: 'Hat düzelince (store-and-forward)' },
                    { from: 'atm', to: 'sw', label: '0420 · iptal tekrarı', sub: 'aynı alan 90', tone: 'warn' },
                    { from: 'sw', to: 'host', label: '0420', tone: 'warn' },
                    { note: 'Borç iade edilir', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0430 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0430', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>İstek ağa çıktı ama yanıt gelmedi: ATM işlemin <b>onaylandığını mı reddedildiğini mi bilmez</b>. Bu, ödeme sistemlerinin en klasik hatasıdır.</>,
                    <>Kural: <b>emin değilsen para verme, iptal et.</b> ATM <b>0400</b> gönderir. <b>Alan 90</b> iptal edilecek asıl işlemi (MTI, STAN, tarih, acquirer) tarif eder.</>,
                    <>İptal mesajı da yanıtsız kalırsa kaybolmaz: ATM onu bir kuyruğa yazar (<b>SAF – store and forward</b>) ve hat düzelince <b>0420</b> (repeat) olarak tekrar tekrar gönderir. İptal <i>idempotent</i> olmalıdır: ikinci kez gelince parayı iki kez iade etmez.</>,
                    <>İptal sebebi alan 39’da taşınır: <b>17</b> müşteri vazgeçti, <b>22</b> cihaz arızası şüphesi, <b>68</b> yanıt çok geç geldi.</>,
                    <>Gün sonu mutabakatında bu kuyruk boşaltılmamışsa host ile ATM tutarları <b>tutmaz</b> (5. senaryo).</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Host yanıtı kaybolur”u seçip para çekin. Sonra Teknisyen sekmesinden bakım moduna alıp “SAF kuyruğunu gönder” ile 0420’yi tetikleyin.</TryInSim>
              </>
            ),
          },
          {
            label: '5 · Gün sonu mutabakat',
            content: (
              <>
                <Sequence
                  label="ATM ile host gün sonu toplamlarını karşılaştırır"
                  actors={[ACT.atm, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'host', label: '0500 · mutabakat isteği', sub: 'dönem no · borç/alacak adet ve tutarları', tone: 'ok' },
                    { note: 'Host kendi defterindeki imzalı kayıtları\nATM’nin bildirdiği toplamlarla karşılaştırır', at: 'host' },
                    { from: 'host', to: 'atm', label: '0510 · 39 = 00', sub: 'toplamlar tuttu', res: true, tone: 'ok' },
                    { sep: 'Fark varsa' },
                    { from: 'host', to: 'atm', label: '0510 · 39 = 95', sub: 'mutabakat farkı', res: true, tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Her ATM dönem boyunca verdiği/aldığı tutarları sayar. Gün sonunda <b>0500</b> ile bunları bildirir.</>,
                    <>Fark çıkarsa <b>95</b> döner. Tipik sebepler: yanıtı kaybolmuş çekim, tamamlanamayan iptal (SAF kuyruğu), para verilmeden geri çekilen banknot.</>,
                    <>Sorun giderilip kuyruk gönderildikten sonra gün sonu tekrarlanır; tutar tutunca dönem kapanır ve sayaçlar sıfırlanır.</>,
                  ]}
                />
                <TryInSim>Zaman aşımı senaryosunu çalıştırın, sonra Teknisyen sekmesinde SAF kuyruğunu göndermeden “Gün sonu (0500)” alın (95 farkı). Kuyruğu gönderip gün sonunu tekrarlayın.</TryInSim>
              </>
            ),
          },
          {
            label: '6 · Ağ yönetimi (0800)',
            content: (
              <>
                <Sequence
                  label="Switch ile ATM/ağ arasındaki oturum mesajları"
                  actors={[ACT.sw, ACT.host]}
                  steps={[
                    { from: 'sw', to: 'host', label: '0800 · alan 70 = 001', sub: 'sign-on: oturum aç', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0810 · 39 = 00', res: true, tone: 'ok' },
                    { sep: 'Her 1–5 dakikada bir' },
                    { from: 'sw', to: 'host', label: '0800 · alan 70 = 301', sub: 'echo test: hat canlı mı?', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0810 · 39 = 00', res: true, tone: 'ok' },
                    { sep: 'Anahtar değişimi' },
                    { from: 'sw', to: 'host', label: '0800 · alan 70 = 101', sub: 'yeni PIN/MAC anahtarı', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0810 · 39 = 00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>08xx mesajları <b>işlem değildir</b>; bağlantının kendisini yönetir.</>,
                    <><b>Echo (301)</b> hattın canlı olduğunu doğrular. Üst üste yanıtsız kalırsa switch hattı “düşmüş” sayar, işlemleri yönlendirmeyi keser (alan 39 = 91).</>,
                    <><b>Anahtar değişimi</b>, PIN ve MAC anahtarlarının düzenli yenilenmesini sağlar.</>,
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <h2 id="yanit">Yanıt kodları (alan 39)</h2>
      <p>
        Yanıt kodu iki karakterdir ve işlemin makine tarafından okunan sonucudur. ATM bunu müşteriye anlaşılır metne çevirir. Aşağıdaki liste standartta
        sık görülenleri içerir; simülatörün kullandığı kodlar işaretlidir.
      </p>
      <Table
        head={['Kod', 'Anlamı', 'Not']}
        rows={[
          [<b key="00">00</b>, 'Onaylandı', <Sim key="s">sim</Sim>],
          [<b key="05">05</b>, 'İşlem reddedildi (genel red)', <Sim key="s">sim</Sim>],
          [<b key="12">12</b>, 'Geçersiz işlem', ''],
          [<b key="13">13</b>, 'Geçersiz tutar', <Sim key="s">sim</Sim>],
          [<b key="14">14</b>, 'Geçersiz kart numarası', <Sim key="s">sim</Sim>],
          [<b key="30">30</b>, 'Mesaj biçim hatası', ''],
          [<b key="33">33</b>, 'Kartın süresi dolmuş (kartı al)', <>Simülatör bu kodu <b>QR kodun süresi doldu</b> için kullanır</>],
          [<b key="41">41</b>, 'Kayıp kart (kartı al)', ''],
          [<b key="43">43</b>, 'Çalıntı kart (kartı al)', ''],
          [<b key="51">51</b>, 'Yetersiz bakiye / limit', <Sim key="s">sim</Sim>],
          [<b key="54">54</b>, 'Kartın süresi dolmuş', <>Simülatör bu kodu <b>oturum süresi doldu</b> için kullanır</>],
          [<b key="55">55</b>, 'Hatalı PIN', <Sim key="s">sim</Sim>],
          [<b key="57">57</b>, 'İşlem kart sahibine kapalı', <Sim key="s">sim</Sim>],
          [<b key="58">58</b>, 'İşlem bu terminalde yapılamaz', <Sim key="s">sim</Sim>],
          [<b key="61">61</b>, 'Çekim tutarı limiti aşıldı', <Sim key="s">sim</Sim>],
          [<b key="65">65</b>, 'Çekim adedi limiti aşıldı', ''],
          [<b key="68">68</b>, 'Yanıt çok geç geldi', <>Simülatörde 0420 iptal sebebi <Sim key="s">sim</Sim></>],
          [<b key="75">75</b>, 'PIN deneme sayısı aşıldı', <Sim key="s">sim</Sim>],
          [<b key="86">86</b>, 'PIN doğrulanamıyor', <>Simülatör <b>banknot dağıtılamıyor</b> için kullanır</>],
          [<b key="91">91</b>, 'Issuer ya da switch devre dışı', <Sim key="s">sim</Sim>],
          [<b key="95">95</b>, 'Mutabakat farkı', <Sim key="s">sim</Sim>],
          [<b key="96">96</b>, 'Sistem arızası', ''],
        ]}
      />
      <Callout tone="warn" title="Kodları ağa göre doğrulayın">
        Standart bile sürümden sürüme küçük farklar taşır, ağlar da kendi ek kodlarını tanımlar. Gerçek bir entegrasyonda ilgili ağın şartnamesindeki tablo esastır.
      </Callout>

      <h2 id="pratik">Gerçek hayat notları</h2>
      <ul>
        <li>
          <b>İdempotentlik:</b> aynı isteğin tekrarı (özellikle 0420) çift işlem üretmemelidir. Eşleştirme anahtarı genellikle STAN + tarih/saat +
          terminal + acquirer kombinasyonudur.
        </li>
        <li>
          <b>Zaman aşımı sürelerini</b> hat boyunca azalan şekilde kurun (ATM 30 sn → switch 25 sn → ağ 20 sn). Aksi halde alttaki katman bekleyip üsttekinin
          zaman aşımına uğramasına yol açar.
        </li>
        <li>
          <b>Günlükte hassas veri tutmayın:</b> PAN maskelenir, PIN bloğu (52), track verisi (35) ve CVV hiçbir günlükte açık yer almaz.
        </li>
        <li>
          <b>Veri bütünlüğü:</b> alan 128 (MAC) ile mesajın kurcalanmadığı doğrulanır; uçtan uca hat da TLS/özel hat ile korunur.
        </li>
        <li>
          <b>Kuruş cinsinden tutar:</b> kayan noktalı sayı kullanmayın; alan 4 zaten tam sayıdır, hesaplamayı da tam sayıyla yapın.
        </li>
      </ul>

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['MTI', 'Mesajın ne olduğunu söyleyen 4 hane: sürüm · sınıf · işlev · kaynak'],
          ['Bitmap', 'Mesajda hangi alanların bulunduğunu işaretleyen 64/128 bit'],
          ['Alan (DE)', 'Mesajın taşıdığı tek bir bilgi: PAN, tutar, STAN, yanıt kodu…'],
          ['STAN', 'İstek ve yanıtı eşleştiren işlem sıra numarası'],
          ['Alan 39', 'İşlemin sonucu; 00 dışındaki her değer bir red ya da sorun işaretidir'],
          ['0400 / 0420', 'İptal ve onun kuyruklanıp tekrar gönderilen hali (SAF)'],
          ['0500', 'Gün sonu mutabakatı: ATM ile host toplamları tutuyor mu?'],
          ['On-us / not-on-us', 'Kart ATM’nin bankasına mı ait, başka bankaya mı?'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/emv">EMV — çipli kartın bu mesajlardan önce ve içinde ne yaptığı →</a>
      </p>
    </>
  )
}
