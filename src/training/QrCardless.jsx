import { useState } from 'react'
import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

const ACT = {
  mobile: { id: 'mobile', label: 'Mobil Uygulama', sub: 'Müşterinin telefonu' },
  atm: { id: 'atm', label: 'ATM', sub: 'Terminal' },
  bank: { id: 'bank', label: 'Banka', sub: 'Switch + InterAPI + QR servisi' },
  core: { id: 'core', label: 'Core Banking', sub: 'Hesap / limit' },
}

// ---------------------------------------------------------------- etkileşimli: QR içeriği çözücü
const SAMPLE = 'DEMOBANK://atm-qr?t=ATM00684&r=9F3A21C7'
const TERMINALS = { ATM00684: 'Demo Bank', ATM77120: 'Atlas Bank' }

function QrLab() {
  const [text, setText] = useState(SAMPLE)
  let url = null
  try {
    url = new URL(text.trim())
  } catch {
    url = null
  }
  const t = url?.searchParams.get('t') ?? ''
  const r = url?.searchParams.get('r') ?? ''
  const checks = [
    [!!url && url.protocol === 'demobank:', 'Şema DEMOBANK:// (uygulama yalnızca kendi şemasını işler)'],
    [!!url && url.hostname === 'atm-qr', 'Hedef atm-qr: kartsız ATM oturumu'],
    [t in TERMINALS, t ? `Terminal ${t}${TERMINALS[t] ? ' → ' + TERMINALS[t] + ' ATM’si' : ' tanınmıyor'}` : 'Terminal (t) yok'],
    [/^[0-9A-F]{8}$/.test(r), r ? `Referans ${r} (8 onaltılık hane)` : 'Referans (r) yok'],
  ]
  const ok = checks.every(([v]) => v)
  return (
    <div className="tr-lab">
      <div className="tr-lab-row">
        <label>
          QR içeriği
          <input className="tr-input mono wide" style={{ width: 'min(480px, 100%)' }} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        </label>
        <div className="tr-chips" aria-label="Hazır örnekler">
          {[
            ['Geçerli', SAMPLE],
            ['Atlas ATM', 'DEMOBANK://atm-qr?t=ATM77120&r=01B4C9D2'],
            ['Hatalı ref', 'DEMOBANK://atm-qr?t=ATM00684&r=XYZ'],
            ['Başka şema', 'http://evil.example/pay?amount=500'],
          ].map(([label, v]) => (
            <button key={label} type="button" className={`tr-chip ${v === text ? 'on' : ''}`} onClick={() => setText(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="tr-checks" style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
        {checks.map(([v, label]) => (
          <li key={label} style={{ color: v ? 'var(--ink)' : 'var(--bad)' }}>
            <b aria-hidden="true">{v ? '✓' : '✕'}</b> <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{v ? 'Geçti: ' : 'Kaldı: '}</span>
            {label}
          </li>
        ))}
      </ul>
      <div className={`tr-verdict ${ok ? 'ok' : 'bad'}`} role="status">
        <span>Uygulamanın kararı</span>
        <b>{ok ? 'Oturum için banka onayına devam et' : 'Reddet: bu bir ATM QR’ı değil'}</b>
      </div>
      <p className="tr-muted">
        Bu yalnızca biçim kontrolüdür. Asıl doğrulama bankadadır: banka <code>r</code> referansını kendi imzalı oturumuyla eşleştirir; süresi geçmiş ya da
        başka terminale ait oturumu kabul etmez.
      </p>
    </div>
  )
}

export default function QrCardless() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Kartsız işlem"
        title="ATM’de QR ile mobilden para çekme ve yatırma"
        lead="Kart takmadan, telefondaki bankacılık uygulamasıyla ATM’den para çekmek ya da yatırmak. ATM ekranına bir QR kodu çıkar, müşteri telefonuyla okutup biyometrikle onaylar, ATM de işlemi tamamlar. Simülatördeki “Kartsız İşlem · QR ile” düğmesinin arkasındaki akış budur."
      />

      <h2 id="giris">Kartsız işlem nedir, neden var?</h2>
      <p>
        Kartsız işlemde müşteri kimliğini kartla değil <b>telefonuyla</b> kanıtlar: telefon bankanın uygulamasına bağlıdır (cihaz bağlama) ve işlem
        biyometrik ya da PIN ile onaylanır. ATM’nin görevi yalnızca kendisini bankaya tanıtmak, onayı almak ve parayı vermek ya da almaktır.
      </p>
      <Table
        head={['Fayda', 'Neden?']}
        rows={[
          ['Skimming ve kart kopyalama azalır', 'Kart ve PIN ATM’ye hiç girmez; kopyalanacak manyetik şerit ya da çip yoktur.'],
          ['Kart unutma/kaybetme sorunu biter', 'Kart-önce-para sırası gerekmez; “kartı unutup parayı aldı” riski yoktur.'],
          ['PIN omuz sörfü zayıflar', 'PIN ATM tuş takımına girilmez; onay telefonda biyometrikle verilir.'],
          ['Daha zengin onay', 'Banka telefonun cihaz bilgisini, konumunu ve davranışını da risk skoruna katabilir.'],
        ]}
      />
      <p>Piyasada yaygın üç biçim vardır; bu sayfa ilkini (ATM’nin QR gösterdiği model) anlatır:</p>
      <ul>
        <li>
          <b>ATM QR gösterir, telefon okur</b> (simülatör): QR ATM’ye ve o işleme özgüdür, ömrü kısadır.
        </li>
        <li>
          <b>Telefon QR/kod gösterir, ATM okur:</b> ATM’nin kamerası ya da tarayıcısı gerekir; onay önceden telefonda hazırlanır.
        </li>
        <li>
          <b>Tek kullanımlık kod ya da NFC:</b> telefonda üretilen kod ATM tuş takımına girilir veya telefon NFC ile okutulur.
        </li>
      </ul>
      <Callout tone="warn" title="Kapsam">
        Sayfa simülatörün davranışını ve sektörde genel kabul gören tasarım ilkelerini anlatır. Belirli bir bankanın ya da ATM üreticisinin kartsız işlem
        ürünü kendi protokolünü kullanır; ayrıntı için kurumun şartnamesine bakın.
      </Callout>

      <h2 id="mimari">Mimari: kim ne yapar?</h2>
      <Table
        head={['Taraf', 'Rolü', 'Simülatörde']}
        rows={[
          [<b key="1">Mobil uygulama</b>, 'QR’ı okur, işlem türünü ve tutarı alır, kullanıcıyı biyometrikle doğrular, onayı banka API’sine gönderir.', 'Telefon paneli (yalnızca Demo Bank müşterileri)'],
          [<b key="2">ATM</b>, 'QR oturumu ister ve ekranda gösterir, onayı bekler, parayı verir ya da banknotları sayar.', 'Ekran + kartsız akış'],
          [<b key="3">QR servisi</b>, 'İmzalı, kısa ömürlü, terminale bağlı bir oturum üretir; sonra onayla eşleştirir.', <>InterAPI içinde <Sim>sim</Sim></>],
          [<b key="4">Mobil API</b>, 'Cihaz bağlama ve biyometrik onayı doğrular.', 'Mobil → InterAPI adımı'],
          [<b key="5">Fraud + Core</b>, 'Risk skoru; bakiye, limit ve hesap kontrolü; provizyon ve borç kaydı.', 'Fraud ve Core Banking düğümleri'],
        ]}
      />
      <Flow
        items={[
          { title: 'Oturum aç', tag: 'ATM → banka', text: 'ATM “kartsız işlem başlatıyorum” der; banka bu terminale özgü, imzalı ve kısa ömürlü bir QR oturumu üretir.' },
          { title: 'QR göster', tag: 'ATM ekranı', text: 'ATM oturum referansını QR olarak gösterir. QR’da kişisel veri ya da tutar bulunmaz.' },
          { title: 'Okut ve onayla', tag: 'mobil → banka', text: 'Müşteri okutur, çek/yatır ve (çekimde) tutarı seçer, biyometrikle onaylar. Banka cihazı, riski ve bakiyeyi kontrol eder.' },
          { title: 'Onayı al', tag: 'ATM → banka', text: 'ATM onayın verildiğini ve işlem bilgilerini bankadan öğrenir. Tutarı müşteriden değil bankadan alır.' },
          { title: 'Gerçekleştir', tag: '0200 / 0210', text: 'ATM finansal isteği (çekim ya da yatırma) gönderir; host hesabı günceller. Çekimde banknotlar doğrudan sunulur.' },
        ]}
      />

      <h2 id="akis">Uçtan uca akış: para çekme</h2>
      <Sequence
        label="500 TL kartsız para çekme: QR oturumundan banknotlara"
        actors={[ACT.mobile, ACT.atm, ACT.bank, ACT.core]}
        steps={[
          { sep: '1 · QR oturumu' },
          { from: 'atm', to: 'bank', label: 'Kartsız işlem isteği', sub: 'NDC · TLS', tone: 'ok' },
          { from: 'bank', to: 'atm', label: 'QR oturumu', sub: 'ref + imza · 120 sn', res: true, tone: 'ok' },
          { note: 'Ekranda QR:\nDEMOBANK://atm-qr?t=ATM00684&r=…', at: 'atm' },
          { sep: '2 · Mobil onay' },
          { from: 'mobile', to: 'mobile', label: 'QR’ı okut' },
          { from: 'mobile', to: 'bank', label: 'Onay: çek 500 TL', sub: 'QR oturumu + cihaz bağı', tone: 'ok' },
          { note: 'Biyometrik · cihaz bağlama\nFraud skoru', at: 'bank' },
          { from: 'bank', to: 'core', label: 'Bakiye/limit ön kontrolü', tone: 'ok' },
          { from: 'core', to: 'bank', label: 'Yeterli', res: true, tone: 'ok' },
          { from: 'bank', to: 'mobile', label: 'Mobil onay verildi', res: true, tone: 'ok' },
          { sep: '3 · ATM tamamlar' },
          { from: 'atm', to: 'bank', label: 'Onay durumu?', sub: 'gerçekte periyodik sorgu', tone: 'ok' },
          { from: 'bank', to: 'atm', label: 'Onaylandı · 500 TL', res: true, tone: 'ok' },
          { from: 'atm', to: 'bank', label: '0200 · 3=010000 · 4=500,00', sub: '48 = Kartsız işlem · QR ref', tone: 'ok' },
          { from: 'bank', to: 'core', label: 'Provizyon + borç kaydı', tone: 'ok' },
          { from: 'core', to: 'bank', label: 'Onay', res: true, tone: 'ok' },
          { from: 'bank', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
          { note: 'Banknotlar doğrudan sunulur\n(kart-önce-para adımı yok)', at: 'atm', tone: 'ok' },
        ]}
      />
      <Notes
        items={[
          <>QR <b>ATM’ye ve o ana özgüdür</b>: banka her oturum için yeni bir referans üretir ve imzalar; QR’ın fotoğrafı sonradan işe yaramaz.</>,
          <><b>Tutar telefondan gelir.</b> ATM tutarı kendisi belirleyemez; böylece ATM yazılımı ya da ekranı ele geçirilse bile onaylanandan fazlası çekilemez.</>,
          <>Onay ile asıl işlem <b>ayrı adımlardır</b>: mobil onay yalnızca “bu müşteri bu işlemi yapabilir” der; para hareketi ATM’nin 0200’üyle olur ve hesap o anda borçlandırılır.</>,
          <>Simülatörde onay, host durumsuz olduğu için imzalı bir token olarak istemcide taşınır. Gerçek sistemde onay bankada saklanır ve ATM durumu sorgular.</>,
        ]}
      />
      <TryInSim>
        Ana ekranda <b>Kartsız İşlem · QR ile</b>’ye basın. Telefon panelinde “QR Kodu Okut”, sonra Para Çek, 500 TL, “Biyometrik Onayla” deyin. ATM parayı doğrudan sunar;
        Olay günlüğünde QR oturumu, mobil onay ve 0200 satırlarını izleyin.
      </TryInSim>

      <h2 id="qr">QR’ın içi ve güvenliği</h2>
      <p>
        QR yalnızca bir <b>işaretçidir</b>: hangi ATM’de hangi oturumun açıldığını söyler. Simülatörde içerik şuna benzer; aşağıdaki çözücüyle deneyebilirsiniz.
      </p>
      <QrLab />
      <h3>Güvenlik tasarımı</h3>
      <Table
        head={['Tehdit', 'Önlem']}
        rows={[
          [<b key="1">QR’ın fotoğrafını çekip sonra kullanmak</b>, 'Kısa ömür (simülatörde 120 sn), tek kullanımlık oturum, ATM yeni işlemde yeni QR üretir.'],
          [<b key="2">ATM üzerine sahte QR yapıştırmak</b>, 'Gerçek ATM QR’ı ekranda dinamik üretir; yapıştırılmış statik QR bankanın imzalı oturumuyla eşleşmez. Müşteriyi uygulamanın ATM’yi doğrulamasıyla (terminal adı ve ref gösterimi) korumak da gerekir.'],
          [<b key="3">Telefonun çalınması</b>, 'Cihaz bağlama + biyometrik/PIN; işlem limitleri; uzaktan oturum kapatma.'],
          [<b key="4">Tutarın/işlemin ATM’de değiştirilmesi</b>, 'Tutar ve işlem türü imzalı onayın içindedir; ATM yalnızca onaylananı uygulayabilir. Onay işlem türü ve terminale bağlıdır.'],
          [<b key="5">Onayın başka ATM’de kullanılması</b>, 'Onay terminal ve işlem türüyle eşleştirilir; eşleşmezse reddedilir.'],
          [<b key="6">Omuz sörfü</b>, 'PIN ATM’ye girilmez; ekranda gösterilen tek şey ref’tir.'],
          [<b key="7">Tekrar oynatma (replay)</b>, 'İmza + süre + tek kullanımlık eşleştirme; onay kullanıldıktan sonra geçersizdir (üretim sisteminde bankada tüketilir).'],
        ]}
      />
      <Callout title="Simülatörde gerçekten yapılan doğrulamalar">
        Host QR oturumunu HMAC ile imzalar ve süresine bakar (süre bittiyse yanıt kodu <b>33</b>). Onay işlem türü ve terminalle eşleşmiyorsa <b>05</b> döner.
        Müşteri ATM’nin bankasına ait değilse <b>57</b> verilir. Tek kullanımlık tüketim ve cihaz bağlama simülatörde modellenmemiştir.
      </Callout>

      <h2 id="yatirma">Para yatırma</h2>
      <p>
        Yatırmada <b>tutar onay anında bilinmez</b>: müşteri önce işlemi onaylar, banknotlar ATM’de <i>sayılır</i> ve sayılan tutar hesaba geçer. Bu yüzden mobil onay
        tutar içermez (simülatörde 0 olarak imzalanır).
      </p>
      <Sequence
        label="Kartsız para yatırma"
        actors={[ACT.mobile, ACT.atm, ACT.bank, ACT.core]}
        steps={[
          { from: 'atm', to: 'bank', label: 'QR oturumu iste', tone: 'ok' },
          { from: 'bank', to: 'atm', label: 'QR oturumu', res: true, tone: 'ok' },
          { from: 'mobile', to: 'bank', label: 'Onay: para yatır', sub: 'tutar yok (ATM sayacak)', tone: 'ok' },
          { from: 'bank', to: 'mobile', label: 'Mobil onay verildi', res: true, tone: 'ok' },
          { sep: 'ATM banknotları alır' },
          { note: 'CIM: banknot haznesi açılır\nBanknot tanıma: geçerli / şüpheli', at: 'atm' },
          { note: 'Müşteri sayılan tutarı onaylar', at: 'atm', tone: 'ok' },
          { from: 'atm', to: 'bank', label: '0200 · 3=21xx00 · tutar', sub: 'sayılan tutar · 48 = QR ref', tone: 'ok' },
          { from: 'bank', to: 'core', label: 'Alacak kaydı', tone: 'ok' },
          { from: 'bank', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
          { note: 'Şüpheli banknotlar incelemeye\nalınır, tutara katılmaz', at: 'atm', tone: 'warn' },
        ]}
      />
      <Notes
        items={[
          <>İşlem kodu <b>21</b> ile başlar (mevduat). Hesap türü haneleri, hesabın vadesiz mi kredi kartı mı olduğunu gösterir.</>,
          <><b>Şüpheli banknot</b> hesaba geçmez ve ATM tarafından alıkonur. Müşteri sayılan tutarı onaylamadan işlem hesaba yansımaz.</>,
          <>Geçerli banknotlar <b>recycler</b> kasetlerine girer ve sonraki çekimlerde tekrar dağıtılabilir. Simülatörde kasetli kupürler sayaçlara yansır (Teknisyen sekmesi).</>,
          <>ATM banknotları aldıktan sonra host’a ulaşamazsa para ATM’de, hesap ise güncellenmemiş kalır: bu fark gün sonu mutabakatında yakalanır ve manuel incelemeye gider.</>,
        ]}
      />
      <TryInSim>
        QR akışında telefonda <b>Para Yatır</b>’ı seçip onaylayın. ATM’de birkaç banknot ekleyin, “şüpheli banknot” kutusunu işaretleyin, onaylayın.
        Hesap bakiyesinin yalnızca geçerli tutar kadar arttığını Hesaplar panelinde görün.
      </TryInSim>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <Tabs
        label="Kartsız işlem senaryoları"
        tabs={[
          {
            label: '1 · QR süresi doldu',
            content: (
              <>
                <Sequence
                  label="Müşteri QR’ı geç okutup onay verir"
                  actors={[ACT.mobile, ACT.atm, ACT.bank]}
                  steps={[
                    { from: 'atm', to: 'bank', label: 'QR oturumu iste', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: 'QR · 120 sn', res: true, tone: 'ok' },
                    { note: '120 sn geçti\nATM ekranı: “QR kodun süresi doldu”', at: 'atm', tone: 'warn' },
                    { from: 'mobile', to: 'bank', label: 'Onay isteği', tone: 'ok' },
                    { from: 'bank', to: 'mobile', label: 'Red · kod 33', res: true, tone: 'bad' },
                    { note: 'Telefon başa döner\nATM’de “Yeni QR” seçilir', at: 'mobile' },
                  ]}
                />
                <Notes
                  items={[
                    <>Süre sınırı, QR’ın ekranda saatlerce kalıp kötüye kullanılmasını engeller.</>,
                    <>Müşteri için çözüm basittir: ATM’de yeni QR üretilir, eski oturum geçersiz kalır.</>,
                  ]}
                />
                <TryInSim>QR’ı ekrana çıkarın, 2 dakika bekleyin, sonra telefonda onaylamayı deneyin; “Yeni QR” düğmesini kullanın.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Başka banka müşterisi',
            content: (
              <>
                <Sequence
                  label="Demo Bank müşterisi Atlas Bank ATM’sinde QR ile işlem dener"
                  actors={[ACT.mobile, ACT.atm, ACT.bank]}
                  steps={[
                    { note: 'Terminal: ATM77120 (Atlas Bank)', at: 'atm' },
                    { from: 'atm', to: 'bank', label: 'QR oturumu iste', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: 'QR oturumu', res: true, tone: 'ok' },
                    { from: 'mobile', to: 'bank', label: 'Onay isteği', tone: 'ok' },
                    { note: 'Müşteri ATM’nin bankasına ait değil', at: 'bank', tone: 'bad' },
                    { from: 'bank', to: 'mobile', label: 'Red · kod 57', sub: 'yalnızca Atlas Bank müşterileri', res: true, tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Kartsız işlem, ATM’yi işleten bankanın <b>kendi mobil müşterileriyle</b> sınırlıdır: telefon uygulaması yalnızca kendi bankasının API’sine bağlıdır.</>,
                    <>Kartlı işlemde BKM üzerinden başka banka ATM’sine gidilebilir; kartsız işlemde bu yol yoktur (bankalar arası kartsız standartlar farklı konudur).</>,
                  ]}
                />
                <TryInSim>Sağ üstten terminali Atlas Bank · ATM77120 seçin, QR başlatıp telefondan onaylamayı deneyin.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Yetersiz bakiye',
            content: (
              <>
                <Sequence
                  label="Mehmet Kaya 3.000 TL çekmek ister (bakiye 850 TL)"
                  actors={[ACT.mobile, ACT.atm, ACT.bank, ACT.core]}
                  steps={[
                    { from: 'mobile', to: 'bank', label: 'Onay: çek 3.000 TL', tone: 'ok' },
                    { from: 'bank', to: 'core', label: 'Bakiye/limit ön kontrolü', tone: 'ok' },
                    { from: 'core', to: 'bank', label: 'Yetersiz', res: true, tone: 'bad' },
                    { from: 'bank', to: 'mobile', label: 'Red · kod 51', res: true, tone: 'bad' },
                    { note: 'ATM’ye hiç haber gitmez,\nonay verilmez, para verilmez', at: 'atm' },
                  ]}
                />
                <Notes
                  items={[
                    <>Bakiye ve limit kontrolü <b>mobil onay sırasında</b> yapılır. Müşteri red mesajını telefonda görür ve tutarı değiştirip tekrar dener.</>,
                    <>Günlük limit aşıldığında aynı yoldan <b>61</b> döner.</>,
                    <>ATM yine de 0200’de bakiyeye bakar; onay ile işlem arasında bakiye değişmiş olabilir (ör. başka işlem yapılmış).</>,
                  ]}
                />
                <TryInSim>Mehmet Kaya’yı telefonda seçip 3.000 TL için onaylayın; mesajın telefonda göründüğüne dikkat edin.</TryInSim>
              </>
            ),
          },
          {
            label: '4 · Yanıt kaybolur',
            content: (
              <>
                <Sequence
                  label="0200 onaylandı ama 0210 ATM’ye ulaşmadı"
                  actors={[ACT.atm, ACT.bank, ACT.core]}
                  steps={[
                    { from: 'atm', to: 'bank', label: '0200 · 500 TL · QR ref', tone: 'ok' },
                    { from: 'bank', to: 'core', label: 'Borç kaydı', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: '0210 · 39=00', lost: true, res: true, tone: 'bad' },
                    { note: 'Zaman aşımı: sonuç bilinmiyor\nPara VERİLMEZ', at: 'atm', tone: 'warn' },
                    { from: 'atm', to: 'bank', label: '0400 iptal', lost: true, tone: 'warn' },
                    { note: 'İptal SAF kuyruğunda', at: 'atm', tone: 'warn' },
                    { sep: 'Hat düzelince' },
                    { from: 'atm', to: 'bank', label: '0420 iptal tekrarı', tone: 'warn' },
                    { from: 'bank', to: 'core', label: 'Borcu iade et', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: '0430 · 39=00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Kartsız işlemde de kural aynıdır: <b>emin değilsen para verme, iptal et</b>. Fark, müşterinin kartı olmadığı için bilgilendirmenin ekranda ve mobil bildirimle yapılmasıdır.</>,
                    <>İptal mesajı <b>QR referansını</b> da taşır; denetimde işlem, onay ve iptal birbirine bağlanır.</>,
                    <>Ayrıntı için <a href="#/egitim/iso8583">ISO 8583 · zaman aşımı ve iptal</a> senaryosuna bakın.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Host yanıtı kaybolur”u seçin, QR ile para çekin; Teknisyen sekmesinde SAF kuyruğunu gönderin.</TryInSim>
              </>
            ),
          },
          {
            label: '5 · Para alınmadı',
            content: (
              <>
                <Sequence
                  label="Banknotlar sunuldu ama müşteri almadı"
                  actors={[ACT.atm, ACT.bank, ACT.core]}
                  steps={[
                    { from: 'atm', to: 'bank', label: '0200 · 500 TL', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { note: 'Shutter açıldı, banknotlar sunuldu\nMüşteri 6 sn içinde almadı', at: 'atm', tone: 'warn' },
                    { note: 'CDM RETRACT: banknotlar\ngeri çekme kutusuna alınır', at: 'atm', tone: 'warn' },
                    { from: 'atm', to: 'bank', label: '0400 · neden 17', sub: 'müşteri almadı', tone: 'warn' },
                    { from: 'bank', to: 'core', label: 'Borcu iade et', tone: 'ok' },
                    { from: 'bank', to: 'atm', label: '0410 · 39=00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Kartlı işlemde müşteri kartını alır almaz parayı da alır; kartsızda para doğrudan sunulduğu için <b>“terk edilmiş para”</b> riski daha yüksektir (telefona bakan müşteri parayı unutabilir).</>,
                    <>ATM geri çektiği banknotları ayrı bir kutuya koyar (<b>retract bin</b>); sayaçlara ve gün sonu denkleştirmesine girer.</>,
                    <>Banknotlar geri çekilince host’a iptal gider ve tutar hesaba iade edilir.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Para alınmaz”ı seçip QR ile çekim yapın; 6 saniye sonra banknotların geri çekildiğini ve iptalin gittiğini izleyin.</TryInSim>
              </>
            ),
          },
        ]}
      />

      <h2 id="gercek">Simülatör ve gerçek sistem</h2>
      <Table
        head={['Konu', 'Simülatör', 'Gerçek sistem']}
        rows={[
          ['Onayın saklanması', 'İmzalı token istemcide taşınır (host durumsuz)', 'Onay bankanın veritabanında; ATM durumu sorgular (polling) ya da bildirim alır'],
          ['QR kullanımı', 'Süre ve imza kontrolü', 'Ek olarak tek kullanımlık tüketim, oran sınırı, ATM–oturum eşleştirme'],
          ['Cihaz doğrulama', 'Yalnızca anlatımda (“cihaz bağlama + biyometrik”)', 'Uygulama imzası, cihaz bağı, jailbreak/root tespiti, konum ve davranış sinyalleri'],
          ['Hesap bulma', 'Host onaydaki karta bakar', 'Host oturumdan müşteriyi, müşteriden hesabı bulur; ATM’ye PAN gitmez'],
          ['ISO 8583 alanları', 'Alan 2’de maskeli PAN, alan 48’de QR ref', 'Kuruma özgü: kartsız işlem için ayrı alan/işlem kodu ya da tokenlaştırılmış kimlik; ağ şartnamesine göre'],
          ['Limitler', 'Günlük çekim limiti', 'Kartsız işlem için genelde ayrı, daha düşük tutar ve adet limitleri'],
          ['Başka banka', 'Yalnızca Demo Bank müşterileri', 'Bankalar arası kartsız standartlar ve anlaşmalar gerekir'],
        ]}
      />

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['QR oturumu', 'Banka tarafından üretilen, imzalı, kısa ömürlü ve terminale bağlı işlem işaretçisi'],
          ['Mobil onay', 'Biyometrik ve cihaz bağlama ile verilen, işlem türü ve (çekimde) tutarı içeren imzalı onay'],
          ['Tutarın kaynağı', 'Çekimde mobil onay, yatırmada ATM’nin saydığı banknotlar'],
          ['Kart-önce-para', 'Kartsızda gerekmez: banknotlar doğrudan sunulur'],
          ['0200 / 0210', 'Asıl para hareketi: işlem kodu 01 (çekim) ya da 21 (yatırma), alan 48’de QR referansı'],
          ['Hata yönetimi', 'Kartlıdaki gibi: emin değilsen para verme, 0400/0420 ile iptal et'],
          ['Yanıt kodları', '33 QR süresi doldu · 57 başka banka · 51 yetersiz bakiye · 61 günlük limit · 05 eşleşmeyen onay'],
        ]}
      />
      <p className="tr-next">
        İlgili konular: <a href="#/egitim/iso8583">ISO 8583</a> · <a href="#/egitim/xfs">XFS (CDM, CIM komutları)</a>
      </p>
    </>
  )
}
