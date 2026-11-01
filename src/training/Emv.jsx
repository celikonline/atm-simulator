import { useState } from 'react'
import { Callout, Flow, Notes, PageHead, Sequence, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- etkileşimli: terminal eylem analizi
const CONDS = [
  ['oda', 'Çevrimdışı veri doğrulama başarısız (SDA/DDA/CDA)'],
  ['expired', 'Uygulamanın süresi dolmuş'],
  ['pinlimit', 'PIN deneme limiti aşıldı'],
  ['floor', 'Tutar floor limit’i aştı'],
  ['random', 'İşlem rastgele seçilip online’a zorlandı'],
  ['newcard', 'Yeni kart (ilk kullanım)'],
]
// Örnek maskeler: gerçekte TAC’ı terminali işleten, IAC’ı kartı çıkaran kurum belirler.
const DENIAL = new Set(['expired', 'pinlimit'])
const ONLINE = new Set(['oda', 'floor', 'random', 'newcard'])
const DEFAULT = new Set(['oda', 'pinlimit', 'floor'])
const TERMS = {
  atm: 'ATM · yalnızca online (Terminal Type 14)',
  pos: 'POS · online + çevrimdışı yeteneği',
  off: 'Yalnızca çevrimdışı terminal',
}

function decide(on, term, reachable) {
  const hit = (mask) => CONDS.filter(([k]) => on[k] && mask.has(k)).map(([, label]) => label)
  const steps = []
  const den = hit(DENIAL)
  if (den.length) {
    steps.push(`TVR ∧ (TAC/IAC-Denial) ≠ 0 → eşleşen: ${den.join('; ')}`)
    return { result: 'AAC', steps: [...steps, 'Terminal karttan AAC ister: işlem çevrimdışı reddedilir.'] }
  }
  steps.push('TVR ∧ (TAC/IAC-Denial) = 0 → red koşulu yok.')
  const tryOnline = term === 'atm' || (term === 'pos' && hit(ONLINE).length > 0)
  if (term === 'atm') steps.push('ATM yalnızca online çalışır: TAC-Online’da tüm bitler 1, işlem her zaman bankaya sorulur.')
  else if (term === 'pos') {
    const o = hit(ONLINE)
    steps.push(o.length ? `TVR ∧ (TAC/IAC-Online) ≠ 0 → eşleşen: ${o.join('; ')}` : 'TVR ∧ (TAC/IAC-Online) = 0 → bankaya sormaya gerek yok.')
  }
  if (tryOnline && reachable) return { result: 'ARQC', steps: [...steps, 'Terminal karttan ARQC ister; kart kendi riskine göre ARQC ya da AAC ile yanıtlar. ARQC çıkarsa 0200 ile issuer’a gider.'] }
  if (tryOnline && !reachable) {
    steps.push('Çevrimiçi yetkilendirme istendi ama host’a ulaşılamadı → “Default” maskelerine bakılır.')
    if (term === 'atm') return { result: 'AAC', steps: [...steps, 'Yalnızca online terminal: ulaşılamıyorsa her zaman reddedilir (AAC).'] }
  }
  if (term === 'off') steps.push('Çevrimdışı terminal: yalnızca “Default” maskelerine bakılır.')
  const def = hit(DEFAULT)
  if (def.length) return { result: 'AAC', steps: [...steps, `TVR ∧ (TAC/IAC-Default) ≠ 0 → eşleşen: ${def.join('; ')}`, 'AAC istenir: işlem reddedilir.'] }
  if (!tryOnline) steps.push('Online gerekmiyor ve Default koşulu yok.')
  else steps.push('TVR ∧ (TAC/IAC-Default) = 0')
  return { result: 'TC', steps: [...steps, 'Terminal karttan TC ister: işlem çevrimdışı onaylanır.'] }
}

function TaaLab() {
  const [on, setOn] = useState({})
  const [term, setTerm] = useState('pos')
  const [reachable, setReachable] = useState(true)
  const r = decide(on, term, reachable)
  const tone = { AAC: 'bad', TC: 'ok', ARQC: 'warn' }[r.result]
  const label = { AAC: 'AAC · reddet', TC: 'TC · çevrimdışı onayla', ARQC: 'ARQC · bankaya sor' }[r.result]
  return (
    <div className="tr-lab">
      <div className="tr-lab-cols">
        <fieldset className="tr-fieldset">
          <legend>TVR’de hangi bitler 1?</legend>
          {CONDS.map(([k, text]) => (
            <label key={k} className="tr-check">
              <input type="checkbox" checked={!!on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
              {text}
            </label>
          ))}
        </fieldset>
        <fieldset className="tr-fieldset">
          <legend>Terminal ve hat</legend>
          {Object.entries(TERMS).map(([k, text]) => (
            <label key={k} className="tr-check">
              <input type="radio" name="term" checked={term === k} onChange={() => setTerm(k)} />
              {text}
            </label>
          ))}
          <label className="tr-check sep">
            <input type="checkbox" checked={reachable} onChange={(e) => setReachable(e.target.checked)} />
            Bankaya ulaşılabiliyor
          </label>
        </fieldset>
      </div>
      <div className={`tr-verdict ${tone}`} role="status">
        <span>Terminalin karttan istediği</span>
        <b>{label}</b>
      </div>
      <ol className="tr-notes compact">
        {r.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <p className="tr-muted">Maskeler örnek amaçlıdır: Denial = süresi dolmuş, PIN limiti; Online = ODA, floor limit, rastgele, yeni kart; Default = ODA, PIN limiti, floor limit.</p>
    </div>
  )
}

const ACT = {
  card: { id: 'card', label: 'Çipli Kart', sub: 'ICC uygulaması' },
  term: { id: 'term', label: 'ATM / Terminal', sub: 'EMV L2 kernel' },
  acq: { id: 'acq', label: 'Acquirer', sub: 'ATM Switch' },
  iss: { id: 'iss', label: 'Issuer', sub: 'Host + HSM' },
}

export default function Emv() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Çipli kart"
        title="EMV"
        lead="Çipli kartı takınca ATM ekranda “PIN girin” demeden önce kartla birkaç düzine komut alışverişi yapılır. EMV, bu alışverişin ve kartın ürettiği kriptografik kanıtın standardıdır. Simülatörde “Kart takıldı · çip okunuyor” satırının arkasında olan şey budur."
      />

      <h2 id="giris">EMV nedir, neden var?</h2>
      <p>
        EMV adını kurucularından alır: <b>Europay, Mastercard, Visa</b>. Bugün standartları <b>EMVCo</b> yönetir. Amaç, manyetik şeritli kartın
        en büyük zafiyetini kapatmaktır: şeritteki veri <b>statiktir</b>, bir kez kopyalanınca sonsuza kadar kullanılabilir.
      </p>
      <Table
        head={['', 'Manyetik şerit', 'EMV çip']}
        rows={[
          ['Veri', 'Statik: her işlemde aynı track verisi', 'Dinamik: her işlemde farklı bir kriptogram'],
          ['Klonlama', 'Okuyup başka şeride yazmak yeterli', 'Kartın içindeki anahtar dışarı çıkmaz, kopyalanamaz'],
          ['Karar', 'Hep banka (çevrimiçi)', 'Kart + terminal + banka; çevrimdışı karar da mümkün'],
          ['PIN', 'Yalnızca çevrimiçi', 'Çevrimiçi ya da kartın kendisi doğrular (çevrimdışı PIN)'],
          ['Sahtecilik sorumluluğu', 'Genelde issuer', 'Çipsiz terminal kullanan taraf (liability shift)'],
        ]}
      />

      <h2 id="mimari">Kim ne yapar?</h2>
      <Table
        head={['Taraf', 'Rolü']}
        rows={[
          [<b key="c">Kart (ICC)</b>, 'Uygulamayı (AID), anahtarlarını ve sayaçlarını (ATC, PIN deneme sayacı) tutar. Kriptogramı üretir. Kendi risk kurallarıyla “terminalin istediğinden daha kötüsüne” karar verebilir.'],
          [<b key="t">Terminal</b>, 'Kartla konuşur, hangi uygulamanın seçileceğine karar verir, risk yönetimini yapar, karttan hangi kriptogramı isteyeceğini belirler. Banka CA açık anahtarlarını (CAPK) saklar.'],
          [<b key="a">Acquirer / Switch</b>, 'Çip verisini ISO 8583 alan 55 içinde taşır; kriptogramı yorumlamaz.'],
          [<b key="i">Issuer + HSM</b>, 'ARQC’yi HSM’de doğrular (anahtar yalnızca bankada), PIN’i ve limitleri kontrol eder, ARPC ile yanıt verir.'],
        ]}
      />
      <h3>EMV’nin üç katmanı</h3>
      <Table
        head={['Katman', 'Kapsam', 'Kim sertifikalar?']}
        rows={[
          [<b key="1">Level 1</b>, 'Fiziksel/elektriksel arayüz: kart okuyucu, ISO 7816 (temaslı), ISO 14443 (temassız), el sıkışma ve baud hızı', 'EMVCo'],
          [<b key="2">Level 2</b>, 'Uygulama “kernel”: seçim, veri okuma, doğrulama, risk yönetimi, kriptogram, yaşam döngüsü', 'EMVCo / marka onayı'],
          [<b key="3">Level 3</b>, 'Terminal uygulaması + acquirer/ağ bağlantısı: ekranlar, ISO 8583 eşleme, ağ özel kurallar', 'Acquirer ve kartlı ödeme markaları'],
        ]}
      />
      <Callout title="Simülatörde">
        Kart takılınca olay günlüğünde <code>WFS_CMD_IDC_READ_RAW_DATA</code> ve <code>WFS_CMD_IDC_CHIP_IO</code> komutları ile
        “EMV L2 · çip okundu · AID A0000000031010” satırını görürsünüz. Simülatör kriptogram üretmez ve doğrulamaz; bu sayfa o satırın arkasındaki
        gerçek süreci anlatır.
      </Callout>

      <h2 id="akis">İşlem akışı: 10 adım</h2>
      <p>Bir EMV işlemi şu sırayla ilerler. İlk dokuz adım terminalle kart arasındadır (yerel), onuncu adım bankayı da kapsar.</p>
      <Flow
        items={[
          { title: 'Uygulama seçimi', tag: 'SELECT PPSE/PSE · SELECT AID', text: 'Terminal “kartta hangi ödeme uygulamaları var?” diye sorar (PSE/PPSE), kendi desteklediklerinle kesişimi çıkarır ve birini seçer. ATM’de seçim genelde otomatiktir.' },
          { title: 'İşlem başlatma', tag: 'GET PROCESSING OPTIONS', text: 'Terminal işlem verisini (tutar, tarih, ülke…) gönderir. Kart, yeteneklerini (AIP) ve okunacak kayıtların listesini (AFL) döner.' },
          { title: 'Uygulama verisini okuma', tag: 'READ RECORD ×n', text: 'PAN, son kullanma, sıra numarası, CVM listesi, sertifikalar, CDOL’lar gibi veriler okunur.' },
          { title: 'Çevrimdışı veri doğrulama (ODA)', tag: 'SDA · DDA · CDA', text: 'Kartın gerçek ve değiştirilmemiş olduğu, terminalde bulunan CA açık anahtarıyla doğrulanır. Başarısızlık TVR’de bit olarak kaydedilir; işlem hemen reddedilmez.' },
          { title: 'İşlem kısıtlamaları', tag: 'AUC · uygulama sürümü · tarihler', text: 'Kart bu işlem türüne (nakit çekme, yurt dışı…) izin veriyor mu? Süresi dolmuş veya henüz geçerli değil mi?' },
          { title: 'Kart sahibi doğrulama (CVM)', tag: 'VERIFY · çevrimiçi PIN · imza', text: 'Kartın CVM listesi ile terminalin yeteneği eşleştirilir. Çevrimdışı PIN’i kart doğrular; çevrimiçi PIN şifrelenip bankaya gider.' },
          { title: 'Terminal risk yönetimi', tag: 'floor limit · rastgele seçim · velocity', text: 'Tutar floor limit’in üstünde mi? İşlem rastgele seçilip online’a zorlanmalı mı? Kartın son online’dan beri yaptığı çevrimdışı işlem sayısı çok mu?' },
          { title: 'Terminal eylem analizi', tag: 'TVR ve TAC/IAC → GENERATE AC', text: 'TVR’de biriken bitler, terminal ve kart kuralları (TAC/IAC) ile karşılaştırılır. Sonuç karttan istenecek kriptogram türüdür.', },
          { decision: true, title: 'Terminal karttan ne ister?', branches: [{ label: 'AAC', text: 'Reddet (çevrimdışı)', tone: 'bad' }, { label: 'TC', text: 'Çevrimdışı onayla', tone: 'ok' }, { label: 'ARQC', text: 'Bankaya sor (çevrimiçi)', tone: 'warn' }] },
          { title: 'Kart eylem analizi', tag: 'GENERATE AC → AAC / TC / ARQC', text: 'Kart kendi sayaçlarına ve kurallarına bakar. Yalnızca “aşağı” karar verebilir: terminal TC istediyse kart ARQC ya da AAC verebilir, ARQC istediyse AAC verebilir; asla tersi.' },
          { title: 'Çevrimiçi yetkilendirme ve tamamlama', tag: '0200 + alan 55 → 0210 + ARPC → 2. GENERATE AC', text: 'ARQC, ISO 8583 alan 55 içinde bankaya gider. Banka kriptogramı doğrular, ARPC ile onay yanıtı verir. Terminal ARPC’yi karta iletir; kart nihai kararı TC (onay) ya da AAC (red) olarak verir. Gerekirse issuer script’i de uygulanır.' },
        ]}
      />
      <Callout tone="warn" title="Kart son sözü söyler">
        Banka 39 = 00 dese bile 2. GENERATE AC sonucu <b>AAC</b> gelebilir (ör. kart ARPC’yi doğrulayamadı). Bu durumda ATM parayı <b>vermemeli</b>; banka hesabı
        borçlandırmıştır, bu yüzden ATM <b>0400</b> iptal göndermelidir. ISO 8583 sayfasındaki iptal senaryosu tam olarak bu durum için vardır.
      </Callout>

      <h2 id="apdu">Kartla konuşma: APDU komutları</h2>
      <p>
        Terminal ile kart <b>APDU</b> (Application Protocol Data Unit) ile konuşur: terminal komut gönderir, kart yanıt + 2 bayt durum kelimesi (SW) döner.
        Komut <code>CLA INS P1 P2 [Lc veri] [Le]</code> yapısındadır.
      </p>
      <Table
        head={['Komut', 'Örnek APDU', 'Ne yapar']}
        rows={[
          [<b key="1">SELECT</b>, <code key="a">00 A4 04 00 07 A0000000031010</code>, 'AID ile uygulamayı seçer (veya PSE/PPSE adıyla uygulama listesini ister).'],
          [<b key="2">GET PROCESSING OPTIONS</b>, <code key="b">80 A8 00 00 …</code>, 'İşlemi başlatır; AIP ve AFL döner.'],
          [<b key="3">READ RECORD</b>, <code key="c">00 B2 01 14 00</code>, 'SFI 2’nin 1. kaydını okur (P2 = SFI×8 + 4).'],
          [<b key="4">VERIFY</b>, <code key="d">00 20 00 80 08 24 12 34 FF FF FF FF FF</code>, 'Çevrimdışı düz PIN doğrulama (PIN bloğu: 2 · uzunluk · basamaklar · dolgu F).'],
          [<b key="5">INTERNAL AUTHENTICATE</b>, <code key="e">00 88 00 00 …</code>, 'DDA: kart terminalin rastgele sayısını özel anahtarıyla imzalar.'],
          [<b key="6">GENERATE AC</b>, <code key="f">80 AE 80 00 …</code>, 'Kriptogram ister. P1: 00 = AAC, 40 = TC, 80 = ARQC.'],
          [<b key="7">EXTERNAL AUTHENTICATE</b>, <code key="g">00 82 00 00 0A …</code>, 'Issuer’ın ARPC’sini karta doğrulatır.'],
          [<b key="8">GET DATA</b>, <code key="h">80 CA 9F 36 00</code>, 'Tek bir veri öğesi (ör. ATC) okur.'],
        ]}
      />
      <h3>Durum kelimeleri (SW1 SW2)</h3>
      <Table
        head={['SW', 'Anlamı']}
        rows={[
          [<code key="1">90 00</code>, 'Başarılı'],
          [<code key="2">6A 82</code>, 'Dosya/uygulama bulunamadı (SELECT’te AID kartta yok)'],
          [<code key="3">6A 83</code>, 'Kayıt bulunamadı'],
          [<code key="4">69 85</code>, 'Kullanım koşulları sağlanmadı'],
          [<code key="5">63 Cx</code>, 'PIN yanlış, kalan hak x (ör. 63 C2 = 2 hak kaldı)'],
          [<code key="6">69 83</code>, 'PIN bloke: deneme hakkı bitti'],
        ]}
      />

      <h2 id="tlv">Veri nasıl taşınır: TLV</h2>
      <p>
        Kartla terminal arasındaki her bilgi <b>TLV</b> (Tag-Length-Value) biçimindedir: tag (1–2 bayt), uzunluk, değer. Bazı tag’ler başka TLV’leri
        kapsar (ör. <code>70</code>, <code>77</code>, <code>6F</code>). Aşağıda gerçeğe yakın bir GET PROCESSING OPTIONS yanıtı çözümlenmiş:
      </p>
      <div className="tlv" role="group" aria-label="TLV çözümleme örneği">
        <span className="t77"><code>77 12</code><small>şablon · 18 bayt</small></span>
        <span className="t82"><code>82 02</code><code>39 00</code><small>AIP</small></span>
        <span className="t94"><code>94 0C</code><code>08010100 10010301 18010200</code><small>AFL · 3 kayıt grubu</small></span>
      </div>
      <Notes
        items={[
          <><b>AIP 39 00</b>: ilk bayt <code>0011 1001</code> → DDA desteği, kart sahibi doğrulaması, terminal risk yönetimi ve CDA desteği var.</>,
          <><b>AFL</b>, dört baytlık gruplardır: <code>08 01 01 00</code> → SFI 1 (08÷8), kayıt 1–1, çevrimdışı doğrulamaya katılan kayıt yok. <code>10 01 03 01</code> → SFI 2, kayıt 1–3, bunlardan 1’i ODA imzasına girer.</>,
          <>Terminal AFL’ye bakıp her kayıt için bir READ RECORD gönderir.</>,
        ]}
      />
      <Table
        head={['Tag', 'Ad', 'Not']}
        rows={[
          [<code key="1">4F</code>, 'AID', 'RID (5 bayt, ağ) + PIX. A000000003 Visa, A000000004 Mastercard, A000000672 Troy'],
          [<code key="2">5A</code>, 'PAN', 'Kart numarası'],
          [<code key="3">57</code>, 'Track 2 eşdeğer verisi', 'ISO 8583 alan 35’e eşlenir'],
          [<code key="4">5F34</code>, 'PAN sıra no (PSN)', 'ISO 8583 alan 23; anahtar türetmede de kullanılır'],
          [<code key="5">82</code>, 'AIP', 'Kartın yetenekleri: SDA/DDA/CDA, CVM, issuer auth…'],
          [<code key="6">94</code>, 'AFL', 'Hangi dosyadan hangi kayıtların okunacağı'],
          [<code key="7">8E</code>, 'CVM listesi', 'Kart sahibi doğrulama yöntemleri ve koşulları'],
          [<code key="8">95</code>, 'TVR', '5 baytlık Terminal Doğrulama Sonucu (risk bitleri)'],
          [<code key="9">9F02</code>, 'Yetkili tutar', 'ISO 8583 alan 4 ile aynı değer'],
          [<code key="10">9F26</code>, 'Uygulama kriptogramı', 'ARQC / TC / AAC (8 bayt)'],
          [<code key="11">9F27</code>, 'CID', 'Kriptogram bilgisi: 00 AAC, 40 TC, 80 ARQC'],
          [<code key="12">9F36</code>, 'ATC', 'Kartın işlem sayacı; tekrar saldırısına karşı'],
          [<code key="13">9F37</code>, 'Rastgele sayı (UN)', 'Terminalin her işlemde ürettiği sayı'],
          [<code key="14">9F10</code>, 'Issuer uygulama verisi', 'Kartın banka için özel bilgisi (CVR vb.)'],
          [<code key="15">9F34</code>, 'CVM sonuçları', 'Hangi doğrulama yapıldı, sonuç ne'],
          [<code key="16">91</code>, 'Issuer doğrulama verisi', 'ARPC + yanıt kodu; bankadan karta'],
        ]}
      />

      <h2 id="kriptogram">Kriptogramlar: ARQC, TC, AAC, ARPC</h2>
      <Table
        head={['Kısaltma', 'Açılımı', 'Anlamı', 'Kim üretir?']}
        rows={[
          [<b key="1">ARQC</b>, 'Authorisation Request Cryptogram', '“Bu işlemi bankaya sor.” ISO 8583 alan 55 içinde issuer’a gider.', 'Kart'],
          [<b key="2">TC</b>, 'Transaction Certificate', '“İşlem onaylandı.” Çevrimdışı onayda ya da banka onayından sonra.', 'Kart'],
          [<b key="3">AAC</b>, 'Application Authentication Cryptogram', '“İşlem reddedildi.” Kayda geçer, ağa gitmez.', 'Kart'],
          [<b key="4">ARPC</b>, 'Authorisation Response Cryptogram', 'Banka yanıtının kartta doğrulanabilir imzası.', 'Issuer (HSM)'],
        ]}
      />
      <h3>ARQC nasıl üretilir ve doğrulanır?</h3>
      <Flow
        items={[
          { title: 'Kartın anahtarı', text: 'Banka, her karta kendine özgü bir anahtar yükler. Bu anahtar issuer ana anahtarından (IMK) kartın PAN’ı ve PSN’i ile türetilir ve kartın dışına asla çıkmaz.' },
          { title: 'İşleme özel oturum anahtarı', text: 'Kart, bu anahtardan ATC’yi kullanarak her işlem için yeni bir oturum anahtarı türetir. Aynı ATC iki kez kullanılmaz.' },
          { title: 'MAC hesaplama', tag: 'tutar · ülke · TVR · para birimi · tarih · tür · UN · AIP · ATC · IAD', text: 'Terminalin CDOL1 ile gönderdiği veriler ve kartın kendi değerleri üzerinde MAC hesaplanır; sonuç 8 baytlık ARQC’dir.' },
          { title: 'Banka doğrular', tag: 'HSM', text: 'Issuer HSM’i aynı türetmeyi kendi tarafında yapıp ARQC’yi yeniden hesaplar. Tutarsa kart gerçektir ve veriler yolda değişmemiştir.' },
          { title: 'ARPC ile karşılık', tag: 'alan 55 · tag 91', text: 'Banka, ARQC ve yanıt kodundan ARPC üretip yanıtla gönderir. Kart bunu doğrulayarak yanıtın gerçekten kendi bankasından geldiğini anlar (issuer authentication).' },
        ]}
      />
      <Callout title="Neden klonlanamıyor?">
        Bir işlemin ARQC’sini kaydeden saldırgan bunu tekrar kullanamaz: ATC ilerlemiştir ve UN farklıdır. Kartın anahtarını da çıkaramaz. Bu yüzden
        EMV’nin yaygınlaşmasıyla kart-mevcut sahteciliği çipli işlemlerde dramatik biçimde düşmüştür; saldırganlar manyetik şerite fallback’e yönelmiştir
        (senaryo 5).
      </Callout>
      <h3>Çevrimdışı veri doğrulama (ODA)</h3>
      <Table
        head={['Yöntem', 'Kart ne yapar?', 'Güç']}
        rows={[
          [<b key="1">SDA</b>, 'Sabit verisinin banka tarafından atılmış imzasını sunar', 'Zayıf: imza kopyalanıp başka karta konabilir (“yes-card”)'],
          [<b key="2">DDA</b>, 'Terminalin rastgele sayısını kendi özel anahtarıyla imzalar', 'Güçlü: her işlemde taze imza'],
          [<b key="3">CDA</b>, 'Kriptogramı da aynı imzaya katar', 'En güçlü: kriptogram ve doğrulama birbirine bağlı'],
        ]}
      />
      <p>
        Güven zinciri: terminaldeki <b>CA açık anahtarı</b> (RID + indeks ile seçilir, tag 8F) → kartta <b>issuer açık anahtar sertifikası</b> (tag 90) →
        <b> ICC açık anahtar sertifikası</b> (tag 9F46). Her halka bir öncekiyle doğrulanır.
      </p>

      <h2 id="cvm">Kart sahibi doğrulama (CVM)</h2>
      <p>
        Kart, <b>CVM listesinde</b> (tag 8E) tercih sırasını verir: her giriş bir yöntem ve bir koşuldur (“tutar X’in altındaysa…”). Terminal listeyi
        sırayla gezer ve kendi desteklediği ilk uygun yöntemi uygular.
      </p>
      <Table
        head={['Yöntem', 'Kim doğrular?', 'Nerede görülür?']}
        rows={[
          ['Çevrimdışı düz PIN', 'Kart (VERIFY komutu)', 'Terminalde PIN şifrelenmeden karta gider; düz PIN taşıyan hat güvenlik gerektirir'],
          ['Çevrimdışı şifreli PIN', 'Kart', 'PIN, kartın açık anahtarıyla şifrelenip VERIFY ile gider'],
          ['Çevrimiçi şifreli PIN', 'Issuer (HSM)', <>ATM’lerin standardı. PIN bloğu EPP’de şifrelenir, ISO 8583 <b>alan 52</b> ile bankaya gider</>],
          ['İmza', 'Kasiyer', 'POS (ATM’de kullanılmaz)'],
          ['CDCVM (cihaz doğrulaması)', 'Telefon/saat', 'Temassız mobil ödeme: parmak izi, yüz, ekran kilidi'],
          ['Doğrulama yok (No CVM)', '—', 'Düşük tutarlı temassız işlemler'],
        ]}
      />
      <p>
        ATM’de kullanılan PIN bloğu simülatörde <i>ISO format 0</i> olarak anılır: PIN alanı ile PAN alanı XOR’lanır; böylece aynı PIN farklı kartlarda farklı
        blok üretir.
      </p>

      <h2 id="risk">Risk yönetimi ve karar</h2>
      <p>
        Terminal, işlem boyunca <b>TVR</b> (Terminal Verification Results) adlı 5 baytlık bir bit alanı tutar. Her şüpheli durum bir biti 1 yapar. Hiçbir
        bit tek başına işlemi reddetmez; kararı, bu bitlerin <b>TAC</b> (terminal) ve <b>IAC</b> (kartın içindeki issuer maskesi) ile karşılaştırılması verir.
      </p>
      <Table
        head={['TVR', 'Bit 1 ise anlamı']}
        rows={[
          [<code key="1">Bayt 1 b8</code>, 'Çevrimdışı veri doğrulama yapılmadı'],
          [<code key="2">Bayt 1 b7 · b4 · b3</code>, 'SDA / DDA / CDA başarısız'],
          [<code key="3">Bayt 2 b8</code>, 'Kart ve terminal uygulama sürümleri farklı'],
          [<code key="4">Bayt 2 b7 · b6</code>, 'Uygulamanın süresi dolmuş · henüz geçerli değil'],
          [<code key="5">Bayt 2 b5</code>, 'İstenen hizmet kart ürününde izinli değil'],
          [<code key="6">Bayt 2 b4</code>, 'Yeni kart'],
          [<code key="7">Bayt 3 b8</code>, 'Kart sahibi doğrulama başarısız'],
          [<code key="8">Bayt 3 b6</code>, 'PIN deneme limiti aşıldı'],
          [<code key="9">Bayt 3 b4</code>, 'PIN gerekliydi, girilmedi'],
          [<code key="10">Bayt 3 b3</code>, 'Çevrimiçi PIN girildi'],
          [<code key="11">Bayt 4 b8</code>, 'Tutar floor limit’i aştı'],
          [<code key="12">Bayt 4 b7 · b6</code>, 'Alt · üst ardışık çevrimdışı limit aşıldı'],
          [<code key="13">Bayt 4 b5</code>, 'İşlem rastgele seçilip online’a zorlandı'],
        ]}
      />
      <h3>Karar sırası (terminal eylem analizi)</h3>
      <Flow
        items={[
          { decision: true, title: 'TVR ∧ (TAC-Denial ∨ IAC-Denial) ≠ 0 ?', branches: [{ label: 'Evet', text: 'AAC iste → işlem reddedilir.', tone: 'bad' }, { label: 'Hayır', text: 'Bir sonraki kontrole geç.' }] },
          { decision: true, title: 'Terminal çevrimiçi çalışabilir mi ve TVR ∧ (TAC-Online ∨ IAC-Online) ≠ 0 mı?', branches: [{ label: 'Evet', text: 'ARQC iste → bankaya sor (ATM’de her zaman).', tone: 'warn' }, { label: 'Hayır', text: 'Çevrimdışı karara devam et.' }] },
          { decision: true, title: 'Çevrimiçi başarısız ya da yok; TVR ∧ (TAC-Default ∨ IAC-Default) ≠ 0 ?', branches: [{ label: 'Evet', text: 'AAC iste → reddet.', tone: 'bad' }, { label: 'Hayır', text: 'TC iste → çevrimdışı onayla.', tone: 'ok' }] },
        ]}
      />
      <p>Aşağıdaki laboratuvarda bit ve terminal türünü değiştirerek kararın nasıl değiştiğini görün.</p>
      <TaaLab />
      <Callout title="ATM’lerde çevrimdışı onay yoktur">
        ATM’ler genellikle <b>Terminal Type 14</b> (finansal kuruluş, gözetimsiz, yalnızca online) olarak çalışır ve TAC-Online değeri “hepsi 1” kurulur: her
        nakit çekim bankaya sorulur. Çevrimdışı onay (TC) esas olarak POS ve ulaşım gibi düşük tutarlı ortamlarda görülür.
      </Callout>

      <h2 id="iso">ISO 8583 ile birleştiği yer</h2>
      <p>
        EMV terminalle kart arasındaki dünyadır; banka tarafı ISO 8583’ü bilir. Çip verisi iki yerden mesaja girer:
      </p>
      <Table
        head={['ISO 8583 alanı', 'Çip karşılığı', 'Not']}
        rows={[
          [<b key="1">2</b>, 'Tag 5A (PAN)', ''],
          [<b key="2">35</b>, 'Tag 57 (Track 2 eşdeğeri)', 'Çipli işlemde de gönderilir'],
          [<b key="3">22</b>, 'Giriş modu', '05x çip · 07x temassız · 80x çipten şeride fallback · 02x manyetik şerit'],
          [<b key="4">23</b>, 'Tag 5F34 (PSN)', ''],
          [<b key="5">52</b>, 'Çevrimiçi PIN bloğu', 'ATM’de standart'],
          [<b key="6">55</b>, 'EMV TLV paketi', '9F26, 9F27, 9F10, 9F37, 9F36, 95, 9A, 9C, 9F02, 5F2A, 82, 9F1A, 9F34, 9F33…'],
        ]}
      />
      <p>
        Yanıtta issuer <b>alan 55</b> içinde <b>ARPC’yi</b> (tag 91) geri gönderir. Alan 39’daki yanıt kodu (00) ile birlikte bu, kartın “banka gerçekten onayladı”
        diyebilmesi için gereken bilgidir.
      </p>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <Tabs
        label="EMV senaryoları"
        tabs={[
          {
            label: '1 · ATM çevrimiçi onay',
            content: (
              <>
                <Sequence
                  label="Çipli kartla ATM’den nakit çekim: baştan sona"
                  actors={[ACT.card, ACT.term, ACT.acq, ACT.iss]}
                  steps={[
                    { sep: 'Uygulama seçimi' },
                    { from: 'term', to: 'card', label: 'SELECT 1PAY.SYS.DDF01', sub: 'PSE: hangi uygulamalar var?' },
                    { from: 'card', to: 'term', label: 'AID listesi', sub: 'A0000000031010 …', res: true },
                    { from: 'term', to: 'card', label: 'SELECT AID', sub: 'A0000000031010' },
                    { from: 'card', to: 'term', label: 'FCI + PDOL', res: true },
                    { sep: 'Başlatma ve veri okuma' },
                    { from: 'term', to: 'card', label: 'GET PROCESSING OPTIONS' },
                    { from: 'card', to: 'term', label: 'AIP + AFL', res: true },
                    { from: 'term', to: 'card', label: 'READ RECORD ×n' },
                    { from: 'card', to: 'term', label: 'PAN, CVM listesi, CDOL1…', res: true },
                    { note: 'ODA yapılır · kısıtlamalar kontrol edilir\nTAC-Online = hepsi 1 → online zorunlu', at: 'term' },
                    { note: 'Müşteri PIN girer → EPP şifreler (çevrimiçi PIN)', at: 'term', tone: 'ok' },
                    { sep: 'Kart eylem analizi' },
                    { from: 'term', to: 'card', label: 'GENERATE AC (P1 = ARQC)', sub: 'CDOL1 verisi' },
                    { from: 'card', to: 'term', label: 'ARQC + ATC + IAD', res: true, tone: 'warn' },
                    { sep: 'Çevrimiçi yetkilendirme' },
                    { from: 'term', to: 'acq', label: '0200 · 55=ARQC verisi · 52=PIN', tone: 'warn' },
                    { from: 'acq', to: 'iss', label: '0200', tone: 'warn' },
                    { note: 'HSM: ARQC doğrula\nPIN doğrula · bakiye', at: 'iss' },
                    { from: 'iss', to: 'acq', label: '0210 · 39=00 · 55=ARPC', res: true, tone: 'ok' },
                    { from: 'acq', to: 'term', label: '0210', res: true, tone: 'ok' },
                    { sep: 'Tamamlama' },
                    { from: 'term', to: 'card', label: 'GENERATE AC #2', sub: 'ARPC + yanıt kodu 00', tone: 'ok' },
                    { from: 'card', to: 'term', label: 'TC', res: true, tone: 'ok' },
                    { note: 'Banknotlar verilir', at: 'term', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Kartla yapılan ilk adımlar bankaya hiç haber vermeden gerçekleşir; ATM hangi uygulamayı, hangi yeteneklerle kullanacağını bilir.</>,
                    <>PIN çevrimiçi doğrulanacağı için kartla PIN konuşulmaz: şifreli blok yalnızca ISO 8583’te gider (<b>alan 52</b>).</>,
                    <>ATM karttan <b>ARQC</b> ister, kart ATC ve issuer verisiyle birlikte cevap verir. Bu üçlü <b>alan 55</b> içinde bankaya gider.</>,
                    <>Issuer ARQC’yi HSM ile doğrular, PIN ve bakiyeye bakar, onayı <b>ARPC</b> ile mühürler.</>,
                    <>2. GENERATE AC ile banka yanıtı karta iletilir. Kart <b>TC</b> verdiyse ATM parayı sunar.</>,
                  ]}
                />
                <TryInSim>Ayşe Yılmaz’ın Visa kartını takıp PIN girin. “Kart takıldı · çip okunuyor” satırındaki AID’i not edin; 0100 ve 0200 günlüklerinde alan 52’yi görün.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Hatalı PIN',
            content: (
              <>
                <Sequence
                  label="Çevrimdışı PIN (kart doğrular) ve çevrimiçi PIN (banka doğrular)"
                  actors={[ACT.card, ACT.term, ACT.iss]}
                  steps={[
                    { sep: 'A · Çevrimdışı PIN (POS)' },
                    { from: 'term', to: 'card', label: 'VERIFY (PIN: 1111)' },
                    { from: 'card', to: 'term', label: 'SW = 63 C2', sub: 'yanlış · 2 hak kaldı', res: true, tone: 'bad' },
                    { from: 'term', to: 'card', label: 'VERIFY (PIN: 2222)' },
                    { from: 'card', to: 'term', label: 'SW = 63 C1', sub: '1 hak kaldı', res: true, tone: 'bad' },
                    { from: 'term', to: 'card', label: 'VERIFY (PIN: 3333)' },
                    { from: 'card', to: 'term', label: 'SW = 63 C0', sub: 'son hak da bitti', res: true, tone: 'bad' },
                    { note: 'TVR: PIN deneme limiti aşıldı\n→ sonraki denemelerde SW 69 83 (bloke)', at: 'term', tone: 'warn' },
                    { sep: 'B · Çevrimiçi PIN (ATM)' },
                    { from: 'term', to: 'iss', label: '0100 · 52 = PIN bloğu', tone: 'ok' },
                    { from: 'iss', to: 'term', label: '0110 · 39 = 55', sub: 'hatalı PIN', res: true, tone: 'bad' },
                    { from: 'term', to: 'iss', label: '0100 · 52 = PIN bloğu', tone: 'ok' },
                    { from: 'iss', to: 'term', label: '0110 · 39 = 75', sub: 'deneme aşıldı', res: true, tone: 'bad' },
                    { note: 'ATM kartı alıkoyar', at: 'term', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Çevrimdışı PIN</b>’de sayaç kartın içindedir (tag 9F17). Kart her yanlışta <code>63 Cx</code> ile kalan hakkı bildirir; haklar bitince PIN bloke olur ve bankaya hiç soru gitmeden işlem düşer.</>,
                    <><b>Çevrimiçi PIN</b>’de sayaç bankanın host’undadır. Kartla ATM arasında hiçbir PIN komutu yoktur; yanlış PIN yalnızca ISO 8583 yanıt koduyla (<b>55</b>, sonra <b>75</b>) bilinir.</>,
                    <>Her iki durumda da müşteri doğru PIN’i girene kadar işlem para hareketine geçmez.</>,
                  ]}
                />
                <TryInSim>Elif Demir’in Atlas Bank kartı (PIN 0000) ile üç kez yanlış PIN girin. Günlükte 55, 55, 75 yanıtlarını ve kartın alıkonmasını izleyin.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Çevrimdışı onay',
            content: (
              <>
                <Sequence
                  label="Düşük tutarlı POS işlemi bankaya sorulmadan onaylanır"
                  actors={[ACT.card, ACT.term, ACT.iss]}
                  steps={[
                    { note: 'Tutar floor limit’in altında · ODA başarılı\nPIN doğru · rastgele seçilmedi · TVR temiz', at: 'term' },
                    { from: 'term', to: 'card', label: 'GENERATE AC (P1 = TC)', tone: 'ok' },
                    { from: 'card', to: 'term', label: 'TC', res: true, tone: 'ok' },
                    { note: 'Çevrimdışı onaylandı:\nMüşteriye hemen sonuç, banka çevrimde değil', at: 'term', tone: 'ok' },
                    { sep: 'Gün sonu' },
                    { from: 'term', to: 'iss', label: 'Toplu gönderim', sub: '0220 advice / clearing dosyası', tone: 'warn' },
                    { from: 'iss', to: 'term', label: 'Alındı', res: true },
                  ]}
                />
                <Notes
                  items={[
                    <>Terminal karttan <b>TC</b> ister ve kart <b>kendi kuralları da uygunsa</b> TC verir. Kart istemezse ARQC (“bankaya sor”) ya da AAC ile karşılık verir.</>,
                    <>Çevrimdışı işlemler <b>gün sonunda</b> bir batch olarak bankaya iletilir (advice ya da clearing). Bu arada kart ATC ve ardışık çevrimdışı işlem sayacını artırır; sayaç limiti aşınca kart bir sonraki işlemde online ister.</>,
                    <>Riski issuer değil <b>floor limit</b> yönetir: tutar ya da sayaç limiti aşılmadıkça terminal bankaya sormaz.</>,
                  ]}
                />
              </>
            ),
          },
          {
            label: '4 · Bankaya ulaşılamıyor',
            content: (
              <>
                <Sequence
                  label="ARQC gönderildi ama hat cevap vermiyor"
                  actors={[ACT.card, ACT.term, ACT.acq]}
                  steps={[
                    { from: 'term', to: 'card', label: 'GENERATE AC (P1 = ARQC)' },
                    { from: 'card', to: 'term', label: 'ARQC', res: true, tone: 'warn' },
                    { from: 'term', to: 'acq', label: '0200 · 55 = ARQC', lost: true, tone: 'bad' },
                    { note: 'Zaman aşımı: çevrimiçi yetkilendirme yapılamadı\nTVR ∧ (TAC/IAC-Default) kontrol edilir', at: 'term', tone: 'warn' },
                    { sep: 'ATM (yalnızca online)' },
                    { from: 'term', to: 'card', label: 'GENERATE AC #2 (P1 = AAC)', sub: 'ARC = Z3 (online yok, reddet)', tone: 'bad' },
                    { from: 'card', to: 'term', label: 'AAC', res: true, tone: 'bad' },
                    { note: 'İşlem reddedilir, para verilmez', at: 'term', tone: 'bad' },
                    { sep: 'POS (default maskesi temiz)' },
                    { from: 'term', to: 'card', label: 'GENERATE AC #2 (P1 = TC)', sub: 'ARC = Y3 (online yok, onayla)', tone: 'ok' },
                    { from: 'card', to: 'term', label: 'TC', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Banka ARQC’yi almadıysa terminal ikinci bir GENERATE AC yapar ve <b>ulaşılamadı</b> bilgisini (ARC = Y3 ya da Z3) karta bildirir.</>,
                    <>ATM gibi yalnızca online terminal <b>her zaman reddeder</b>: nakit verme riski taşınamaz.</>,
                    <>POS’ta karar Default maskelerine bağlıdır: TVR temizse TC (çevrimdışı onay), değilse AAC.</>,
                    <>Banka isteği aldı ama yanıt kayıp olabilir: bu durum ISO 8583 sayfasındaki <b>zaman aşımı ve iptal</b> senaryosudur ve iptal (0400/0420) gerektirir.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Host yanıtı kaybolur” arızasıyla para çekin. ATM parayı vermeyip iptali SAF kuyruğuna alır; bu EMV’deki “emin olamıyorsan reddet” prensibinin ISO 8583 tarafıdır.</TryInSim>
              </>
            ),
          },
          {
            label: '5 · Çip okunamıyor (fallback)',
            content: (
              <>
                <Sequence
                  label="Çip hasarlı: manyetik şeride düşülür"
                  actors={[ACT.card, ACT.term, ACT.iss]}
                  steps={[
                    { from: 'term', to: 'card', label: 'SELECT / GPO', lost: true, tone: 'bad' },
                    { note: 'Kart yanıt vermiyor ya da hata (3 deneme)', at: 'term', tone: 'bad' },
                    { sep: 'Fallback' },
                    { note: 'Terminal şeridi okutmasını ister\nService code 2xx/6xx: “bu kartta çip var”', at: 'term', tone: 'warn' },
                    { from: 'term', to: 'iss', label: '0200 · 22 = 80x · 35 = Track 2', sub: 'fallback bayrağı', tone: 'warn' },
                    { note: 'Issuer risk değerlendirir:\n“çipli kart şeritle geldi”', at: 'iss', tone: 'warn' },
                    { from: 'iss', to: 'term', label: '0210 · 39 = 00 ya da 05', res: true },
                  ]}
                />
                <Notes
                  items={[
                    <>Çipli kart önce <b>çip</b> denenir; çip okunamazsa terminal manyetik şeride düşebilir. Bu <b>fallback</b>’tir ve ISO 8583 <b>alan 22’de 80x</b> ile işaretlenir.</>,
                    <>Şerit verisinde kriptogram yoktur: işlem tamamen statik veriye dayanır. Bu yüzden saldırganlar çipi bozup fallback’i zorlar.</>,
                    <>Bu yüzden issuer fallback işlemleri daha sıkı değerlendirir; birçok banka reddeder. Sahteciliğin faturası <b>liability shift</b> kuralıyla genelde çipsiz yoldan işlemi kabul eden tarafa (acquirer/işyeri) yazılır.</>,
                    <>Çoğu ATM, çipli kartta fallback’e izin vermez ya da yalnızca belirli koşullarda verir.</>,
                  ]}
                />
              </>
            ),
          },
          {
            label: '6 · Temassız',
            content: (
              <>
                <Sequence
                  label="Telefon ya da kartla temassız ödeme"
                  actors={[ACT.card, ACT.term, ACT.iss]}
                  steps={[
                    { from: 'term', to: 'card', label: 'SELECT 2PAY.SYS.DDF01', sub: 'PPSE' },
                    { from: 'card', to: 'term', label: 'AID listesi', res: true },
                    { note: 'Kernel seçilir (Kernel 2 Mastercard, Kernel 3 Visa…)', at: 'term' },
                    { from: 'term', to: 'card', label: 'GET PROCESSING OPTIONS', sub: 'tutar + terminal yetenekleri' },
                    { from: 'card', to: 'term', label: 'AIP · AFL · kriptogram verisi', sub: 'çoğu zaman tek yanıtta', res: true, tone: 'ok' },
                    { note: 'Telefon: biyometri / ekran kilidi\n(CDCVM) yapılmış olabilir', at: 'card' },
                    { from: 'term', to: 'iss', label: '0200 · 22 = 07x · 55', tone: 'ok' },
                    { from: 'iss', to: 'term', label: '0210 · 39 = 00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Temaslı işlemdeki komut dizisi temassızda <b>birkaç komuta iner</b>: kart okuma süresi kısa olmalıdır, çünkü müşterinin kartı bırakmaması gereken süre sınırlıdır.</>,
                    <>Uygulama seçimi <code>2PAY.SYS.DDF01</code> (PPSE) ile yapılır; markaya özel <b>kernel</b> seçilir.</>,
                    <>Düşük tutarlarda PIN istenmez; limit üstünde ya da periyodik olarak PIN gerekir. Cihaz üstü doğrulama (CDCVM) bu yükü telefona taşır.</>,
                    <>ISO 8583’te giriş modu <b>07x</b> (temassız çip) olarak işaretlenir.</>,
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <h2 id="atm">ATM’ye özgü noktalar</h2>
      <ul>
        <li>
          <b>Her zaman online:</b> nakit verilen cihazda çevrimdışı karar riski taşınmaz; ATM TAC-Online’ı hepsi 1 kurar.
        </li>
        <li>
          <b>PIN çevrimiçi:</b> tuş takımı (EPP) PIN’i girer girmez şifreler; ATM yazılımı açık PIN’i hiç görmez. PCI PTS onaylı EPP gerekir.
        </li>
        <li>
          <b>Kart önce, para sonra:</b> ATM, kartı iade edip müşteri kartı aldıktan sonra parayı sunar. Müşteri kartını unutup gitmesin diye.
        </li>
        <li>
          <b>Kartı yutma:</b> PIN limiti aşıldığında (75), kart çekilemediğinde ya da çalıntı bildirimi geldiğinde ATM kartı alıkoyar.
        </li>
        <li>
          <b>Issuer script’leri:</b> bankanın yanıtıyla gelen komutlar (PIN değiştir, kartı blokla, parametre güncelle) ATM tarafından karta uygulanır;
          sonuç TVR’ye/TSI’ye yansır.
        </li>
        <li>
          <b>Anahtar yönetimi:</b> terminaldeki CA açık anahtarları (CAPK) süresi dolmadan güncellenmelidir; yoksa ODA başarısız görünür.
        </li>
      </ul>

      <h2 id="ozet">Özet ve sözlük</h2>
      <Table
        head={['Terim', 'Kısaca']}
        rows={[
          ['AID', 'Uygulama kimliği: RID + PIX. Visa A0000000031010, Mastercard A0000000041010, Troy A0000006723010'],
          ['AIP / AFL', 'Kartın yetenekleri / okunacak kayıtların listesi'],
          ['ATC', 'Kartın işlem sayacı; her kriptogramda farklı'],
          ['ARQC / TC / AAC', 'Bankaya sor / onayla / reddet kriptogramları'],
          ['ARPC', 'Banka yanıtının kartta doğrulanan imzası'],
          ['CVM', 'Kart sahibi doğrulama yöntemi: PIN, imza, CDCVM…'],
          ['TVR · TSI', 'Terminalin risk bitleri · tamamlanan işlem adımları'],
          ['TAC / IAC', 'Terminalin / bankanın karar maskeleri (Denial, Online, Default)'],
          ['ODA (SDA, DDA, CDA)', 'Çevrimdışı veri doğrulama'],
          ['PDOL / CDOL', 'Kartın terminalden hangi verileri istediğinin listesi'],
          ['Floor limit', 'Üstünde online zorunlu olan tutar'],
          ['Liability shift', 'Sahtecilik zararının çipsiz tarafa kayması'],
          ['Fallback', 'Çip okunamayınca manyetik şeride düşme'],
        ]}
      />
      <p className="tr-next">
        Önceki konu: <a href="#/egitim/iso8583">← ISO 8583 · mesajın bankaya giden kısmı</a>
      </p>
    </>
  )
}
