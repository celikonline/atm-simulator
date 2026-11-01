import { useState } from 'react'
import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- yardımcılar
const preStyle = {
  display: 'block',
  whiteSpace: 'pre',
  overflowX: 'auto',
  margin: '10px 0',
  padding: '12px 14px',
  background: 'var(--panel)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  fontFamily: 'var(--font-mono)',
  fontSize: 12.5,
  lineHeight: 1.55,
  maxWidth: 'none',
}
const bareCode = { background: 'none', padding: 0, fontSize: 'inherit' }

function Code({ children, label }) {
  return (
    <pre style={preStyle} aria-label={label}>
      <code style={bareCode}>{children}</code>
    </pre>
  )
}

// ---------------------------------------------------------------- SQL örnekleri
const SQL_TRANSFER = `BEGIN;

-- Kilitleri hep aynı sırada alın (IBAN sırasıyla): iki ters yönlü transfer birbirini kilitlemesin.
SELECT iban FROM account WHERE iban IN (:gonderen, :alici) ORDER BY iban FOR UPDATE;

-- Koşullu güncelleme: bakiye yetmiyorsa hiçbir satır etkilenmez.
UPDATE account
   SET balance = balance - :tutar - :ucret
 WHERE iban = :gonderen AND balance >= :tutar + :ucret;
-- 0 satır etkilendiyse: ROLLBACK ve 51 döndür.

UPDATE account SET balance = balance + :tutar WHERE iban = :alici;

-- Her hareket için çift taraflı kayıt (toplamları sıfır olmalı).
INSERT INTO ledger_entry (txn_id, iban, delta) VALUES
  (:txn, :gonderen, -(:tutar + :ucret)),
  (:txn, :alici,     :tutar);

COMMIT;  -- ikisi birlikte kalıcı olur ya da hiçbiri olmaz`

const SQL_ATOMIC = `-- Tek ifadede kontrol + yazma: araya girilecek bir "okuma" boşluğu kalmaz.
UPDATE account
   SET balance         = balance - :tutar,
       daily_withdrawn = daily_withdrawn + :tutar
 WHERE iban = :iban
   AND balance >= :tutar
   AND daily_withdrawn + :tutar <= 10000;   -- günlük limit (simülatördeki değer)
-- 1 satır etkilendi → onay (00).  0 satır → bakiye (51) ya da limit (61) yetmedi.

-- Değişmezleri veritabanına da bildirin:
ALTER TABLE account
  ADD CONSTRAINT bakiye_eksi_olmaz CHECK (balance >= 0),
  ADD CONSTRAINT gunluk_limit      CHECK (daily_withdrawn <= 10000);`

const SQL_OPT = `-- 1) Oku (sürümü de al)
SELECT balance, version FROM account WHERE iban = :iban;   -- ör. 1000, sürüm 7

-- 2) Okuduğun sürüm hâlâ güncelse yaz
UPDATE account
   SET balance = :yeni_bakiye, version = version + 1
 WHERE iban = :iban AND version = :okunan_surum;

-- 0 satır etkilendi → başka işlem araya girdi: yeniden oku, kuralları yeniden işlet, tekrar dene.
-- Çakışma nadirse kilit tutmaktan ucuzdur; çakışma sıksa (sıcak hesap) SELECT ... FOR UPDATE daha iyidir.`

const SQL_IDEMP = `-- Her iptal, asıl işlemi tanımlayan anahtarla bir kez işlenir.
CREATE TABLE reversal_log (
  orig_stan CHAR(6), orig_date CHAR(4), terminal CHAR(8), acquirer CHAR(5),
  PRIMARY KEY (orig_stan, orig_date, terminal, acquirer)
);

BEGIN;
INSERT INTO reversal_log VALUES (:stan, :tarih, :terminal, :acquirer)
  ON CONFLICT DO NOTHING;                        -- PostgreSQL sözdizimi
-- Etkilenen satır 1 ise iadeyi yap, 0 ise bu iptal zaten işlenmiş: yalnızca "00" döndür.
UPDATE account SET balance = balance + :tutar WHERE iban = :iban;   -- yalnızca 1 ise
COMMIT;`

const SQL_OUTBOX = `BEGIN;
UPDATE account SET balance = balance - :tutar WHERE iban = :iban AND balance >= :tutar;
INSERT INTO outbox (id, topic, payload, created_at)
  VALUES (:uuid, 'pacs.008', :xml, now());       -- defter ve "gönderilecek mesaj" aynı transaction'da
COMMIT;

-- Ayrı bir süreç outbox'ı okur, mesajı gönderir, gönderildi diye işaretler.
-- Gönderim sonrası çökerse mesaj tekrar gider: alıcı UETR ile tekrarı ayıklar (en az bir kez + idempotent).`

// ---------------------------------------------------------------- etkileşimli: iki ATM yarışı
const fmt = (n) => n.toLocaleString('tr-TR')

function runRace(mode, start, amts) {
  const log = []
  const names = ['ATM-1', 'ATM-2']
  let bal = start
  let ver = 1
  let out = 0
  const apply = (who, amt, from) => {
    if (amt > from) {
      log.push(`${who}: ${fmt(amt)} > ${fmt(from)} → 51, para verilmez`)
      return
    }
    bal = from - amt
    out += amt
    ver += 1
    log.push(`${who} yazar: ${fmt(from)} − ${fmt(amt)} = ${fmt(bal)}, para verilir`)
  }
  if (mode === 'none') {
    names.forEach((n) => log.push(`${n} okur: bakiye ${fmt(start)}`))
    names.forEach((n, i) => apply(n, amts[i], start))
  } else if (mode === 'lock') {
    names.forEach((n, i) => {
      log.push(`${n} kilidi alır (FOR UPDATE) ve okur: bakiye ${fmt(bal)}`)
      apply(n, amts[i], bal)
      log.push(`${n} COMMIT, kilit açılır`)
    })
  } else {
    names.forEach((n) => log.push(`${n} okur: bakiye ${fmt(start)}, sürüm 1`))
    apply('ATM-1', amts[0], start)
    if (ver > 1) {
      log.push('ATM-2: UPDATE ... WHERE version = 1 → 0 satır etkilendi (çakışma)')
      log.push(`ATM-2 yeniden okur: bakiye ${fmt(bal)}, sürüm ${ver}`)
    }
    apply('ATM-2', amts[1], bal)
  }
  const expected = start - out
  return { log, bal, out, expected, ok: bal === expected }
}

const MODES = [
  ['none', 'Kilitsiz: oku, hesapla, yaz'],
  ['lock', 'Satır kilidi (SELECT ... FOR UPDATE)'],
  ['version', 'İyimser kilit (version sütunu)'],
]

function RaceLab() {
  const [mode, setMode] = useState('none')
  const [start, setStart] = useState(1000)
  const [a, setA] = useState(800)
  const [b, setB] = useState(800)
  const r = runRace(mode, start, [a, b])
  const num = (set) => (e) => set(Math.max(0, Math.round(Number(e.target.value)) || 0))
  return (
    <div className="tr-lab">
      <div className="tr-lab-row">
        <label>
          Başlangıç bakiyesi (TL)
          <input type="number" min="0" step="10" className="tr-input mono" value={start} onChange={num(setStart)} />
        </label>
        <label>
          ATM-1 çekim (TL)
          <input type="number" min="0" step="10" className="tr-input mono" value={a} onChange={num(setA)} />
        </label>
        <label>
          ATM-2 çekim (TL)
          <input type="number" min="0" step="10" className="tr-input mono" value={b} onChange={num(setB)} />
        </label>
      </div>
      <fieldset className="tr-fieldset" style={{ marginTop: 12 }}>
        <legend>Eşzamanlılık denetimi</legend>
        {MODES.map(([k, text]) => (
          <label key={k} className="tr-check">
            <input type="radio" name="race-mode" checked={mode === k} onChange={() => setMode(k)} />
            {text}
          </label>
        ))}
      </fieldset>
      <div className={`tr-verdict ${r.ok ? 'ok' : 'bad'}`} role="status">
        <span>{r.ok ? 'Defter tutarlı' : 'Kayıp güncelleme: defter yanlış'}</span>
        <b>
          Dağıtılan {fmt(r.out)} TL · bakiye {fmt(r.bal)} TL
        </b>
        <span>Olması gereken bakiye: {fmt(r.expected)} TL</span>
      </div>
      <ol className="tr-notes compact">
        {r.log.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
      <p className="tr-muted">
        Model, en kötü zamanlamayı varsayar: iki ATM de herhangi biri yazmadan önce okur. Gerçek veritabanında bu pencere küçüktür ama yüklü sistemde mutlaka
        denk gelir. Varsayılan 1.000 / 800 / 800 değerlerinde kilitsiz modda 1.600 TL dağıtılır, bakiye yalnızca 800 TL düşer.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- sayfa
const ACT = {
  atm: { id: 'atm', label: 'ATM', sub: 'Uygulama' },
  host: { id: 'host', label: 'Banka Host', sub: 'Core + defter' },
  cdm: { id: 'cdm', label: 'Para dağıtıcı', sub: 'CDM · fiziksel dünya' },
  atm1: { id: 'atm1', label: 'ATM-1', sub: 'İşlem A' },
  atm2: { id: 'atm2', label: 'ATM-2', sub: 'İşlem B' },
  db: { id: 'db', label: 'Hesap tablosu', sub: 'Aynı satır' },
  coord: { id: 'coord', label: 'Koordinatör', sub: 'Transfer servisi' },
  da: { id: 'da', label: 'Gönderen DB', sub: 'Banka A' },
  dbb: { id: 'dbb', label: 'Alıcı DB', sub: 'Banka B' },
  a: { id: 'a', label: 'Gönderen Banka', sub: 'Core' },
  fast: { id: 'fast', label: 'FAST / TCMB', sub: 'Bankalar arası' },
  b: { id: 'b', label: 'Alıcı Banka', sub: 'Core' },
}

export default function Acid() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Güvenilir işlem"
        title="ACID"
        lead="Hesaptan para düşüldü ama banknot çıkmadı. Aynı hesaptan iki ATM aynı anda çekti. Sunucu onayladıktan hemen sonra çöktü. Bunların hepsi aynı soruyu sorar: işlem ya tamamen oldu ya hiç olmadı diyebiliyor muyuz? ACID bu sözün dört parçasıdır. Simülatördeki iptal (0400/0420), SAF kuyruğu ve gün sonu mutabakatı bu garantilerin bedelini ödeyen mekanizmalardır."
      />

      <h2 id="giris">ACID nedir?</h2>
      <p>
        ACID, veritabanı <b>işleminin (transaction)</b> dört güvencesidir. İşlem, birden çok adımı tek bir mantıksal iş olarak çalıştırır:
        “A hesabından 500 TL düş, B hesabına 500 TL ekle, hareketi deftere yaz”.
      </p>
      <Table
        head={['Harf', 'Güvence', 'Bir cümlede', 'ATM ve bankacılıktan örnek']}
        rows={[
          [<b key="a">A · Atomicity</b>, 'Bölünmezlik', 'İşlem ya bütünüyle uygulanır ya hiç uygulanmaz.', 'Borç var, alacak yok durumu olamaz. Para çekmede “borç + dağıtım” tek parça gibi davranmalıdır.'],
          [<b key="c">C · Consistency</b>, 'Tutarlılık', 'İşlem sonrası tüm değişmezler (kurallar) sağlanır.', 'Bakiye eksiye düşmez, günlük limit aşılmaz, ATM sayaçları host kayıtlarıyla tutar.'],
          [<b key="i">I · Isolation</b>, 'Yalıtım', 'Eşzamanlı işlemler birbirini bozmaz; sanki sırayla çalışmış gibi görünür.', 'İki ATM aynı hesaptan aynı anda çekince bakiye iki kez harcanmaz.'],
          [<b key="d">D · Durability</b>, 'Kalıcılık', 'Onaylanmış işlem çökmeye rağmen kaybolmaz.', '“Onaylandı” denen çekim host yeniden başlayınca da defterde durur.'],
        ]}
      />
      <Callout tone="warn" title="Önemli: ATM işlemi tek bir veritabanı işlemi değildir">
        Host defterine borç yazmak bir veritabanı işlemidir, ama ardından <b>fiziksel banknot dağıtmak</b> değildir. Banknotu “geri alamazsınız”, ancak
        <b> telafi edersiniz</b> (iptal mesajı, iade). Bu yüzden ATM dünyası klasik rollback yerine <b>saga / telafi</b> kalıbıyla çalışır. Sayfanın büyük kısmı bu farkı anlatır.
      </Callout>

      <h2 id="atomiklik">Atomicity: bölünmezlik</h2>
      <p>
        İki ayrı yerde atomiklik sorunu vardır: <b>(1)</b> aynı veritabanındaki birden çok satır (havale: borç + alacak), <b>(2)</b> veritabanı ile dış dünya
        (borç + banknot dağıtımı). Birincisini veritabanı çözer, ikincisini <b>siz</b> tasarlarsınız.
      </p>
      <h3>Aynı bankada havale: tek transaction</h3>
      <p>Borç ve alacak aynı veritabanında olduğundan gerçek bir transaction kullanılabilir. Çökme ya da hata olursa ikisi birlikte geri alınır:</p>
      <Code label="Tek transaction ile transfer">{SQL_TRANSFER}</Code>
      <h3>Para çekme: önce borç mu, önce para mı?</h3>
      <Sequence
        label="Borç kaydı kalıcı olduktan sonra dağıtım başarısız olursa telafi (iptal) gerekir"
        actors={[ACT.atm, ACT.host, ACT.cdm]}
        steps={[
          { from: 'atm', to: 'host', label: '0200 · 500 TRY', tone: 'ok' },
          { note: 'T1: borç kaydı COMMIT\nArtık görünür ve kalıcı', at: 'host' },
          { from: 'host', to: 'atm', label: '0210 · 39 = 00', res: true, tone: 'ok' },
          { from: 'atm', to: 'cdm', label: 'Banknotları dağıt', tone: 'ok' },
          { from: 'cdm', to: 'atm', label: 'Hata: sıkışma', res: true, tone: 'bad' },
          { sep: 'Telafi (compensation)' },
          { from: 'atm', to: 'host', label: '0400 · 39 = 22', sub: 'alan 90: asıl işlem', tone: 'warn' },
          { note: 'C1: borç geri alınır\n(yeni bir ters kayıt)', at: 'host', tone: 'warn' },
          { from: 'host', to: 'atm', label: '0410 · 39 = 00', res: true, tone: 'ok' },
        ]}
      />
      <Table
        head={['', 'Rollback (geri alma)', 'Telafi (compensation)']}
        rows={[
          ['Ne zaman', 'COMMIT’ten önce', 'COMMIT’ten sonra'],
          ['Dış dünyaya görünürlük', 'Kimse ara durumu görmez', 'Ara durum görünür: bakiye düşmüş, SMS gitmiş olabilir'],
          ['Nasıl yapılır', 'Veritabanı otomatik geri sarar', 'Yeni, ters yönlü bir işlem yazılır (0400, iade)'],
          ['Hata payı', 'Veritabanı garanti eder', 'Telafinin kendisi de başarısız olabilir: kuyruk, tekrar ve idempotentlik gerekir'],
        ]}
      />
      <h3>Hangi sırayla yapılmalı?</h3>
      <ul>
        <li>
          <b>Önce geri alınabilir olanı yapın.</b> Banknot dağıtmak geri alınamaz, borç yazmak telafi edilebilir; bu yüzden borç önce yazılır ve dağıtım hata verirse
          telafi gönderilir.
        </li>
        <li>
          <b>Fiziksel olarak mümkün mü diye önce bakın.</b> Simülatörün host’u borç yazmadan önce kasetlerdeki banknotlarla tutarın karşılanıp karşılanamayacağını
          hesaplar (<code>plan_dispense</code>); kaset yetmiyorsa 86 ile reddeder ve hesapta hareket olmaz. Böylece en sık hata telafiye gerek kalmadan elenir.
        </li>
        <li>
          <b>Telafiyi önceden hazırlayın.</b> Host onay yanıtıyla birlikte <code>reversal_token</code> verir: iptale gerekli her şey (kart, tutar, STAN, RRN, süre) imzalı olarak
          ATM’de bekler.
        </li>
      </ul>
      <Callout title="Simülatörde nasıl çalışıyor?">
        Host işlevi (<code>_withdraw</code>) saf bir işlev gibi davranır: kuralları işletir, sonra yeni bakiye, yeni kaset durumu, imzalı defter kaydı ve iptal jetonunu
        <b> tek yanıtta</b> döndürür; hata varsa hiçbir şey döndürmez. Yani host tarafında “yarım güncelleme” olmaz. Durum host’ta değil istemcide tutulduğu için
        yazma işlemini istemci uygular; bu simülatöre özgü bir basitleştirmedir (gerçek host tek bir veritabanı transaction’ı kullanır).
      </Callout>
      <TryInSim>
        Ayşe Yılmaz’ın Visa kartıyla (PIN 1234) Diğer Tutar’dan 500 TL çekin. Olay günlüğünde 0200 ve 0210’u görün. Sonra Arıza sekmesinde “Para sıkışması”nı seçip
        tekrar çekin: host onaylar, CDM sıkışır, 0400 (39 = 22) gider ve tutar iade edilir. Bakiye sorgusuyla hesabın eski haline döndüğünü doğrulayın.
      </TryInSim>

      <h2 id="tutarlilik">Consistency: değişmezler</h2>
      <p>
        Tutarlılık, “veritabanı geçerli bir durumdan geçerli başka bir duruma geçer” demektir. Geçerli, <b>sizin tanımladığınız kurallar</b> demektir; veritabanı yalnızca
        kısıt olarak yazdıklarınızı garanti eder. Bu C, dağıtık sistemlerdeki CAP’teki “consistency”den farklı bir şeydir: orada “tüm kopyalar aynı değeri görüyor mu” sorulur.
      </p>
      <Table
        head={['Değişmez', 'Nerede denetlenir', 'Simülatörde']}
        rows={[
          ['Çekim tutarı 10 TL’nin katı', 'İş kuralı', <>Yanıt 13 <Sim key="s">sim</Sim></>],
          ['Bakiye ≥ tutar + ücret', 'İş kuralı + CHECK (balance ≥ 0)', <>Yanıt 51. Ücret de bakiyeden düşer, kontrol bunu içerir <Sim key="s">sim</Sim></>],
          ['Günlük çekim ≤ 10.000 TL', 'Sayaç (daily_withdrawn) + kural', <>Yanıt 61. İptalde sayaç geri azalır; ücret sayaca girmez <Sim key="s">sim</Sim></>],
          ['Kaset sayımı = açılış + ikmal + yatan − dağıtılan − red − geri çekilen', 'ATM gün sonu denkleştirmesi', <>Servis panelindeki gün sonu denkleştirme tablosu <Sim key="s">sim</Sim></>],
          ['ATM sayaçları = host kayıtları', 'Gün sonu mutabakatı (0500)', <>Tutmazsa 95. SAF’ta bekleyen iptal en sık sebep <Sim key="s">sim</Sim></>],
          ['Bankalar arası pozisyonların toplamı sıfır', 'Takas: bir bankanın borcu başkasının alacağıdır', <>Takas &amp; Mutabakat sekmesi <Sim key="s">sim</Sim></>],
        ]}
      />
      <Code label="Tek ifadede koşullu güncelleme ve CHECK kısıtları">{SQL_ATOMIC}</Code>
      <ul>
        <li>
          <b>Çift taraflı kayıt:</b> her hareket bir tarafa borç, diğerine alacak yazar; tüm hareketlerin toplamı sıfır olmalıdır. Takasta toplam pozisyonun sıfır olması bunun bankalar arası
          karşılığıdır.
        </li>
        <li>
          <b>Tutarlılık geçicidir:</b> iki adım arasında değişmez bozulabilir (borç yazıldı, alacak yazılmadı). Atomiklik bu ara durumu dışarıya göstermeyerek tutarlılığı korur.
        </li>
        <li>
          <b>Uygulama + veritabanı birlikte:</b> kuralın bir kopyası uygulamada (anlaşılır hata mesajı için), bir kopyası veritabanında (son savunma hattı) olmalıdır.
        </li>
      </ul>

      <h2 id="izolasyon">Isolation: eşzamanlı işlemler</h2>
      <p>
        Aynı hesaba aynı anda iki işlem gelirse ne olacağını <b>yalıtım</b> belirler. En ucuz hali yalıtımsızdır ve en pahalı hatalar buradan çıkar: iki ATM aynı bakiyeyi okur, ikisi de
        çekimi uygun bulur, ikisi de yazar. Son yazan kazanır, diğeri <b>kaybolur</b>.
      </p>
      <Sequence
        label="Kayıp güncelleme (lost update) ve satır kilidiyle çözümü"
        actors={[ACT.atm1, ACT.db, ACT.atm2]}
        steps={[
          { sep: 'Kilitsiz: oku, hesapla, yaz' },
          { from: 'atm1', to: 'db', label: 'SELECT balance', sub: 'bakiye = 1.000', tone: 'ok' },
          { from: 'atm2', to: 'db', label: 'SELECT balance', sub: 'bakiye = 1.000', tone: 'ok' },
          { from: 'atm1', to: 'db', label: 'UPDATE balance = 200', sub: '800 TL verilir', tone: 'ok' },
          { from: 'atm2', to: 'db', label: 'UPDATE balance = 200', sub: '800 TL daha verilir', tone: 'bad' },
          { note: 'Toplam 1.600 TL verildi, bakiye yalnızca 800 TL düştü', span: ['atm1', 'atm2'], tone: 'bad' },
          { sep: 'SELECT ... FOR UPDATE' },
          { from: 'atm1', to: 'db', label: 'SELECT ... FOR UPDATE', sub: 'satır kilitlendi', tone: 'ok' },
          { from: 'atm2', to: 'db', label: 'SELECT ... FOR UPDATE', sub: 'bekler', tone: 'warn' },
          { from: 'atm1', to: 'db', label: 'UPDATE = 200 · COMMIT', tone: 'ok' },
          { from: 'db', to: 'atm2', label: 'bakiye = 200', sub: 'kilit düştü', res: true, tone: 'ok' },
          { note: 'ATM-2: 800 > 200 → 51, para verilmez', at: 'atm2', tone: 'ok' },
        ]}
      />
      <h3>Hangi anomaliler var?</h3>
      <Table
        head={['Anomali', 'Ne olur', 'Bankacılık örneği']}
        rows={[
          [<b key="1">Dirty read</b>, 'Henüz commit edilmemiş (sonradan geri alınacak) veriyi okursunuz', 'Bir transferin yarım borç kaydını görüp bakiye sorgusunda eksik bakiye göstermek'],
          [<b key="2">Non-repeatable read</b>, 'Aynı satırı iki kez okursunuz, arada başkası değiştirir, farklı değer görürsünüz', 'Kural kontrolünde bakiye yeterli, yazarken bakiye başka işlemle düşmüş'],
          [<b key="3">Phantom</b>, 'Aynı sorguyu iki kez çalıştırırsınız, arada eklenen yeni satırlar sonucu değiştirir', 'Günlük limiti SUM(tutar) ile hesaplarken aynı anda yeni bir çekimin eklenmesi'],
          [<b key="4">Lost update</b>, 'İki işlem aynı değeri okur, ikisi de yazar, biri ötekinin yazdığını ezer', 'İki ATM’nin aynı bakiyeden çekmesi (yukarıdaki diyagram)'],
          [<b key="5">Write skew</b>, 'İki işlem aynı kümeyi okuyup farklı satırları günceller, birlikte bir değişmezi bozar', 'Aynı müşterinin iki hesabında toplam bakiye ≥ 0 kuralı; iki ATM farklı hesaplardan çeker'],
        ]}
      />
      <h3>Yalıtım seviyeleri</h3>
      <Table
        head={['Seviye (SQL standardı)', 'Dirty read', 'Non-repeatable read', 'Phantom', 'Lost update']}
        rows={[
          [<b key="1">READ UNCOMMITTED</b>, 'Olabilir', 'Olabilir', 'Olabilir', 'Olabilir'],
          [<b key="2">READ COMMITTED</b>, 'Olmaz', 'Olabilir', 'Olabilir', 'Olabilir'],
          [<b key="3">REPEATABLE READ</b>, 'Olmaz', 'Olmaz', 'Standartta olabilir; motora bağlı', 'Motora bağlı'],
          [<b key="4">SERIALIZABLE</b>, 'Olmaz', 'Olmaz', 'Olmaz', 'Olmaz (çakışan işlem hata ile iptal edilebilir)'],
        ]}
      />
      <Callout tone="warn" title="Seviyenin adı motordan motora aynı şeyi garanti etmez">
        Tablo SQL standardına göredir. Gerçek motorlar farklı uygular: örneğin PostgreSQL’in varsayılanı READ COMMITTED, MySQL InnoDB’nin REPEATABLE READ’dir ve REPEATABLE READ’in tam anlamı
        ikisinde farklıdır. Kullandığınız motorun belgesini doğrulayın; “seviyeyi yükselttim, sorun biter” varsayımı tehlikelidir.
      </Callout>
      <h3>Çözümler</h3>
      <Table
        head={['Yöntem', 'Nasıl çalışır', 'Ne zaman']}
        rows={[
          [<b key="1">Koşullu güncelleme</b>, 'Kontrol ve yazma tek UPDATE ifadesinde; etkilenen satır sayısına bakılır', 'En basit ve çoğu zaman yeterli: bakiye, limit, stok'],
          [<b key="2">Karamsar kilit</b>, 'SELECT ... FOR UPDATE ile satırı baştan kilitler, diğerleri bekler', 'Çakışma sık (sıcak hesap) ya da hesaplama karmaşıksa'],
          [<b key="3">İyimser kilit</b>, 'version sütunu: yazarken “okuduğum sürüm hâlâ güncel mi?” diye sorar, değilse tekrar dener', 'Çakışma nadirse; kilit tutmak istemiyorsanız (uzun işlemler)'],
          [<b key="4">SERIALIZABLE</b>, 'Motor çakışan işlemlerden birini iptal eder, siz yeniden denersiniz', 'Karmaşık değişmezler (write skew)'],
        ]}
      />
      <Code label="İyimser kilit (version sütunu)">{SQL_OPT}</Code>
      <Callout tone="bad" title="Çifte harcama: günlük limit yarışı">
        Günlük limit 10.000 TL, bugün 9.500 TL çekilmiş. İki ATM aynı anda 400 TL çeker: ikisi de <code>9.500 + 400 ≤ 10.000</code> kontrolünü geçer, toplam çekim 10.300 TL olur.
        Limit kontrolü ile sayaç güncellemesi aynı atomik ifadede yapılmadığı sürece sınır delinir. Tutarlılık bölümündeki koşullu güncelleme kodu bunu kapatır.
      </Callout>
      <h3>Laboratuvar: iki ATM aynı anda çekim</h3>
      <p>
        Aşağıda iki ATM aynı hesaptan aynı anda çekim yapar. Denetim türünü değiştirip sonucu karşılaştırın: kilitsiz modda dağıtılan para ile bakiyedeki düşüş birbirini tutmaz.
      </p>
      <RaceLab />
      <Callout title="Simülatörde bu yarış neden görülmez?">
        Simülatörde işlem sırasında ekran kilitlidir ve terminal ancak ATM boştayken değiştirilebilir: bir anda tek işlem vardır. Ama mimari ilginçtir: host durumsuzdur ve bakiye her istekte
        <b> istemciden gelir</b>. İki istek aynı eski bakiyeyle gelseydi, host ikisini de o bakiyeden hesaplar ve ikinci cevap birincinin etkisini ezerdi; yani sürüm kontrolü olmayan bir
        “oku-hesapla-yaz”tır. Gerçek host bakiyeyi kendi veritabanında tutar ve yukarıdaki yöntemlerden birini kullanır.
      </Callout>
      <TryInSim>
        Ayşe Yılmaz’la (bakiye 12.500 TL) Diğer Tutar’dan önce 6.000, sonra 4.000 TL çekin, ardından 10 TL daha isteyin: günlük limit dolduğu için 61 alırsınız (bakiye hâlâ 2.500 TL, yani sebep 51 değil).
        Sınırın bakiyeden bağımsız bir sayaçla (daily_withdrawn) tutulduğunu bu şekilde görürsünüz.
      </TryInSim>

      <h2 id="kalicilik">Durability: kalıcılık</h2>
      <p>
        “Commit tamam” cevabı geldiyse işlem, makine o saniye kapansa bile yaşamalıdır. Veritabanları bunu <b>write-ahead log (WAL)</b> ile sağlar: değişiklik önce sıralı bir günlüğe yazılır,
        günlük <b>fsync</b> ile diske zorlanır ve ancak ondan sonra “commit” cevabı verilir. Asıl veri sayfaları sonradan yazılabilir; çökme olursa açılışta günlük tekrar oynatılır (redo), commit kaydı
        olmayan işlemler geri alınır (undo).
      </p>
      <Table
        head={['Ayar', 'Commit ne zaman döner', 'Makine ya da disk giderse']}
        rows={[
          ['fsync kapalı / asenkron commit', 'Günlük belleğe yazılınca', 'Son birkaç saniyelik “onaylı” işlem kaybolabilir'],
          ['fsync açık, tek makine', 'Günlük diske yazılınca', 'Çökmeye dayanır; makine ya da disk kaybında veri gider'],
          ['Senkron replika', 'Günlük ikinci makineye de ulaşınca', 'Veri kaybı yok (RPO = 0); gecikme artar, replika düşerse yazma bekleyebilir'],
          ['Asenkron replika', 'Birinci makine yazınca', 'Devir (failover) anında son işlemler kaybolabilir (RPO > 0)'],
        ]}
      />
      <ul>
        <li>
          <b>RPO / RTO:</b> RPO, kaybedilebilecek veri miktarı (zaman olarak); RTO, hizmetin geri gelme süresidir. Para hareketinde RPO hedefi sıfırdır.
        </li>
        <li>
          <b>ATM tarafı da kalıcı olmalı:</b> ATM’nin elektronik günlüğü (EJ) ve SAF kuyruğu diske yazılmazsa ATM kapanınca bekleyen iptal kaybolur ve para ancak gün sonu farkıyla fark edilir.
        </li>
        <li>
          <b>“Commit döndü ama cevap ulaşmadı”:</b> kalıcılık işlemin kaybolmamasını garanti eder, istemcinin cevabı almasını değil. Bu açığı idempotentlik kapatır (sonraki bölüm).
        </li>
      </ul>
      <Callout tone="warn" title="Simülatör kalıcılığı göstermez">
        Simülatörde bakiyeler, SAF kuyruğu ve host defteri tarayıcı belleğindedir (state). Sayfayı yenilerseniz hepsi başlangıç değerlerine döner. Yani burada <b>kalıcılığın önemi</b> anlatılır,
        kalıcılık uygulanmaz. İmzalı defter kayıtlarının (HMAC) amacı da kalıcılık değil, istemcide tutulan kaydın host tarafından güvenilir sayılmasıdır.
      </Callout>

      <h2 id="tekrar">Tekrar gönderim ve idempotentlik</h2>
      <p>
        Zaman aşımında doğru davranış “yeniden dene”dir; yeniden denenen isteğin <b>ikinci kez etki etmemesi</b> ise idempotentliktir. ATM’nin SAF kuyruğundan tekrar tekrar gönderdiği <code>0420</code>
        iptal mesajı tam bu yüzden güvenlidir: ikinci kopya parayı bir daha iade etmemelidir.
      </p>
      <Table
        head={['Dünya', 'Tekrarı ayıran anahtar']}
        rows={[
          ['ISO 8583 iptali', 'Asıl işlemin STAN + tarih/saat + terminal + acquirer birleşimi (alan 90 bunu taşır)'],
          ['ISO 20022', 'UETR, EndToEndId ve TxId (iptal ve iade mesajları asıl UETR’yi aynen taşır)'],
          ['HTTP / REST', 'İstemcinin ürettiği Idempotency-Key başlığı'],
        ]}
      />
      <Code label="İptali tek sefer işleyen anahtar">{SQL_IDEMP}</Code>
      <ul>
        <li>
          <b>Anahtar ile etki aynı transaction’da olmalı:</b> “önce kontrol et sonra yaz” iki ayrı adımsa iki tekrar aynı anda geçebilir; benzersiz anahtar kısıtı bunu atomik yapar.
        </li>
        <li>
          <b>Aynı yanıtı verin:</b> ikinci kopya geldiğinde hata yerine ilk işlemin sonucunu (00) döndürün; çünkü gönderen ilkinin yanıtını almamış olabilir.
        </li>
        <li>
          <b>Anahtarı ne kadar tutacaksınız?</b> Tekrarın gelebileceği en uzun süre kadar. Simülatörde iptal jetonu 24 saat geçerlidir.
        </li>
      </ul>
      <Callout title="Simülatörde idempotentlik nerede?">
        Çifte iade koruması <b>istemcide</b>: SAF kuyruğundaki kayıt, host iptali onayladığında kuyruktan çıkarılır; bir daha gönderilmez. Host işlevinin kendisi aynı jetonla ikinci kez çağrılırsa
        yine iade eder, çünkü durumsuzdur ve “bu iptal işlendi” bilgisini tutmaz (kodun yorumu da gerçek host’un orijinal işlemi kaydedip kontrol edeceğini söyler). Gün sonu takasında ise iptal, asıl işlemi
        <code> orig</code> referansıyla bulup birlikte düşürür.
      </Callout>
      <TryInSim>
        Arıza sekmesinde “Host yanıtı kaybolur”u seçip Ayşe ile 500 TL çekin: para verilmez, ama bakiye sorgusunda 500 TL düşmüş görünür. Teknisyen sekmesinde bakım moduna alıp “SAF kuyruğunu gönder”e basın:
        bakiye iade edilir. Kuyruk boşken tekrar basmak yeni mesaj üretmez; yani iade bir kez yapılır.
      </TryInSim>

      <h2 id="dagitik">Dağıtık işlemler: 2PC, saga, outbox</h2>
      <p>
        Banka A’nın veritabanından Banka B’ninkine para göndermek tek bir veritabanı transaction’ına sığmaz: iki ayrı sistem, aralarında ağ ve (FAST/EFT gibi) üçüncü bir ödeme sistemi vardır.
        Seçenekler:
      </p>
      <Table
        head={['Yaklaşım', 'Nasıl', 'Artısı', 'Eksisi']}
        rows={[
          [<b key="1">2PC (iki fazlı commit)</b>, 'Koordinatör önce herkese “hazır mısın”, hepsi evet derse “commit” der', 'Gerçek atomiklik', 'Koordinatör çökerse katılımcılar kilitli bekler; ayrı kurumlar arasında pratik değildir'],
          [<b key="2">Saga</b>, 'Adımlar sırayla ayrı ayrı commit edilir; hata olursa önceki adımlar telafi edilir', 'Bloklama yok, kurumlar arası çalışır', 'Ara durum görünür; telafi yazmak ve tekrarları yönetmek size kalır'],
          [<b key="3">Outbox</b>, 'Defter değişikliği ve “gönderilecek mesaj” aynı transaction’da yazılır, mesajı ayrı süreç gönderir', 'Commit olup mesajın gitmemesi ya da tersi olmaz', 'En az bir kez teslim: alıcı idempotent olmalı'],
        ]}
      />
      <Sequence
        label="2PC: karar kalıcı yazıldıktan sonra commit; koordinatör çökerse katılımcılar bloklanır"
        actors={[ACT.da, ACT.coord, ACT.dbb]}
        steps={[
          { sep: 'Faz 1 · Hazırlık' },
          { from: 'coord', to: 'da', label: 'PREPARE: borç 500', tone: 'ok' },
          { from: 'coord', to: 'dbb', label: 'PREPARE: alacak 500', tone: 'ok' },
          { from: 'da', to: 'coord', label: 'VOTE YES', res: true, tone: 'ok' },
          { from: 'dbb', to: 'coord', label: 'VOTE YES', res: true, tone: 'ok' },
          { note: 'Karar kalıcı yazılır (commit log)', at: 'coord' },
          { sep: 'Faz 2 · Karar' },
          { from: 'coord', to: 'da', label: 'COMMIT', tone: 'ok' },
          { from: 'coord', to: 'dbb', label: 'COMMIT', tone: 'ok' },
          { note: 'Koordinatör fazlar arasında çökerse, “evet” demiş\nkatılımcılar kilitleri tutup karar bekler', span: ['da', 'dbb'], tone: 'warn' },
        ]}
      />
      <p>
        Bankalar arası ödeme gerçekte <b>saga + outbox</b>’tur: gönderen banka kendi transaction’ında borç ve “gönderilecek pacs.008”i yazar, mesajı ayrı gönderir, alıcıdan <code>pacs.002</code> gelince
        sonucu işler; RJCT gelirse telafi olarak borcu iade eder. ISO 20022 sayfasındaki “Alıcı banka reddeder” senaryosu tam bu telafidir.
      </p>
      <Code label="Outbox: defter ve mesaj aynı transaction'da">{SQL_OUTBOX}</Code>

      <h2 id="base">BASE ve nihai tutarlılık</h2>
      <p>
        Ölçeklenen, birden çok sistemden oluşan yapılar sıklıkla ACID yerine <b>BASE</b> ile tarif edilir: <i>Basically Available</i> (çoğunlukla erişilebilir), <i>Soft state</i> (durum zamanla değişebilir),
        <i> Eventually consistent</i> (sonunda tutarlı). Bu, “tutarsızlık serbest” demek değildir; <b>tutarlılığın hemen değil, belirli bir sürede sağlanması</b> demektir.
      </p>
      <Table
        head={['', 'ACID', 'BASE']}
        rows={[
          ['Tutarlılık', 'Her commit’te anında', 'Bir süre sonra, tarafların mutabakatıyla'],
          ['Ara durum', 'Dışarıdan görünmez', 'Görünür, yönetilir (kuyruk, durum alanı)'],
          ['Hata yönetimi', 'Rollback', 'Telafi, tekrar, mutabakat'],
          ['Tipik yer', 'Tek bankanın core defteri', 'Bankalar arası takas, bildirimler, raporlama'],
        ]}
      />
      <h3>Simülatörde “anında” ve “gün sonu”</h3>
      <p>
        Bankacılıkta para iki farklı hızda akar: müşterinin gördüğü bakiye <b>anında</b> değişir, bankalar arası hesaplaşma ise <b>sonra</b> yapılır. Simülatör bu ikiliği Takas &amp; Mutabakat sekmesinde gösterir.
      </p>
      <Table
        head={['İşlem', 'Müşteri tarafında', 'Bankalar arasında']}
        rows={[
          ['Kendi bankasının ATM’sinden çekim', 'Hesap anında borçlanır', 'Yok: banka içi, takasa girmez'],
          ['Başka banka kartıyla çekim (not-on-us)', 'Kartı çıkaran banka hesabı anında borçlandırır', 'Takas oturumunda: kartı çıkaran banka, ATM sahibine çekilen tutarı ve ücreti öder (BKM satırı)'],
          ['FAST transfer', 'Gönderen anında borçlanır, alıcı anında alacaklanır', 'Takas oturumunda bankaların net pozisyonu (TCMB hesapları) hesaplanır'],
          ['Mesai dışı EFT', 'Gönderen anında borçlanır, alıcıya henüz geçmez', 'Takas oturumunda gönderilir ve alıcıya alacak yazılır'],
          ['Çek yatırma', 'Hesaba hemen geçmez (“takas sonrası”)', 'Takas oturumunda sonuçlanır: karşılıklıysa hesaba geçer (demo kuralı: numarası 9 ile biten karşılıksız)'],
        ]}
      />
      <TryInSim>
        Elif Demir’in Atlas Bank kartıyla (PIN 0000) Demo Bank ATM’sinden 500 TL çekin (ücret 25 TL). Takas &amp; Mutabakat sekmesinde takas oturumunu çalıştırın: BKM satırında Atlas Bank’ın Demo Bank’a ödediği tutar
        ve bankaların net pozisyonu görünür; pozisyonların toplamı sıfırdır.
      </TryInSim>

      <h2 id="cokme">Her adımda çökerse ne olur?</h2>
      <p>
        Güvenilirlik tasarımı şu soruyla yapılır: “Bu satırdan hemen sonra elektrik giderse para kimde?” Aşağıdaki tablo bir para çekmenin adımlarını sırayla ele alır.
      </p>
      <Table
        head={['#', 'Çökme anı', 'Host defteri', 'Banknot', 'Kurtarma']}
        rows={[
          ['1', 'ATM isteği göndermeden önce', 'Değişmedi', 'Verilmedi', 'Yapılacak bir şey yok'],
          ['2', 'Host commit etmeden önce (WAL’da commit kaydı yok)', 'Açılışta geri alınır: borç yok', 'Verilmedi', 'ATM yanıt alamaz, para vermez, 0400 gönderir. Host’ta asıl işlem olmadığı için iade etmez, “tamam” der'],
          ['3', 'Host commit etti, yanıt gitmeden çöktü ya da yanıt kayboldu', 'Borç var (kalıcı)', 'Verilmedi', 'ATM zaman aşımında 0400 gönderir; host iade eder. Simülatörde “Host yanıtı kaybolur” arızası'],
          ['4', 'ATM yanıtı aldı, dağıtmadan çöktü', 'Borç var', 'Verilmedi', 'ATM açılışta kalıcı günlüğünde tamamlanmamış işlemi görüp 0400 gönderir. Günlük kalıcı değilse gün sonu 95 farkına kalır'],
          ['5', 'Dağıtım sırasında (sıkışma, kısmi dağıtım)', 'Borç var', 'Belirsiz / kısmen', 'Dağıtıcı kaç banknot verdiğini raporlar; verilmeyen kısım için 0400 (gerçek sistemde kısmi iptal olabilir). Simülatörde “Para sıkışması”'],
          ['6', 'Para verildi, fiş basılmadan çöktü', 'Borç var', 'Verildi', 'İşlem tamamdır. Tehlike: ATM yanlışlıkla 0400 gönderirse müşteri parayı da alır, iadeyi de; dağıtımdan sonra durum kalıcı yazılmalıdır'],
          ['7', 'Müşteri parayı almadı, geri çekildi', 'Borç var', 'Geri çekme kutusunda', '0400 (39 = 17). Simülatörde “Para alınmaz” arızası (6 sn sonra)'],
          ['8', '0400 gönderilemedi, ATM çöktü', 'Borç var', 'Verilmedi', 'SAF kalıcı yazıldıysa açılışta gönderilir; yazılmadıysa kayıp: gün sonu farkı ve elle araştırma'],
          ['9', '0420 iade edildi, yanıtı gelmedi, ATM tekrar gönderdi', 'İade var', 'Verilmedi', 'İdempotent iptal: ikinci kopya iade etmez, 00 döner'],
        ]}
      />
      <h3>Son güvenlik ağı: gün sonu mutabakatı</h3>
      <p>
        Yukarıdaki mekanizmalardan biri aksarsa gün sonunda yakalanır. ATM kendi sayaçlarını (<code>0500</code>) bildirir, host kendi imzalı kayıtlarıyla karşılaştırır:
        tutmazsa <code>95</code> döner ve dönem kapanmaz.
      </p>
      <Flow
        items={[
          { title: 'ATM gün sonu sayaçlarını gönderir', tag: '0500', text: 'Dönem boyunca verilen ve alınan tutarlar ile adetler.' },
          { title: 'Host kendi kayıtlarını toplar', tag: 'imzalı defter', text: 'Yalnızca imzası tutan kayıtlar sayılır; iptali yapılmış çekim düşülür.' },
          { decision: true, title: 'Sayaçlar ve defter tutuyor mu?', branches: [{ label: 'Evet', text: '0510 · 39 = 00. Dönem kapanır, sayaçlar sıfırlanır.', tone: 'ok' }, { label: 'Hayır', text: '0510 · 39 = 95. Fark araştırılır: SAF kuyruğu, yanıtı kaybolan çekim, geri çekilen banknot.', tone: 'bad' }] },
          { title: 'Fark giderilir, gün sonu tekrarlanır', text: 'SAF boşaltılır, tutarlılık yeniden sağlanır, dönem kapanır.' },
        ]}
      />

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Her senaryo, ACID güvencelerinden birinin hangi durumda devreye girdiğini ve simülatörde nasıl yeniden üretileceğini anlatır.
        <span className="tr-key ok"> Yeşil</span> oklar normal akış, <span className="tr-key bad">kırmızı</span> oklar hata, <span className="tr-key" style={{ color: 'var(--warn)' }}>turuncu</span> oklar telafidir.
      </p>
      <Tabs
        label="ACID senaryoları"
        tabs={[
          {
            label: '1 · Normal çekim',
            content: (
              <>
                <Sequence
                  label="Başarılı çekim: kontrol, borç, dağıtım"
                  actors={[ACT.atm, ACT.host, ACT.cdm]}
                  steps={[
                    { from: 'atm', to: 'host', label: '0200 · 500 TRY', tone: 'ok' },
                    { note: 'Tutar, bakiye, günlük limit kontrolü\nKaset planı: bu tutar verilebilir mi?', at: 'host' },
                    { note: 'Borç + sayaç + defter kaydı + iptal jetonu\ntek yanıtta', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'atm', label: '0210 · 39 = 00', res: true, tone: 'ok' },
                    { from: 'atm', to: 'cdm', label: 'Banknotları dağıt', tone: 'ok' },
                    { from: 'cdm', to: 'atm', label: 'Müşteri aldı', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Consistency:</b> tutar 10’un katı, bakiye yeterli, günlük limit aşılmıyor ve kasette gerekli banknot var. Biri bile tutmazsa 13, 51, 61 ya da 86 döner ve hiçbir şey değişmez.</>,
                    <><b>Atomicity:</b> host yeni bakiye, kaset durumu, defter kaydı ve iptal jetonunu birlikte üretir.</>,
                    <>Dağıtım host onayından <b>sonra</b> gelir; bu yüzden hata olursa telafi gerekir (senaryo 2).</>,
                    <>Defter kaydı (<code>cash_out</code>) gün sonu ve takasta kullanılır; ATM yanıtı alamasa da host kaydı yazılmıştır.</>,
                  ]}
                />
                <TryInSim>Ayşe Yılmaz’ın kartıyla 500 TL çekin. Olay günlüğünde 0200’ün alan 3 = 010000 ve 0210’un alan 39 = 00 olduğunu, host’un yanıtında onay kodunun (38) geldiğini görün.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Sıkışma: telafi',
            content: (
              <>
                <Sequence
                  label="Banknot sıkışır, host borcu geri alır"
                  actors={[ACT.atm, ACT.host, ACT.cdm]}
                  steps={[
                    { from: 'atm', to: 'host', label: '0200 · 500 TRY', tone: 'ok' },
                    { note: 'Borç COMMIT', at: 'host' },
                    { from: 'host', to: 'atm', label: '0210 · 39 = 00', res: true, tone: 'ok' },
                    { from: 'atm', to: 'cdm', label: 'Banknotları dağıt', tone: 'ok' },
                    { note: 'Taşıma yolunda sıkışma\nBanknotlar red kutusuna alınır', at: 'cdm', tone: 'bad' },
                    { from: 'atm', to: 'host', label: '0400 · 39 = 22', sub: 'cihaz arızası', tone: 'warn' },
                    { note: 'Borç + günlük sayaç geri alınır', at: 'host', tone: 'warn' },
                    { from: 'host', to: 'atm', label: '0410 · 39 = 00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Host onayı verdiği anda <b>commit</b> etmiştir: ATM yanıtı almadan önce de bakiye düşmüştür.</>,
                    <>Dağıtım hatası fiziksel dünyada olduğundan veritabanı rollback’i işe yaramaz; <b>ters kayıt</b> yazılır (0400, neden 22).</>,
                    <>İptal yalnızca bakiyeyi değil <b>günlük çekim sayacını</b> da geri alır; yoksa müşteri hiç para almadan limit hakkından yemiş olurdu.</>,
                    <>Para alınmaz (neden 17) senaryosu aynıdır: banknotlar 6 saniye içinde alınmazsa geri çekilir ve 0400 gider.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Para sıkışması”nı işaretleyip Ayşe ile 500 TL çekin. Sonra “Para alınmaz”ı işaretleyip tekrar çekin ve banknotları almayın: 6 sn sonra geri çekilir. Her iki durumda da bakiye sorgusuyla tutarın iade edildiğini doğrulayın.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Yanıt kayboldu: SAF',
            content: (
              <>
                <Sequence
                  label="Host commit etti, yanıt kayboldu; iptal kuyruğa alınır, sonra idempotent işlenir"
                  actors={[ACT.atm, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'host', label: '0200 · 500 TRY', tone: 'ok' },
                    { note: 'Borç COMMIT', at: 'host' },
                    { from: 'host', to: 'atm', label: '0210 · 39 = 00', lost: true, res: true, tone: 'bad' },
                    { note: 'Sonuç bilinmiyor: para VERİLMEZ', at: 'atm', tone: 'warn' },
                    { from: 'atm', to: 'host', label: '0400 · iptal', lost: true, tone: 'warn' },
                    { note: 'İptal SAF kuyruğuna yazılır', at: 'atm', tone: 'warn' },
                    { sep: 'Hat düzelince' },
                    { from: 'atm', to: 'host', label: '0420 · iptal tekrarı', tone: 'warn' },
                    { note: 'Asıl işlem iade edilmiş mi? Hayır → iade', at: 'host', tone: 'warn' },
                    { from: 'host', to: 'atm', label: '0430 · 39 = 00', res: true, tone: 'ok' },
                    { sep: 'Aynı 0420 bir daha gelirse' },
                    { from: 'atm', to: 'host', label: '0420 (kopya)', tone: 'warn' },
                    { note: 'Zaten iade edilmiş: bir daha iade ETME', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'atm', label: '0430 · 39 = 00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Durability</b> burada sorunun kaynağıdır: host işlemi kalıcı yazdı, ama bunu bilen yalnızca host.</>,
                    <>Belirsizlikte güvenli taraf: ATM para vermez ve iptal ister. Yanlışlıkla iade, yanlışlıkla para dağıtmaktan ucuzdur.</>,
                    <>İptal de kaybolursa <b>SAF</b> (store-and-forward) kuyruğunda bekler ve <code>0420</code> olarak tekrar gönderilir. Bu kuyruk <b>kalıcı</b> olmalıdır.</>,
                    <><b>Idempotentlik</b> ikinci kopyanın iade etmemesini sağlar. Simülatörde bu koruma istemcidedir (kuyruktan çıkarma); yukarıdaki “Simülatörde idempotentlik nerede?” kutusuna bakın.</>,
                    <>Kuyruk boşaltılmadan gün sonu alınırsa ATM sayaçları host kayıtlarıyla tutmaz: <code>95</code>.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Host yanıtı kaybolur”u seçip Ayşe ile 500 TL çekin. Teknisyen sekmesinde bakım moduna alın, SAF kuyruğunu göndermeden Gün sonu (0500) çalıştırın: 95. Sonra kuyruğu gönderin, gün sonunu tekrarlayın: 00 ve bakiye iade edilmiş olur.</TryInSim>
              </>
            ),
          },
          {
            label: '4 · İki ATM, aynı hesap',
            content: (
              <>
                <Sequence
                  label="Çifte harcama: aynı bakiyeden iki çekim"
                  actors={[ACT.atm1, ACT.db, ACT.atm2]}
                  steps={[
                    { sep: 'Koşullu güncelleme ile' },
                    { from: 'atm1', to: 'db', label: 'UPDATE ... WHERE bakiye ≥ 800', tone: 'ok' },
                    { from: 'atm2', to: 'db', label: 'UPDATE ... WHERE bakiye ≥ 800', sub: 'satır kilidinde bekler', tone: 'warn' },
                    { from: 'db', to: 'atm1', label: '1 satır etkilendi', res: true, tone: 'ok' },
                    { note: 'ATM-1: 800 TL verir (bakiye 200)', at: 'atm1', tone: 'ok' },
                    { from: 'db', to: 'atm2', label: '0 satır etkilendi', sub: 'bakiye 200 < 800', res: true, tone: 'bad' },
                    { note: 'ATM-2: 0210 · 39 = 51', at: 'atm2', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>İki ATM de bakiye 1.000 TL iken çekim ister. Kontrol ve yazma <b>tek atomik ifadede</b> olduğu için ikincisi ilkinin sonucunu görür.</>,
                    <>Tek bir <code>SELECT</code> sonra ayrı <code>UPDATE</code> yapılsaydı iki ATM de “yeterli” görür ve para iki kez harcanırdı (laboratuvardaki kilitsiz mod).</>,
                    <>Günlük limit için de aynı yöntem şarttır: sayaç artışı ile limit kontrolü aynı ifadede olmalıdır.</>,
                    <>Simülatör bu yarışı yeniden üretmez (işlemler sırayla, bakiye istemciden gelir). Laboratuvar bölümü modeli gösterir.</>,
                  ]}
                />
              </>
            ),
          },
          {
            label: '5 · Havale ve FAST',
            content: (
              <>
                <Sequence
                  label="Aynı banka: tek transaction. Başka banka: saga ve telafi"
                  actors={[ACT.a, ACT.fast, ACT.b]}
                  steps={[
                    { sep: 'Havale (aynı banka)' },
                    { note: 'BEGIN · borç + alacak + defter · COMMIT\nTek veritabanı: gerçek atomiklik', at: 'a', tone: 'ok' },
                    { sep: 'FAST (başka banka): saga' },
                    { note: 'T1: borç + outbox kaydı COMMIT', at: 'a' },
                    { from: 'a', to: 'fast', label: 'pacs.008', tone: 'ok' },
                    { from: 'fast', to: 'b', label: 'pacs.008', tone: 'ok' },
                    { from: 'b', to: 'fast', label: 'pacs.002 · RJCT (AC04)', res: true, tone: 'bad' },
                    { from: 'fast', to: 'a', label: 'pacs.002 · RJCT', res: true, tone: 'bad' },
                    { note: 'C1: telafi, borç müşteriye iade', at: 'a', tone: 'warn' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Havale</b>: iki hesap aynı bankada olduğundan core banking içinde bir transaction ile virman yapılır; bankalar arası mesaj çıkmaz. Simülatör bunu “anında” gösterir.</>,
                    <><b>FAST</b>: iki ayrı kurum olduğundan tek transaction yoktur. Borç yazılır, mesaj gönderilir, sonuç beklenir; red gelirse telafi edilir.</>,
                    <>Outbox sayesinde borç yazılıp mesaj gönderilmemiş (ya da tersi) bir ara durum kalıcı olmaz.</>,
                    <>Simülatörde transferin borcu host’ta, alıcının alacağı ise istemcide ayrı adımlarla yazılır (alıcı ledger’ı istemcide); alıcı bankanın reddi simülatörde tetiklenemez çünkü alıcı hesap transferden önce sorgulanır.</>,
                  ]}
                />
                <TryInSim>Ayşe Yılmaz’ın kartıyla Mehmet Kaya’nın IBAN’ına (Demo Bank, havale, 0 TL ücret) ve ayrıca Elif Demir’in IBAN’ına (Atlas Bank, FAST, 5 TL ücret) birer transfer yapın. İkisinde de alıcının bakiyesi anında artar; Takas &amp; Mutabakat sekmesinde yalnızca FAST kaydının bankalar arası takasa girdiğini görün.</TryInSim>
              </>
            ),
          },
        ]}
      />

      <h2 id="pratik">Gerçek hayat notları</h2>
      <ul>
        <li>
          <b>Önce basit çözüm:</b> koşullu <code>UPDATE ... WHERE balance &gt;= :tutar</code> çoğu yarışı kapatır; karmaşık kilit stratejisinden önce bunu deneyin.
        </li>
        <li>
          <b>Transaction’ı kısa tutun:</b> ağ çağrısını (host, ödeme sistemi, ATM) transaction’ın içinde bekletmeyin; kilit uzar, sistem tıkanır. Dış çağrı için saga ve outbox kullanın.
        </li>
        <li>
          <b>Belirsizliği durum olarak modelleyin:</b> “bilinmiyor” (PDNG, zaman aşımı) ayrı bir durumdur; onay ya da red gibi davranmayın, araştırma ve mutabakatla çözün.
        </li>
        <li>
          <b>Tutarı tamsayı tutun:</b> para hesaplarında kayan noktalı sayı kullanmayın; kuruşu tamsayı ya da sabit ondalıklı tipte saklayın.
        </li>
        <li>
          <b>Her şey için mutabakat:</b> en iyi tasarım bile bir gün aksar. Gün sonu mutabakatı, atomiklik ve idempotentlik yetmediğinde son savunma hattıdır.
        </li>
      </ul>

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['Atomicity', 'Ya hep ya hiç. Veritabanında rollback, dış dünyayla (banknot) telafi (0400) ile sağlanır'],
          ['Consistency', 'Değişmezler (bakiye, limit, sayaç = defter) işlem sonrası da geçerlidir; kısıtları siz tanımlarsınız'],
          ['Isolation', 'Eşzamanlı işlemler birbirini ezmesin: koşullu UPDATE, SELECT FOR UPDATE, version sütunu'],
          ['Durability', 'Commit cevabından sonra çökme olsa da kayıt durur: WAL, fsync, replikasyon'],
          ['Idempotentlik', 'Aynı isteğin tekrarı ikinci kez etki etmez (0420, UETR, Idempotency-Key)'],
          ['2PC / saga / outbox', 'Dağıtık işlem seçenekleri: bloklayan atomiklik, telafili adımlar, transaction’la birlikte yazılan mesaj'],
          ['BASE', 'Tutarlılığın hemen değil, belirli sürede sağlanması: anında bakiye, gün sonu takas'],
          ['Gün sonu mutabakatı', 'Hepsi aksarsa son savunma: ATM sayaçları ile host defteri tutmuyorsa 95'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/iso20022">ISO 20022: bankalar arası transferin mesaj dili →</a>
      </p>
    </>
  )
}
