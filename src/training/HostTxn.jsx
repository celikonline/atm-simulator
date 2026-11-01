import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- ortak oyuncular
const ACT = {
  atm: { id: 'atm', label: 'ATM', sub: 'Terminal' },
  sw: { id: 'sw', label: 'ATM Switch', sub: 'Acquirer tarafı' },
  host: { id: 'host', label: 'Yetki Host’u', sub: 'InterAPI' },
  core: { id: 'core', label: 'Core Banking', sub: 'Hesap / defter' },
  api: { id: 'api', label: 'Yetki Host’u', sub: 'InterAPI' },
  hsm: { id: 'hsm', label: 'HSM', sub: 'PIN doğrulama' },
  fraud: { id: 'fraud', label: 'Fraud', sub: 'Risk skoru' },
  bkm: { id: 'bkm', label: 'BKM', sub: 'Ulusal ağ' },
  iss: { id: 'iss', label: 'Atlas Bank', sub: 'Kartı çıkaran (issuer)' },
}

export default function HostTxn() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Sistem mimarisi"
        title="ATM host ve transaction yönetimi"
        lead="ATM “onay” dediğinde para hesaptan gerçekten düşmüş olmalı; ATM para vermediyse de geri gelmiş olmalı. Bu sayfa, switch’in karşı ucundaki host tarafının işlemi nasıl yürüttüğünü, kaydettiğini, geri aldığını ve gün sonunda nasıl tuttuğunu anlatır."
      />

      <h2 id="giris">Host ne demek?</h2>
      <p>
        “ATM host’u” gündelik dilde iki farklı şeye denir ve karışmaması gerekir. Bu sayfada “host” derken ikincisini, yani <b>yetkilendirme (authorization)
        host’unu</b> kastediyoruz.
      </p>
      <ul>
        <li>
          <b>ATM sürücü / yönetim uygulaması (ATM driving application):</b> terminali yönlendiren taraf. Bazı mimarilerde ekran akışını, durum tablolarını ve
          nakit dağıtma komutlarını host’tan terminale bu uygulama taşır. Terminalin sağlığını (cihaz durumu, kaset seviyeleri) da izler.
        </li>
        <li>
          <b>Yetki host’u (authorization host):</b> işlemin <i>yapılıp yapılamayacağına</i> karar veren ve hesabı güncelleyen taraf: kart durumu, PIN, bakiye,
          limit, risk, ücret. Çoğu zaman core banking’e (hesap defteri) bağlanan bir entegrasyon katmanıdır.
        </li>
      </ul>
      <p>
        Switch tarafı için <a href="#/egitim/switch">Switch uygulaması</a>, mesajların kendisi için <a href="#/egitim/iso8583">ISO 8583</a> sayfasına bakın.
      </p>
      <Callout title="Simülatörle ilişkisi">
        Simülatörde Python tarafı (<code>api/_host.py</code>) yetki host’unu ve arkasındaki sistemleri (HSM, fraud, core, kart sistemi) tek dosyada
        taklit eder. ATM sürücü uygulaması ise tarayıcıda çalışır: ekranları ve cihaz komutlarını tarayıcı yönetir, host ekran akışını yönetmez. En önemli
        basitleştirme: <b>host durumsuzdur</b> (Vercel fonksiyonu). Hesap bakiyeleri ve kaset durumu tarayıcıda tutulur, her istekle gönderilir; host yalnızca kendi
        imzaladığı kayıtlara güvenir. Gerçek host kendi veritabanında tutar. Sayfadaki <Sim>sim</Sim> işaretleri kodda doğrulanmış davranışlardır.
      </Callout>

      <h2 id="ortam">Host uygulama manzarası</h2>
      <p>Bir ATM işleminin dokunduğu bileşenler ve simülatördeki karşılıkları:</p>
      <Table
        head={['Bileşen', 'Görevi', 'Simülatörde']}
        rows={[
          [<b key="1">ATM yönetim / sürücü uygulaması</b>, 'Terminal ekranları, durum tabloları, nakit dağıtma ve cihaz komutları, terminal durum izleme.', 'Tarayıcıdaki ATM ekranı ve cihaz sürücü mesajları (XFS). Host ekran yönetmez.'],
          [<b key="2">Yetkilendirme (transaction authorization)</b>, 'İşlemi alır, doğrular, kuralları işletir, kararı verir, kaydı yazar.', <>InterAPI (<code>api/_host.py</code>).</>],
          [<b key="3">Kart yönetimi</b>, 'Kart durumu (aktif, kayıp, bloke), son kullanma, PIN deneme sayacı, kart bazlı limitler.', <>Demo kart tablosu <code>CARDS</code>. Kredi kartı için “Kart Sistemi” durağı (limit/borç).</>],
          [<b key="4">Hesap / core banking</b>, 'Hesap bakiyesi, provizyon, borç/alacak, defter.', 'Core Banking durağı. Bakiye istemcide tutulan “ledger”dır.'],
          [<b key="5">Limit ve risk</b>, 'Günlük/işlem limiti, hız kuralları, fraud skoru.', <>Günlük limit 10.000 TL (<code>DAILY_LIMIT</code>); “Risk skoru” durağı karar vermez.</>],
          [<b key="6">HSM / PIN doğrulama</b>, 'PIN’i güvenli donanımda doğrular, anahtar yönetir.', 'HSM durağı. PIN tuzlu hash ile karşılaştırılır (demo).'],
          [<b key="7">Ücret motoru</b>, 'İşlem türü ve kanala göre ücret hesaplar.', <><code>OFF_US_FEES</code>, <code>TRANSFER_FEES</code>.</>],
          [<b key="8">ATM yönetimi: EJ, nakit tahmini, ikmal</b>, 'Elektronik günlük toplama, kaset seviyelerinden nakit tahmini ve ikmal planı, arıza yönetimi.', 'Servis → EJ sekmesi, Teknisyen sekmesi (kaset doldurma, denkleştirme). Nakit tahmini yok.'],
          [<b key="9">Mutabakat ve takas</b>, 'Gün sonu karşılaştırma ve bankalar arası netleştirme.', 'Gün sonu (0500) ve Takas & Mutabakat sekmesi.'],
          [<b key="10">İzleme</b>, 'Teknik ve iş metrikleri, alarm.', 'Mesaj akışı paneli (hop süreleri), Olay günlüğü.'],
        ]}
      />
      <p>Bir çekim isteğinin yetki host’u içinde izlediği yol (simülatörün gerçek trace’i):</p>
      <Sequence
        label="Yetki host’unun çekim isteğini işlemesi (hop süreleri demo değerlerdir)"
        actors={[ACT.sw, ACT.api, ACT.hsm, ACT.fraud, ACT.core]}
        steps={[
          { from: 'sw', to: 'api', label: '0200 · REST/JSON, mTLS', sub: '8–20 ms', tone: 'ok' },
          { note: 'Token, tutar, bakiye, günlük limit\nve kupür planı kontrol edilir', at: 'api' },
          { from: 'api', to: 'fraud', label: 'Risk skoru', sub: '5–15 ms', tone: 'ok' },
          { from: 'fraud', to: 'api', label: 'Skor', res: true, tone: 'ok' },
          { from: 'api', to: 'core', label: 'Provizyon + borç kaydı', sub: '20–45 ms', tone: 'ok' },
          { from: 'core', to: 'api', label: 'Onay', res: true, tone: 'ok' },
          { note: 'İmzalı host kaydı (cash_out)\nOnay kodu, reversal_token üretilir', at: 'api' },
          { from: 'api', to: 'sw', label: '0210 · 39=00 · 38=onay kodu', res: true, tone: 'ok' },
        ]}
      />
      <Callout tone="warn" title="Kontrolün yeri">
        Simülatörde tutar, bakiye ve limit kontrolleri tek Python fonksiyonunda çalışır; PIN doğrulama ayrı çağrıdadır (0100). Gerçek mimaride bu kontrollerin
        yetki katmanında mı yoksa core’da mı yapılacağı kuruma bağlıdır.
      </Callout>
      <TryInSim>Ayşe Yılmaz’ın Visa kartıyla (PIN 1234) ATM00684’te 500 TL çekin. Mesaj akışı panelinde Switch → InterAPI → Fraud → Core Banking duraklarını ve ms değerlerini görün. Olay günlüğünde 0200 satırını açıp alan 3, 4, 11, 41 ve yanıtta 37, 38, 39’a bakın.</TryInSim>

      <h2 id="yasam-dongusu">İşlem yaşam döngüsü</h2>
      <p>
        Host, her işlemi kalıcı bir durum makinesiyle yürütür. Durum, “şimdi ne yapılabilir?” sorusunu cevaplar: iptal edilebilir mi, takasa girebilir mi,
        tekrar gelen istek ne olacak?
      </p>
      <Flow
        items={[
          { title: 'RECEIVED · alındı', tag: 'journal yazılır', text: 'İstek ve kimlikleri (STAN, terminal, tarih) kalıcı yazılır. Para hareketi yok.' },
          { title: 'VALIDATED · doğrulandı', tag: 'token · tutar · kart', text: 'Oturum, kart durumu, biçim, tutar aralığı. Başarısızsa DECLINED.' },
          { decision: true, title: 'Kurallar geçti mi?', branches: [{ label: 'Evet', text: 'AUTHORIZED: provizyon verildi.', tone: 'ok' }, { label: 'Hayır', text: 'DECLINED: bakiye (51), limit (61), PIN (55/75), geçersiz tutar (13). Defter etkisi yok.', tone: 'bad' }] },
          { title: 'POSTED · deftere işlendi', tag: 'borç kaydı', text: 'Hesap borçlandırılır, ücret yansıtılır, host kaydı (journal) yazılır. ATM tek mesajlı modelde AUTHORIZED ve POSTED aynı anda olur.' },
          { decision: true, title: 'ATM parayı verebildi mi?', branches: [{ label: 'Evet', text: 'COMPLETED: işlem tamam, gün sonuna girer.', tone: 'ok' }, { label: 'Hayır / bilinmiyor', text: 'REVERSED: tam (ya da kısmi) iptal, borç iade edilir.', tone: 'warn' }] },
          { title: 'SETTLED · mutabık', tag: '0500', text: 'ATM sayaçları host journal ile tuttu; dönem kapandı.' },
          { title: 'CLEARED · takasa girdi', tag: 'bankalar arası', text: 'Başka banka ATM’sinde yapılan işlem bankalar arası net pozisyona yansıdı.' },
        ]}
      />
      <Table
        head={['Durum', 'Defter etkisi', 'Simülatörde']}
        rows={[
          [<b key="1">RECEIVED</b>, 'Yok', 'Olay günlüğünde istek mesajı (ISO).'],
          [<b key="2">VALIDATED</b>, 'Yok', 'Token (54), tutar (13), kart (14) kontrolü.'],
          [<b key="3">AUTHORIZED</b>, 'Provizyon: kullanılabilir bakiye azalır (ATM’de genellikle POSTED ile aynı an)', 'Ayrı durum yok; çekim tek adımda borçlanır.'],
          [<b key="4">POSTED</b>, 'Defter borç kaydı: bakiye düşer, ücret ve günlük çekim sayacı güncellenir', <>Yanıtta yeni <code>ledger</code> ve imzalı <code>cash_out</code> kaydı.</>],
          [<b key="5">COMPLETED</b>, 'Yeni etki yok; işlem kesinleşir', 'ATM sayacı yalnızca para alındığında artar (ayrı kayıt yok).'],
          [<b key="6">DECLINED</b>, 'Yok. Hareket de kayıt da oluşmaz', 'Red yanıtında host kaydı yoktur, bu yüzden iptal ve mutabakat da gerekmez.'],
          [<b key="7">REVERSED</b>, 'Ters kayıt: borç iade edilir, günlük çekim sayacı düşer', <>İmzalı <code>reversal</code> kaydı (id <code>R + RRN</code>).</>],
          [<b key="8">SETTLED</b>, 'Yeni hareket yok; mutabakat bayrağı', <>0500 tutunca kayıtlar <code>settled</code> olur.</>],
          [<b key="9">CLEARED</b>, 'Bankalar arası net pozisyon; müşteri defteri değişmez', <>Takas oturumu <code>cleared</code> işaretler.</>],
        ]}
      />
      <Callout title="Simülatörde durum alanı yok">
        Durum makinesi simülatörde kavramsaldır. Kodda yalnızca imzalı kayıtlar (<code>cash_out</code>, <code>reversal</code> …) ve iki bayrak (<code>settled</code>,
        <code> cleared</code>) vardır; diğer durumlar işlemin akışından çıkarılır.
      </Callout>

      <h2 id="yetki-finansal">Yetki, finansal mesaj, takas ve mutabakat</h2>
      <p>Kartlı işlemde “para hareketi” tek bir an değildir; aynı işlem farklı katmanlarda farklı anlarda görünür.</p>
      <Table
        head={['Katman', 'Mesaj / dosya', 'Ne zaman', 'Para hareketi']}
        rows={[
          [<b key="1">Yetkilendirme (authorization)</b>, '0100 / 0110', 'Gerçek zamanlı', 'Yok; yalnızca “yapılabilir mi?” kararı. POS’ta tutar provizyonla (hold) ayrılır.'],
          [<b key="2">Finansal işlem</b>, '0200 / 0210', 'Gerçek zamanlı', 'ATM’de hesap hemen borçlanır (tek mesajlı model).'],
          [<b key="3">Advice / iptal</b>, '0220, 0400, 0420', 'Olaydan sonra', 'Kaydı düzeltir veya bildirir.'],
          [<b key="4">Mutabakat (reconciliation)</b>, '0500 / 0510', 'Gün sonu', 'Yok; yalnızca tutarlılık kontrolü.'],
          [<b key="5">Takas (clearing)</b>, 'Takas dosyası', 'Gün sonu / ertesi gün', 'Bankalar arası kesinleşmiş borç ve alacak hesaplanır.'],
          [<b key="6">Settlement (nihai ödeme)</b>, 'Banka hesapları arası aktarım', 'Takasın ardından', 'Paranın bankalar arasında gerçekten el değiştirdiği an.'],
        ]}
      />
      <h3>Kullanılabilir bakiye ve defter bakiyesi</h3>
      <ul>
        <li>
          <b>Defter bakiyesi (ledger balance):</b> deftere işlenmiş hareketlerin toplamı.
        </li>
        <li>
          <b>Kullanılabilir bakiye (available balance):</b> defter bakiyesi eksi bekleyen provizyonlar (hold), artı varsa kredili hesap limiti. Müşterinin o an
          harcayabileceği tutar budur.
        </li>
        <li>
          Provizyon (hold) POS’ta ve kart sisteminde yaygındır: önce tutar ayrılır, kesinleşmiş tutar takasla sonradan gelir ve provizyon kapanır. ATM nakit
          çekiminde ise genellikle tek mesajla anında borç yazılır.
        </li>
      </ul>
      <Callout title="Simülatörde ne var?">
        Simülatör tek bir “bakiye” tutar (kredi kartı için limit eksi borç) ve provizyon/hold yoktur. Çekim 0200 ile anında borçlanır. Müşteri defteri gerçek zamanlı
        değişir; Takas &amp; Mutabakat sekmesi yalnızca <b>bankalar arası</b> pozisyonu hesaplar. Müşteri hesabına ertesi gün yansıyanlar yalnızca EFT takası ve çek
        takasıdır (“Hesaplara geçen” tablosu).
      </Callout>

      <h2 id="kimlikler">Kimlikler ve eşleştirme</h2>
      <p>
        Aynı işlemi ATM günlüğünde, switch journal’ında, host defterinde ve ağ dosyasında bulabilmek için ortak anahtar zinciri gerekir. Hiçbir tek
        kimlik her yerde geçerli değildir.
      </p>
      <Table
        head={['Kimlik', 'Alan', 'Kim üretir', 'Neye yarar', 'Simülatörde']}
        rows={[
          [<b key="1">STAN</b>, '11', 'ATM / switch', 'İstek–yanıt eşleştirme. Terminal bazında gün içinde benzersiz olması beklenir.', <>Her mesajda rastgele 6 hane (<code>_stan</code>). Gerçekte ardışık sayaçtır; simülatörde çakışabilir.</>],
          [<b key="2">RRN</b>, '37', 'Acquirer / switch', 'İşlemi sonradan bulmak: itiraz, iade, takas.', <>Yıl + yılın günü + saat (UTC) + 5 rastgele hane. Host kaydının <code>id</code>’si de bu değerdir.</>],
          [<b key="3">Onay kodu</b>, '38', 'Issuer', 'Fişte görünür; müşteri ve çağrı merkezi ile ortak referans.', 'Rastgele 6 hane.'],
          [<b key="4">Journal / kayıt id</b>, '—', 'Host', 'Hostun kendi defter kaydı.', <>İmzalı kayıt <code>id</code>’si = RRN. İptal kaydı <code>R + RRN</code>.</>],
          [<b key="5">Orijinal işlem verisi</b>, '90', 'ATM / switch', 'İptalde asıl işlemi göstermek: MTI, STAN, tarih, acquirer.', <><code>0200 + STAN + tarih + acquirer</code> (reversal_token’dan).</>],
          [<b key="6">Ağ referansı</b>, 'ağa özel', 'Ağ (BKM, Visa, Mastercard)', 'Takas dosyasında işlemi bulmak.', 'Yok.'],
          [<b key="7">UETR</b>, 'ISO 20022', 'Ödemeyi başlatan', 'Ödemenin uçtan uca tek kimliği (UUID biçimi; doğrulayın).', 'Yok. Havale/FAST için kavramsal; bkz. ISO 20022 sayfası.'],
          [<b key="8">Korelasyon kimliği</b>, 'başlık / log', 'İlk giren bileşen', 'Bileşenler arası log izlemek.', 'Yok; STAN/RRN ve imzalı token ortak anahtar işini görür.'],
        ]}
      />
      <p>
        Pratik kural: <b>gün içinde</b> terminal + STAN + tarih, <b>sonradan</b> RRN ve onay kodu, <b>defter</b> tarafında kayıt id’si ile arayın. Her bileşen bir
        öncekinin kimliğini kendi kaydında da saklamalıdır; aksi halde iz kopar. ISO 20022 tarafı için <a href="#/egitim/iso20022">ISO 20022</a> sayfasına bakın.
      </p>

      <h2 id="idempotentlik">Idempotentlik ve mükerrer işlem</h2>
      <p>
        Ağ yanıtları kaybolabilir, mesajlar tekrar edilebilir. Host, aynı isteği ikinci kez aldığında <b>aynı sonucu dönmeli, ikinci kez işlememelidir</b>.
        Bunun anahtarı, işlemin doğal kimliğidir: terminal + STAN + tarih (+ acquirer). İlk yanıt saklanır; tekrar gelen istek saklı yanıtı alır.
      </p>
      <Table
        head={['Tekrar eden mesaj', 'Host’un yapması gereken', 'Simülatörde']}
        rows={[
          [<b key="1">0200 (zaman aşımı sonrası tekrar)</b>, 'Anahtar kayıtlıysa borçlandırma, saklı yanıtı dön.', <>ATM 0200’ü tekrar göndermez; host 0200’ü sunucu tarafında tekilleştirmez (durumsuz).</>],
          [<b key="2">0420 (iptal tekrarı)</b>, 'Daha önce işlenmişse iade etme, saklı sonucu dön.', <>Host aynı token ile ikinci çağrıyı engellemez. Koruma istemcide: onaylanan SAF öğesi kuyruktan çıkar.</>],
          [<b key="3">0500 (gün sonu tekrarı)</b>, 'Aynı dönemi iki kez kapatma; sonuç aynı olmalı.', <>Tutarsa kayıtlar <code>settled</code> olur, dönem ilerler; tutmazsa dönem açık kalır ve tekrar çalıştırılabilir.</>],
          [<b key="4">Takas oturumu tekrarı</b>, 'Aynı işlem iki kez takasa girmez.', <><code>cleared</code> bayrağı; kayıt yoksa buton pasif. Host da id’leri tekilleştirir.</>],
        ]}
      />
      <Callout tone="warn" title="Neden sunucu tarafı tekilleştirme şart?">
        İstemci tarafı korumaya güvenilemez: ATM yeniden başlayabilir, kuyruk bozulabilir, switch yedeğe geçebilir. Gerçek host işlem anahtarlarını kalıcı
        tutar ve tekrarı kendisi tanır. Simülatörde bu kontrol istemcide olduğu için çift iade <i>mümkün</i> bir senaryodur (aynı token ile ikinci çağrı); gerçek
        sistemde bu hata sayılır.
      </Callout>

      <h2 id="iptal">İptal (reversal) ve tekrar mantığı</h2>
      <p>
        İptal, hatalı ya da tamamlanamayan bir işlemin etkisini geri alan <b>ters kayıttır</b>; asıl kaydı silmez, karşısına eşit ve zıt bir kayıt ekler.
        Defter denetlenebilir kalır.
      </p>
      <h3>Hangi durumda iptal gerekir?</h3>
      <Table
        head={['Durum', 'Host borçladı mı?', 'ATM ne yapar', 'İptal?']}
        rows={[
          [<b key="1">Host reddetti (51, 61, 55…)</b>, 'Hayır', 'Para vermez', <b key="a">Gerekmez.</b>],
          [<b key="2">Onay + para verildi</b>, 'Evet', 'Para verir', <b key="b">Gerekmez.</b>],
          [<b key="3">Onay + para verilemedi</b>, 'Evet', 'Cihaz arızası, kutuya alma', <b key="c">Tam iptal (neden 22).</b>],
          [<b key="4">Onay + müşteri parayı almadı</b>, 'Evet', 'Banknotları geri çeker', <b key="d">Tam iptal (neden 17).</b>],
          [<b key="5">Onay + kısmen verildi</b>, 'Evet', 'Verilen tutarı bilir', <b key="e">Kısmi iptal: verilmeyen tutar.</b>],
          [<b key="6">Sonuç bilinmiyor (zaman aşımı)</b>, 'Belki', 'Para vermez', <b key="f">Tam iptal (neden 68), yanıtsızsa SAF.</b>],
        ]}
      />
      <p>
        Kuralı şöyle özetleyebiliriz: <b>para çıktıysa iptal yok, para çıkmadıysa ve host borçlandıysa iptal var, host borçlamadıysa iptal edilecek bir şey yok</b>.
        “Bilinmiyor” durumunda güvenli taraf para vermemektir; müşteri aleyhine kalan fark iptalle kapanır. Para verildi mi verilmedi mi emin
        olunamayan cihaz hataları (örneğin dağıtım sırasında güç kesintisi) için kuruma özel inceleme kuralı gerekir; doğrulayın.
      </p>
      <h3>Tam ve kısmi iptal</h3>
      <ul>
        <li>
          <b>Tam iptal:</b> asıl tutarın tamamı (ve alınan ücret) iade edilir. Simülatör yalnızca bunu yapar: <code>reverse</code> tutar + ücreti iade eder, günlük
          çekim sayacından yalnızca çekim tutarını düşer.
        </li>
        <li>
          <b>Kısmi iptal:</b> yalnızca verilmeyen kısım iade edilir. ISO 8583 sürümlerinde bunun için “yerine geçen tutarlar” alanı (alan 95) kullanılır;
          ağ lehçesine göre doğrulayın. Simülatörde kısmi iptal yok.
        </li>
      </ul>
      <h3>İptal nedenleri ve SAF</h3>
      <Table
        head={['Neden (alan 39)', 'Anlamı', 'Simülatörde tetikleyen']}
        rows={[
          [<b key="1">68</b>, 'Yanıt zaman aşımı', 'Arıza → “Host yanıtı kaybolur”. İlk 0400 yanıtsız; SAF’ta bekler. Kuyruk gönderilirken 0420 olarak, neden 68 ile gider.'],
          [<b key="2">22</b>, 'Cihaz arızası: banknot verilemedi', 'Arıza → “Para sıkışması”. 0400 hemen gider ve yanıt alınır.'],
          [<b key="3">17</b>, 'Müşteri parayı almadı', 'Arıza → “Para alınmaz”. Banknotlar 6 sn sonra geri çekilir, 0400 hemen gider.'],
        ]}
      />
      <Notes
        items={[
          <>İptal mesajı kaybolmamalıdır: ATM (ya da switch) onu <b>SAF</b> kuyruğuna alır, yanıt gelene kadar 0420 olarak tekrarlar. Host bunu idempotent işlemelidir.</>,
          <>İptalin de bir ömrü vardır. Simülatörde <code>reversal_token</code> 24 saat geçerlidir; süresi dolan iptal operasyonel inceleme ister.</>,
          <>İptal, asıl işlemin terminaline bağlıdır: başka terminalden gönderilen iptal 05 ile reddedilir.</>,
          <>Simülatörde iptal, asıl işlemin kaydını (<code>cash_out</code>) mutabakat ve takas hesabından düşer: 0500 iptal edilen çekimi saymaz; takas, aynı oturumdaysa işlemi hiç hesaplamaz, önceki oturumda geçtiyse eksi düzeltme satırı olarak ekler.</>,
        ]}
      />

      <h2 id="nakit">Nakit dağıtım koordinasyonu</h2>
      <p>
        Para fiziksel olduğu için sıra önemlidir: <b>önce host borçlandırır, sonra ATM dağıtır</b>. Tersi sıra, host reddedince bile para çıkmış olması
        riskini doğurur. ATM de “card-before-cash” kuralıyla önce kartı iade eder, sonra parayı sunar; müşteri kartı almadan para verilmez.
      </p>
      <Flow
        items={[
          { title: 'Host onayı', tag: '0200 → 0210 · 39=00', text: 'Hesap borçlandırıldı, host kaydı yazıldı, iptal anahtarı (reversal_token) ATM’ye verildi.' },
          { title: 'Dağıtım planı ve kasetten çekme', tag: 'CDM', text: 'Kupür planı hesaplanır (200/100/50/20 TL). Banknotlar kasetlerden çekilir; kaset sayaçları güncellenir.' },
          { title: 'Kart iadesi ve para sunumu', tag: 'card-before-cash', text: 'Önce kart iade edilir, kart alınınca banknotlar sunulur.' },
          { decision: true, title: 'Sonuç', branches: [{ label: 'Para alındı', text: 'ATM “verilen” sayacını artırır, fiş basar. İptal yok.', tone: 'ok' }, { label: 'Zamanında alınmadı', text: 'Banknotlar geri çekme kutusuna alınır, iptal (17) gönderilir.', tone: 'warn' }, { label: 'Dağıtım hatası / sıkışma', text: 'Banknotlar red kutusuna alınır, CDM devre dışı kalır, iptal (22) gönderilir.', tone: 'bad' }] },
        ]}
      />
      <h3>Dağıtım başarısız olunca ATM ne yapmalı?</h3>
      <ul>
        <li>
          <b>İptali hemen göndermek</b> (neden 22 ya da 17). Yanıt gelmezse SAF’a almak.
        </li>
        <li>
          <b>Banknotları doğru kutuya koymak</b> ve kaset/red/geri çekme sayaçlarını güncel tutmak. Kasa mutabakatı bu sayaçlara dayanır.
        </li>
        <li>
          <b>Cihaz durumunu bildirmek</b>: CDM hizmet dışı, teknisyen çağrısı. Aksi halde bir sonraki müşteri aynı arızayı yaşar.
        </li>
        <li>
          <b>EJ’ye yazmak</b>: ne istendi, ne yapıldı, hangi sonuç. İtirazda ilk bakılan kayıt budur.
        </li>
      </ul>
      <TryInSim>Arıza sekmesinde “Para sıkışması”nı işaretleyip bir çekim yapın. Ekran “Teknik arıza” der, bakiye geri yüklenir. Teknisyen sekmesinde “Para verme (CDM)” sıkışma gösterir, Red kutusunda banknot vardır ve Denkleştirme tablosunda “− Red” sütunu dolu. Aynı işlemde Servis → EJ’de “SIKIŞMA · İPTAL” yazar.</TryInSim>

      <h2 id="limitler">Limitler ve ücret kuralları</h2>
      <p>
        Limit kontrolleri host’ta, belirli bir sırayla çalışır. Simülatörde çekim kontrolü şu sıradadır (<code>_withdraw_check</code>); ilk ihlal yanıt kodunu belirler.
      </p>
      <Table
        head={['Sıra', 'Kontrol', 'Kod', 'Simülatörde değer']}
        rows={[
          [1, 'Tutar geçerli mi?', <b key="a">13</b>, 'Sıfırdan büyük ve 10’un katı olmalı.'],
          [2, 'Bakiye (ücret dahil) yeter mi?', <b key="b">51</b>, 'Tutar + ücret ≤ kullanılabilir bakiye (kredi kartında limit − borç).'],
          [3, 'Günlük limit aşıldı mı?', <b key="c">61</b>, <>Bugünkü çekimler + bu tutar ≤ 10.000 TL (<code>DAILY_LIMIT</code>); ücret limite sayılmaz.</>],
          [4, 'Kupür planı yapılabilir mi?', <b key="d">86</b>, 'Kasetlerdeki 200/100/50/20 TL ile tutar oluşturulamıyorsa (ör. 30 TL).'],
        ]}
      />
      <Table
        head={['Kural', 'Simülatörde değer']}
        rows={[
          ['PIN deneme hakkı', <>3 deneme hakkı: hatalı girişlerde sırasıyla 55, 55, 75 (kart alıkonur). Deneme sayısı istemcide tutulur; gerçek host bunu kart kaydında tutar.</>],
          ['Başka banka ATM’si ücreti', <>Çekim 25 TL, bakiye sorgu 3 TL (<code>OFF_US_FEES</code>); alan 28’de <code>D</code> + kuruş.</>],
          ['Transfer ücreti', <>Havale 0, FAST 5, EFT 15 TL; FAST sınırı 50.000 TL, üstü EFT; EFT yalnızca hafta içi 09–17 (dışında kuyruğa alınır).</>],
          ['İptalde ücret', <>İptal ücreti de iade eder (tutar + ücret); günlük çekim sayacından yalnızca tutar düşer.</>],
          ['Kredi kartı', <>Nakit avans; limit − borç kontrol edilir, işlem kodunda hesap türü 30.</>],
        ]}
      />
      <Callout tone="warn" title="Demo değerleri">
        Ücret ve limitler demodur, gerçek tarifeleri ve mevzuatı yansıtmaz. Gerçek sistemde ayrıca adet limiti (ör. 65), tek işlem üst sınırı, kart ve segment bazlı
        limitler bulunur.
      </Callout>
      <TryInSim>Ayşe ile 5.000 TL’yi iki kez çekin, ardından 200 TL daha deneyin: üçüncü işlem günlük limit nedeniyle 61 alır. 275 TL gibi 10’un katı olmayan bir tutar 13, 30 TL gibi kupürlerle oluşmayan bir tutar 86 verir. Mehmet Kaya’nın kartıyla (PIN 4321, bakiye 850 TL) 3.000 TL çekmek 51 verir.</TryInSim>

      <h2 id="mutabakat">Mutabakat seviyeleri</h2>
      <p>
        Mutabakat, “kayıtlarımız birbiriyle tutuyor mu?” sorusunu her seviyede ayrı sorar. Tek bir seviyede tutmak yetmez: ATM sayacı host ile tutabilir, host core
        ile tutmayabilir.
      </p>
      <Table
        head={['Seviye', 'Karşılaştırılan', 'Kim yapar', 'Simülatörde']}
        rows={[
          [<b key="1">1 · Fiziksel kasa</b>, 'Kasetteki banknot sayısı ↔ açılış + ikmal + yatan − verilen − red − geri çekilen', 'Teknisyen / ATM operasyonu', 'Teknisyen → Denkleştirme tablosu (kupür bazında fark).'],
          [<b key="2">2 · ATM ↔ host</b>, 'ATM sayaçları ↔ host journal (adet ve tutar, borç/alacak)', 'Gün sonu 0500', <>Gün sonu (0500); farkta 39 = 95.</>],
          [<b key="3">3 · Host ↔ core</b>, 'Host journal ↔ core defter/GL', 'Host operasyonu', 'Yok (defter istemcide).'],
          [<b key="4">4 · Switch/host ↔ ağ</b>, 'Kendi kayıtlarımız ↔ ağın takas dosyası', 'Takas operasyonu', 'Takas oturumu kendi defterinden üretir; ağ dosyasıyla karşılaştırma yok.'],
        ]}
      />
      <p>
        “Üç yönlü mutabakat” (three-way) çoğu kurumda ATM kaydı, host journal ve core/GL’yi birlikte; “dört yönlü” (four-way) buna ağ takas dosyasını ya da nakit
        GL hesabını ekler. Tanım kuruma göre değişir, kendi kurumunuzun belgesine bakın.
      </p>
      <h3>Örnek mutabakat tablosu (kavramsal)</h3>
      <p>Bir ATM’de gün sonu: bir çekim zaman aşımına uğramış ve iptali henüz host’a ulaşmamış. Sayılar örnektir.</p>
      <Table
        head={['Kalem', 'ATM sayaç / EJ', 'Host journal', 'Core defteri', 'Sonuç']}
        rows={[
          ['Nakit çekim adedi', '41', '42', '42', 'ATM 1 eksik'],
          ['Nakit çekim tutarı', '18.500,00', '19.000,00', '19.000,00', 'Fark 500,00'],
          ['İptal (host’a ulaşan)', '—', '0', '0', 'İptal henüz gelmedi'],
          ['SAF kuyruğu (ATM)', '1 · 500,00', '—', '—', 'Fark bu kayda eşit'],
        ]}
      />
      <h3>Tipik kırılma nedenleri</h3>
      <Table
        head={['Neden', 'Seviye', 'Çözüm']}
        rows={[
          ['Yanıtı kaybolmuş çekim, iptal SAF’ta', 'ATM ↔ host', 'SAF kuyruğunu gönder, gün sonunu tekrarla.'],
          ['İptal host’a ulaşmış ama ATM sayacı farklı çalışmış', 'ATM ↔ host', 'ATM günlüğü ve cihaz loglarını incele; sayaç düzeltmesi.'],
          ['ATM para verdi ama yanlışlıkla iptal gönderdi', 'Kasa / host', 'Kasa fazlası/eksiği; müşteri hesabı ve kasa düzeltmesi; itiraz süreci.'],
          ['Müşteri parayı almadı, banknot geri çekme kutusunda', 'Kasa', 'Kutu sayımı; iptal kaydı varsa tutar tutar.'],
          ['Tarih kesimi (cutover) farkı', 'Host ↔ core ↔ ağ', 'İşlem saatini ve kesim zamanını karşılaştır; gelecek günün işlemine kaydır.'],
          ['Ağın bildirdiği ama kendi kaydımızda olmayan işlem', 'Host ↔ ağ', 'Geç advice, mükerrer ya da kayıp mesaj. İşlemi araştır, kayıt ekle ya da itiraz et.'],
          ['Mükerrer deftere işleme', 'Host ↔ core', 'Aynı işlemin ikinci kaydını tersle; idempotentlik hatasını kapat.'],
        ]}
      />
      <TryInSim>Teknisyen sekmesinde Bakım moduna alın, birkaç çekim yaptıktan sonra “Gün sonu (0500)”e basın. Takas &amp; Mutabakat sekmesinde ATM ↔ Host tablosuna (adet · tutar · fark) bakın. Fark yoksa dönem kapanır ve Denkleştirme sayaçları sıfırlanır.</TryInSim>

      <h2 id="istisna">İstisna ve inceleme süreci</h2>
      <p>
        Tutmayan bir kalem, bir <b>vaka</b>dır. Nakit eksik/fazla çıkan ATM’ler, müşteri itirazları ve host kırılmaları aynı iş akışından geçer.
      </p>
      <Flow
        items={[
          { title: 'Tespit', tag: 'gün sonu · itiraz', text: 'Otomatik mutabakat farkı, kasa sayım farkı ya da müşteri şikâyeti vakayı açar.' },
          { title: 'Kanıt toplama', tag: 'EJ · host journal · switch journal · cihaz logu', text: 'Aynı işlemi tüm kayıtlarda bul (terminal, STAN, RRN, tarih). Para sayımı ve kamera kaydı varsa eklenir.' },
          { title: 'Sınıflandırma', text: 'Kasa eksiği, kasa fazlası, deftere işlenmiş ama verilmemiş çekim, mükerrer işlem, ağ farkı.' },
          { title: 'Karar ve düzeltme', tag: 'çift onay', text: 'Müşteri hesabına iade, ATM/GL düzeltmesi ya da itirazın reddi. Düzeltme kaydı sebep kodu ve onaylayanla birlikte yazılır, asıl kayıt silinmez.' },
          { title: 'Kapanış ve raporlama', text: 'Vaka kapanır, kök neden ve süre raporlanır. Tekrarlayanlar yazılım ya da süreç iyileştirmesine döner.' },
        ]}
      />
      <h3>Müşteri itirazı ve chargeback (taslak)</h3>
      <ul>
        <li>
          Müşteri kendi bankasına (issuer) “ATM para vermedi ama hesabımdan düştü” der. Issuer, acquirer’dan EJ ve cihaz kayıtlarını ister.
        </li>
        <li>
          Kayıtlar paranın verilmediğini gösteriyorsa müşteri hesabına <b>geçici ya da kesin iade</b> yapılır; diğer durumda itiraz reddedilir.
        </li>
        <li>
          Başka banka ATM’sinde olduysa issuer, tutarı ağ üzerinden acquirer’dan <b>chargeback</b> ile talep eder; acquirer kanıtla itiraz edebilir. Süreler, neden kodları ve
          arbitraj adımları ağa (şema) göre farklıdır, doğrulayın.
        </li>
      </ul>

      <h2 id="denetim-guvenlik">Denetim izi, EJ ve güvenlik</h2>
      <p>
        Her para hareketinin “kim, ne zaman, neyi, neden yaptı” cevabı olmalıdır. İki paralel kayıt vardır: <b>ATM’nin EJ’si</b> (terminalde ne olduğu) ve
        <b> host journal’ı</b> (host’ta ne olduğu). İkisi birbirini çapraz doğrular.
      </p>
      <Table
        head={['Kayıt', 'Tuttuğu', 'Simülatörde']}
        rows={[
          [<b key="1">ATM EJ</b>, 'İşlem türü, tutar, sonuç (VERİLDİ, ZAMAN AŞIMI · İPTAL KUYRUKTA, SIKIŞMA · İPTAL, GERİ ÇEKİLDİ · İPTAL…), operatör olayları.', 'Servis → EJ sekmesi.'],
          [<b key="2">Host journal</b>, 'İstek/yanıt, kimlikler, defter etkisi, iptal bağları.', 'İmzalı host kayıtları + Olay günlüğü.'],
          [<b key="3">Düzeltme (adjustment)</b>, 'Elle yapılan düzeltmeler, sebep ve onay.', 'Yok.'],
        ]}
      />
      <h3>Güvenlik</h3>
      <Table
        head={['Konu', 'Uygulama', 'Simülatörde']}
        rows={[
          ['Oturum belirteci', 'İmzalı, kısa ömürlü, türe bağlı token. Süresi dolunca işlem reddedilir.', <>HMAC-SHA256 imzalı token; türler: session (300 sn), reversal (24 saat), record (7 gün), qr (120 sn). Bozuk imza, yanlış tür ya da süresi dolmuş: session için 54.</>],
          ['PIN', 'PIN açık taşınmaz ve saklanmaz; HSM doğrulama verisiyle doğrular.', <>Demo için tuzlu SHA-256 hash’i tutulur. Gerçekte yapılmaz.</>],
          ['PAN', 'Günlüklerde ve ekranlarda maskelenir, tam PAN şifreli saklanır.', <>Tüm alan 2 değerleri maskelidir (<code>4543••••••••0001</code> biçimi).</>],
          ['Hassas kimlik doğrulama verisi', 'Track verisi, CVV ve PIN bloğu yetkilendirmeden sonra saklanmaz.', 'Hiçbiri tutulmaz.'],
          ['Kanal', 'TLS / mTLS, hatlarda özel ağ.', 'ATM → Switch TLS 1.2, Switch → InterAPI mTLS (etiket olarak).'],
          ['Anahtar / sır yönetimi', 'Anahtarlar HSM’de, sırlar ortam değişkeninde ya da kasada.', <>İmza anahtarı <code>SESSION_SECRET</code> ortam değişkeni; varsayılan değer yalnızca demodur.</>],
        ]}
      />
      <Callout title="PCI DSS kavramsal özeti">
        PCI DSS, kart verisini işleyen kuruluşlar için güvenlik standardıdır. Kavramsal özet: kart verisini saklamayı en aza indirmek, saklanıyorsa şifrelemek,
        PAN’ı ekranda ve logda maskelemek, erişimi kısıtlamak ve izlemek, ağı bölümlemek ve sızma testi yapmak. PIN işleme için ayrı bir PCI PIN gereksinim seti
        vardır. Güncel sürüm ve ayrıntı için PCI Security Standards Council belgelerini doğrulayın; bu sayfa uyum rehberi değildir.
      </Callout>

      <h2 id="batch">Toplu işler ve gün sonu kesimi</h2>
      <p>
        Gerçek zamanlı akışın yanında, her gün düzenli çalışan toplu işler vardır. En kritiği <b>gün sonu kesimi (EOD cutover)</b>’dir: iş günü kapanır, o güne
        ait journal dondurulur ve sonraki işlemler yeni güne yazılır.
      </p>
      <Table
        head={['İş', 'Ne yapar', 'Simülatörde']}
        rows={[
          [<b key="1">Gün sonu kesimi</b>, 'İş gününü kapatır, hareketleri dondurur, yeni güne geçer.', <>Terminal bazında “dönem” sayacı (batch). Yalnızca mutabakat tutunca ilerler.</>],
          [<b key="2">ATM mutabakatı</b>, 'Terminal sayaçlarını host journal ile karşılaştırır.', 'Gün sonu (0500).'],
          [<b key="3">Takas dosyası üretimi</b>, 'Bankalar arası borç/alacak dosyası hazırlar.', 'Takas oturumu; tüm terminallerin kayıtları birlikte girer.'],
          [<b key="4">Ücret ve faiz tahakkuku</b>, 'Hesaplara ücret, faiz, komisyon işler.', 'Yok; ücret çekimle birlikte anında yansır.'],
          [<b key="5">Kuyruktaki ödeme gönderimi</b>, 'Mesai dışı bekleyen EFT’leri ilk iş gününde gönderir.', 'Takas oturumu kuyruktaki EFT’yi gönderir, alıcıya alacak yazar.'],
          [<b key="6">Arşivleme ve temizlik</b>, 'Eski kayıtları arşive alır.', <>Kayıtların ömrü 7 gün (<code>RECORD_TTL</code>); süre geçince gün sonuna/takasa girmez.</>],
        ]}
      />

      <h2 id="gozlem">Gözlemlenebilirlik</h2>
      <p>
        Host’un sağlığı “çalışıyor mu” sorusundan öte, <b>doğru çalışıyor mu</b> sorusuna dayanır. Bunun için bileşenler arası tek bir korelasyon kimliği taşınır
        ve iş metrikleri teknik metriklerle birlikte izlenir.
      </p>
      <Table
        head={['Gösterge', 'Ne anlatır', 'Alarm örneği']}
        rows={[
          [<b key="1">Onay / ret oranı</b>, 'Genel sağlık; ani düşüş ya da ret kodu karışımının değişmesi.', 'Onay oranı alışılmış aralığın altına indi.'],
          [<b key="2">Zaman aşımı oranı</b>, 'Hedef bazlı yavaşlama ya da kopukluk.', 'Aynı hedefte art arda zaman aşımı.'],
          [<b key="3">İptal oranı ve SAF derinliği</b>, 'Belirsiz sonuçların ve tekrar bekleyenlerin sayısı.', 'SAF kuyruğu boşalmıyor.'],
          [<b key="4">Gecikme yüzdelikleri</b>, 'Kuyruk gecikmesi ortalamada görünmez; p95/p99 izlenir.', 'p99 zaman aşımı eşiğine yaklaştı.'],
          [<b key="5">Eşleşmeyen kayıt</b>, 'Mutabakat sonucu: açık fark sayısı ve yaşı.', 'Bir günden eski çözülmemiş fark.'],
          [<b key="6">Cihaz durumu</b>, 'CDM arızası, kaset eksiği, hizmet dışı terminal sayısı.', 'Kaset seviyesi tahminin altında.'],
        ]}
      />
      <p>
        <b>SLO</b> (hizmet düzeyi hedefi) bu göstergelerden türetilir: örneğin “işlemlerin belli bir yüzdesi belirli sürede yanıtlanır”. Hedef sayısı kurumun
        iş gereksinimine bağlıdır; bu sayfada örnek rakam verilmez. Simülatörde gözlem, Mesaj akışı panelinde hop süreleri ve Olay günlüğü ile sınırlıdır.
      </p>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Altı senaryonun hepsi simülatörde yeniden üretilebilir.{' '}
        <span className="tr-key ok">Yeşil</span> oklar başarılı, <span className="tr-key bad">kırmızı</span> oklar red/hata, kesikli oklar yanıttır. Tablolardaki
        RRN, STAN ve onay kodları örnektir.
      </p>
      <Tabs
        label="Host senaryoları"
        tabs={[
          {
            label: '1 · Başarılı çekim ve defter kayıtları',
            content: (
              <>
                <Sequence
                  label="Ayşe Yılmaz, Demo Bank ATM’sinden 500 TL çekiyor (bakiye 12.500 TL)"
                  actors={[ACT.atm, ACT.sw, ACT.host, ACT.core]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', sub: 'STAN 004217', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', tone: 'ok' },
                    { from: 'host', to: 'core', label: 'Provizyon + borç kaydı', tone: 'ok' },
                    { note: 'Bakiye 12.500 → 12.000\nGünlük çekim 0 → 500', at: 'core' },
                    { from: 'core', to: 'host', label: 'Onay', res: true, tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0210 · 39=00 · RRN · 38', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210', res: true, tone: 'ok' },
                    { note: 'ATM parayı verir, “verilen” sayaç 1 · 500 TL', at: 'atm' },
                  ]}
                />
                <p>Host tarafında bu işlem şu kayıtları üretir (örnek değerler):</p>
                <Table
                  head={['#', 'Kayıt', 'Hesap', 'Borç', 'Alacak', 'Durum / not']}
                  rows={[
                    [1, '0200 isteği alındı (STAN 004217, terminal ATM00684)', '—', '—', '—', 'RECEIVED, journal yazıldı'],
                    [2, 'Token, tutar, bakiye, günlük limit ve kupür kontrolü', '—', '—', '—', 'VALIDATED → AUTHORIZED'],
                    [3, 'Müşteri hesabı borç', 'Ayşe Yılmaz · vadesiz', '500,00', '—', 'POSTED · bakiye 12.500,00 → 12.000,00'],
                    [4, 'Karşı kayıt: ATM nakit / geçici hesap', 'ATM00684 · nakit', '—', '500,00', 'Gerçek defterde çift taraflı kayıt; simülatörde yok'],
                    [5, 'Host kaydı (cash_out), onay kodu', 'RRN = kayıt id', '—', '—', 'İmzalı kayıt; yanıtta reversal_token'],
                    [6, 'ATM: para alındı', 'ATM sayacı', '1 · 500,00', '—', 'COMPLETED; EJ: VERİLDİ'],
                    [7, 'Gün sonu 0500', 'Host ↔ ATM', '—', '—', 'ATM 1 · 500,00 = host 1 · 500,00, SETTLED'],
                  ]}
                />
                <Notes
                  items={[
                    <>Borç kaydı ATM para vermeden <b>önce</b> yazılır; bu yüzden para vermeme durumunda iptal gerekir.</>,
                    <>Simülatörde defter yalnızca müşteri bakiyesidir; karşı kayıt (ATM nakit hesabı) gerçek core’da çift taraflı muhasebe fişiyle görülür.</>,
                    <>Onay kodu müşterinin fişinde “ONAY KODU”, RRN ise itirazlarda aranan anahtardır.</>,
                    <>Bu işlem 0500 gün sonunda host kaydıyla ATM sayacı olarak karşılaşır ve tutar.</>,
                  ]}
                />
                <TryInSim>Ayşe ile 500 TL çekin. Servis → Teknisyen sekmesinde “borç 1 / 500 TL” sayaçlarını, Servis → EJ’de “VERİLDİ” kaydını görün. Bakım moduna alıp “Gün sonu (0500)” çalıştırın: Takas &amp; Mutabakat sekmesinde ATM ve Host satırları eşit, dönem kapanır.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Yetersiz bakiye',
            content: (
              <>
                <Sequence
                  label="Mehmet Kaya (bakiye 850 TL) 3.000 TL çekmek istiyor"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 3.000 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', tone: 'ok' },
                    { note: 'Tutar geçerli (13 değil)\nBakiye 850 < 3.000 → 51', at: 'host', tone: 'bad' },
                    { from: 'host', to: 'sw', label: '0210 · 39=51', res: true, tone: 'bad' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=51', res: true, tone: 'bad' },
                    { note: 'Para verilmez, hesapta\nhareket olmaz, iptal gerekmez', at: 'atm', tone: 'bad' },
                  ]}
                />
                <Table
                  head={['Kayıt', 'Var mı?', 'Neden']}
                  rows={[
                    ['0200 / 0210 mesaj çifti', 'Evet', 'Ret de bir yanıttır; denetim için journal’a yazılır.'],
                    ['Hesap hareketi', 'Hayır', 'DECLINED durumunda defter etkisi yoktur.'],
                    ['Host kaydı (cash_out)', 'Hayır', 'Simülatörde red yanıtı kayıt üretmez; mutabakat ve takasa girmez.'],
                    ['İptal (0400)', 'Hayır', 'Host borçlandırmadığı için geri alınacak bir şey yok.'],
                    ['Günlük çekim sayacı', 'Değişmez', 'Yalnızca onaylanan çekim sayacı artırır.'],
                  ]}
                />
                <Notes
                  items={[
                    <>Kontrol sırası: tutar geçerli mi (13), bakiye yeter mi (51), günlük limit (61), kupür planı (86). Başka banka ATM’sinde ücret de bakiye kontrolüne dahildir.</>,
                    <>Red yanıtında az alan döner (39 ve 37); onay kodu yoktur.</>,
                    <>ATM bu ret için EJ’ye “RED 51” yazar; para hareketi olmadığı için mutabakatta fark çıkmaz.</>,
                  ]}
                />
                <TryInSim>Mehmet Kaya’nın Troy kartını (PIN 4321, bakiye 850 TL) takıp 3.000 TL çekmeyi deneyin: “Yetersiz bakiye” (51). Olay günlüğünde 0200/0210 satırını açıp alan 39’a bakın; Servis → Teknisyen’de borç sayacı değişmez.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Zaman aşımı ve iptal',
            content: (
              <>
                <Sequence
                  label="Host borçlandırdı ama 0210 ATM’ye ulaşmadı; iptal SAF ile tamamlanır"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', tone: 'ok' },
                    { note: 'POSTED: bakiye 500 düştü\nHost kaydı (cash_out) yazıldı', at: 'host' },
                    { from: 'host', to: 'sw', label: '0210 · 39=00', lost: true, res: true, tone: 'bad' },
                    { note: 'ATM zaman aşımı: sonuç bilinmiyor\nPara VERİLMEZ', at: 'atm', tone: 'warn' },
                    { from: 'atm', to: 'sw', label: '0400 · 39=68', lost: true, tone: 'warn' },
                    { note: 'Yanıt yok → SAF kuyruğu (1)', at: 'atm', tone: 'warn' },
                    { sep: 'SAF gönderimi' },
                    { from: 'atm', to: 'sw', label: '0420 · 39=68 · alan 90', tone: 'warn' },
                    { from: 'sw', to: 'host', label: '0420', tone: 'warn' },
                    { note: 'REVERSED: bakiye 500 iade\nHost kaydı reversal (R + RRN)', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0430 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0430', res: true, tone: 'ok' },
                  ]}
                />
                <Table
                  head={['#', 'Kayıt', 'Borç', 'Alacak', 'Bakiye', 'Durum']}
                  rows={[
                    [1, 'Çekim borç (RRN 263051200417)', '500,00', '—', '12.000,00', 'POSTED'],
                    [2, 'İptal 0420 (id R263051200417, neden 68)', '—', '500,00', '12.500,00', 'REVERSED'],
                    [3, 'Net', '500,00', '500,00', '12.500,00', 'Para hareketi sıfır'],
                  ]}
                />
                <Notes
                  items={[
                    <>İptal asıl işleme <b>alan 90</b> ile bağlanır; host asıl kaydı bulup tersini yazar. Günlük çekim sayacı da 500 geri alınır.</>,
                    <>Simülatörde ilk 0400’ün yanıtsız kaldığı loga yazılır ve mesaj SAF kuyruğuna alınır; host ikinci mesajı (0420) gerçekten işler.</>,
                    <>Simülatörde 0420’nin neden alanı (68), kuyruktaki öğe hangi nedenle girmiş olursa olsun sabittir.</>,
                    <>Aynı 0420 host’a ikinci kez gelirse gerçek host saklı sonucu döner. Simülatörde host bunu engellemez; kuyruk, öğeyi onaydan sonra siler.</>,
                  ]}
                />
                <TryInSim>Arıza → “Host yanıtı kaybolur”u işaretleyip Ayşe ile 500 TL çekin. Bakiye 500 TL düşer, para verilmez, Teknisyen sekmesinde SAF kuyruğu 1 olur. Bakım moduna alıp “SAF kuyruğunu gönder”e basın: Olay günlüğünde 0420 → 0430, bakiye 12.500 TL’ye döner, SAF kuyruğu 0.</TryInSim>
              </>
            ),
          },
          {
            label: '4 · Sıkışma ve iptal',
            content: (
              <>
                <Sequence
                  label="Host onayladı, banknotlar taşıma yolunda sıkıştı"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', tone: 'ok' },
                    { note: 'POSTED: bakiye 500 düştü', at: 'host' },
                    { from: 'host', to: 'sw', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { note: 'CDM sıkışması: banknotlar RED kutusuna\nCDM devre dışı', at: 'atm', tone: 'bad' },
                    { from: 'atm', to: 'sw', label: '0400 · 39=22', sub: 'cihaz arızası', tone: 'warn' },
                    { from: 'sw', to: 'host', label: '0400 · alan 90', tone: 'warn' },
                    { note: 'REVERSED: 500 iade', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0410 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0410', res: true, tone: 'ok' },
                  ]}
                />
                <Table
                  head={['Taraf', 'Ne olur', 'Mutabakata etkisi']}
                  rows={[
                    ['Host', 'cash_out kaydı + reversal kaydı', '0500’de iptal edilen çekim sayılmaz.'],
                    ['ATM sayaçları', 'Para alınmadığı için “verilen” sayacı artmaz', 'ATM 0 = host net 0, tutar.'],
                    ['ATM kasa', 'Kupürler kasetten çıktı, red kutusunda', 'Denkleştirme: “− Red” sütunu bu banknotları açıklar, fark 0.'],
                    ['ATM durumu', 'CDM sıkışma, hizmet dışı', 'Teknisyen “Arızaları gider” demeden ATM para vermez; red kutusu daha sonra boşaltılır.'],
                  ]}
                />
                <Notes
                  items={[
                    <>İptal hemen ve yanıt beklenerek gönderilir: ATM hâlâ hostla konuşabilir, yani zaman aşımı gibi SAF gerekmez.</>,
                    <>Neden kodu 22 (cihaz arızası). Para alınmama durumunda neden 17’dir ve banknotlar geri çekme kutusuna gider.</>,
                    <>Fiziksel olarak kaybolan para yoktur: banknotlar kutuda durur, hesabın borcu iade edilmiştir. Üç kayıt (kasa, ATM, host) birbirini doğrular.</>,
                  ]}
                />
                <TryInSim>Arıza → “Para sıkışması”nı seçip Ayşe ile çekin. Sonra Teknisyen sekmesinde: CDM “Sıkışma”, Red kutusunda banknot var. Bakım modunda “Arızaları gider”, “Kutuları boşalt”, sonra “Gün sonu (0500)”: dönem tutar. Denkleştirme tablosunda “− Red” sütununa bakın.</TryInSim>
              </>
            ),
          },
          {
            label: '5 · Başka banka ATM’si ve ertesi gün takas',
            content: (
              <>
                <Sequence
                  label="Elif Demir (Atlas Bank) Demo Bank ATM’sinden 500 TL çekiyor"
                  actors={[ACT.atm, ACT.sw, ACT.bkm, ACT.iss]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', sub: 'ücret bildirimi onaylandı', tone: 'ok' },
                    { from: 'sw', to: 'bkm', label: '0200 + ücret 25 TL', sub: 'alan 32, 28', tone: 'warn' },
                    { from: 'bkm', to: 'iss', label: '0200', tone: 'warn' },
                    { note: 'Atlas Bank host: bakiye 4.200 → 3.675\n(500 + 25 ücret). Host kaydı yazılır', at: 'iss' },
                    { from: 'iss', to: 'bkm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { from: 'bkm', to: 'sw', label: '0210', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { sep: 'Ertesi gün · takas' },
                    { note: 'Takas: Atlas Bank → Demo Bank 500 + 25 = 525 TL\nNet pozisyon: Atlas −525, Demo +525', span: ['sw', 'iss'] },
                  ]}
                />
                <Table
                  head={['Zaman', 'Banka', 'Kayıt', 'Tutar']}
                  rows={[
                    ['Gün 0', 'Atlas Bank (issuer)', 'Müşteri hesabı borç (çekim + ücret)', '525,00'],
                    ['Gün 0', 'Demo Bank (acquirer)', 'ATM nakit çıkışı; BKM’den alacak (simülatörde çekim + ücret)', '500,00 nakit · 525,00 alacak'],
                    ['Gün +1 · takas', 'Atlas Bank', 'Net pozisyon (borçlu)', '−525,00'],
                    ['Gün +1 · takas', 'Demo Bank', 'Net pozisyon (alacaklı)', '+525,00'],
                  ]}
                />
                <Notes
                  items={[
                    <>Müşterinin hesabı <b>anında</b>, host tarafında borçlanır; takas yalnızca bankalar arası borcu kapatır. Takas, müşteri hesabına ayrıca kayıt yazmaz (yalnızca EFT ve çek takası yazar).</>,
                    <>Takas oturumu on-us işlemleri (issuer = acquirer) <b>hiç</b> hesaba katmaz: banka içidir.</>,
                    <>Takastan önce gelen bir iptal işlemi hiç hesaplamaz. Takas geçtikten sonra gelen iptal, bir sonraki oturumda <b>eksi düzeltme</b> olarak girer.</>,
                    <>Simülatör ücretin tamamını issuer’dan acquirer’a taşır. Gerçekte ücretin issuer ve acquirer arasındaki paylaşımı ağ kurallarına ve anlaşmalara bağlıdır; doğrulayın.</>,
                  ]}
                />
                <TryInSim>Elif Demir’in kartıyla (PIN 0000) ATM00684’te 500 TL çekin (ücret ekranını onaylayın). Servis → Takas &amp; Mutabakat sekmesinde “Takas oturumunu çalıştır” basın: BKM tablosu Atlas Bank → Demo Bank, 1 işlem, 500 TL, ücret 25 TL, ödenecek 525 TL; Net pozisyonlarda Atlas −525, Demo +525. Sonra ATM77120’de Ayşe ile çekip yönün tersine döndüğünü görün.</TryInSim>
              </>
            ),
          },
          {
            label: '6 · Gün sonu farkı bulunur ve çözülür',
            content: (
              <>
                <Sequence
                  label="Zaman aşımına uğramış çekim, SAF’ta bekleyen iptal; gün sonu önce 95, sonra 00"
                  actors={[ACT.atm, ACT.host]}
                  steps={[
                    { note: 'Önce: 500 TL çekim zaman aşımı, iptal SAF’ta', at: 'atm', tone: 'warn' },
                    { sep: '1. gün sonu' },
                    { from: 'atm', to: 'host', label: '0500 · borç 0 adet · 0,00', sub: 'dönem N', tone: 'ok' },
                    { note: 'Host: cash_out 1 · 500,00\n(iptali yok) → fark −1 · −500,00', at: 'host', tone: 'bad' },
                    { from: 'host', to: 'atm', label: '0510 · 39 = 95', sub: 'mutabakat farkı · dönem açık', res: true, tone: 'bad' },
                    { sep: 'Çözüm' },
                    { from: 'atm', to: 'host', label: '0420 · SAF gönderimi', sub: 'neden 68, alan 90', tone: 'warn' },
                    { note: 'Host: reversal kaydı\nbakiye iade edildi', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'atm', label: '0430 · 39=00', res: true, tone: 'ok' },
                    { sep: '2. gün sonu' },
                    { from: 'atm', to: 'host', label: '0500 · borç 0 adet · 0,00', tone: 'ok' },
                    { note: 'Host: iptal edilmiş çekim sayılmaz\n0 · 0,00 → fark yok', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'atm', label: '0510 · 39 = 00', sub: 'dönem N kapandı', res: true, tone: 'ok' },
                  ]}
                />
                <Table
                  head={['', 'ATM', 'Host', 'Fark', 'Sonuç']}
                  rows={[
                    ['1. gün sonu · borç', '0 · 0,00', '1 · 500,00', '−1 · −500,00', '95: dönem açık'],
                    ['1. gün sonu · alacak', '0 · 0,00', '0 · 0,00', '0 · 0,00', '—'],
                    ['SAF gönderiminden sonra · borç', '0 · 0,00', '0 · 0,00', '0 · 0,00', '00: dönem N+1’e geçer'],
                  ]}
                />
                <Notes
                  items={[
                    <>Fark = ATM − host. Eksi bir adet ve eksi 500 TL: host bir çekim borçlandırmış, ATM para vermemiş.</>,
                    <>Fark, hesabını bilen biri için yönlendiricidir: “SAF kuyruğunda iptal bekliyor” (Teknisyen sekmesi) ile aynı tutar.</>,
                    <>İptal sonrası host kendi defterinden çekimi düşer (iptal edilmiş çekim sayılmaz); ATM sayaçları zaten sıfırdır, fark kapanır.</>,
                    <>Dönem tutunca ATM sayaçları sıfırlanır, host kayıtları <code>settled</code> olur ve yeni dönem başlar. Tutmayan dönem açık kalır.</>,
                    <>Gerçek hayatta çözüm kök neden analizini de içerir: zaman aşımı neden oldu, SAF neden hemen gönderilemedi?</>,
                  ]}
                />
                <TryInSim>Arıza → “Host yanıtı kaybolur” ile Ayşe’den 500 TL çekin. Teknisyen → Bakım moduna al → “Gün sonu (0500)”: Takas &amp; Mutabakat sekmesinde borç satırında fark −1 · −500 TL ve “fark var (95)”. Sonra “SAF kuyruğunu gönder”, ardından “Gün sonu (0500)”i tekrarlayın: fark 0, “Dönem tuttu” rozeti.</TryInSim>
              </>
            ),
          },
        ]}
      />

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['Yetki host’u', 'İşlemin yapılıp yapılamayacağına karar veren ve hesabı güncelleyen taraf; ATM sürücü uygulamasından farklıdır'],
          ['Yaşam döngüsü', 'RECEIVED → VALIDATED → AUTHORIZED → POSTED → COMPLETED; sonra REVERSED, SETTLED, CLEARED'],
          ['Yetki / finansal / takas', 'Karar, para hareketi ve bankalar arası netleşme farklı katmanlarda farklı anlarda olur'],
          ['Defter / kullanılabilir bakiye', 'Defter işlenmiş hareketlerin toplamı; kullanılabilir bakiye provizyonları düşer'],
          ['Kimlikler', 'STAN, RRN, onay kodu, kayıt id; izlenebilirlik için her sistem öncekinin kimliğini saklar'],
          ['Idempotentlik', 'Aynı istek ikinci kez gelince aynı sonuç döner, ikinci kez işlenmez'],
          ['İptal kuralı', 'Para çıktıysa iptal yok; çıkmadıysa ve host borçladıysa iptal; sonuç bilinmiyorsa para verme ve iptal et'],
          ['SAF', 'Yanıtsız kalan iptalin saklanıp tekrarlanması; kaybolması mutabakat farkı doğurur'],
          ['Limitler', 'Sıra: tutar (13), bakiye (51), günlük limit (61), kupür planı (86)'],
          ['Mutabakat seviyeleri', 'Kasa, ATM ↔ host, host ↔ core, switch/host ↔ ağ; her biri ayrı tutmalı'],
          ['İstisna süreci', 'Tespit, kanıt, sınıflandırma, düzeltme kaydı, kapanış; kayıt silinmez, ters kayıtla düzeltilir'],
          ['Güvenlik', 'İmzalı kısa ömürlü token, HSM, PAN maskeleme, hassas veriyi saklamama'],
          ['Gözlem', 'Korelasyon kimliği ve iş metrikleri: onay oranı, zaman aşımı, SAF derinliği, açık fark'],
        ]}
      />
      <p className="tr-next">
        İlgili konular: <a href="#/egitim/switch">Switch uygulaması →</a> · <a href="#/egitim/iso8583">ISO 8583 →</a>
      </p>
    </>
  )
}
