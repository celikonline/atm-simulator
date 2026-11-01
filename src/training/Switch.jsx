import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- ortak oyuncular
const ACT = {
  atm: { id: 'atm', label: 'ATM', sub: 'Terminal' },
  sw: { id: 'sw', label: 'ATM Switch', sub: 'Acquirer tarafı' },
  host: { id: 'host', label: 'Banka Host', sub: 'InterAPI · Core · HSM' },
  bkm: { id: 'bkm', label: 'BKM', sub: 'Ulusal ağ' },
  iss: { id: 'iss', label: 'Karşı Banka', sub: 'Issuer' },
  api: { id: 'api', label: 'InterAPI', sub: 'Entegrasyon katmanı' },
  hsm: { id: 'hsm', label: 'HSM', sub: 'PIN doğrulama' },
  core: { id: 'core', label: 'Core Banking', sub: 'Hesap / defter' },
}

export default function Switch() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Sistem mimarisi"
        title="Switch uygulaması"
        lead="ATM ile bankanın arasındaki trafik polisi: gelen her isteği doğrular, nereye gideceğine karar verir, yanıtı bekler, gelmezse ne yapılacağını bilir. Simülatörün Mesaj akışı panelinde gördüğünüz “ATM → ATM Switch → …” zincirinin ilk halkası budur."
      />

      <h2 id="giris">Switch nedir?</h2>
      <p>
        ATM switch (ödeme switch’i, <i>transaction switch</i>), kart kaynaklı işlemleri bir uçtan alıp doğru hedefe ileten ve yanıtı geri taşıyan
        uygulamadır. Bir bankanın ATM filosu düşünün: yüzlerce terminal, her biri farklı yazılım sürümü ve protokol konuşabilir; karşı tarafta ise
        bankanın kendi host’u, ulusal ağ (Türkiye’de BKM) ve uluslararası şemalar (Visa, Mastercard, Troy) vardır. Switch bu iki dünyanın arasında
        durur ve ikisini birbirinden yalıtır.
      </p>
      <ul>
        <li>
          <b>Acquirer tarafı switch:</b> ATM’lerin bağlı olduğu bankanın (acquirer) switch’idir. Bu sayfa ağırlıklı olarak bunu anlatır. Kart
          başka bankaya aitse isteği ağa çıkarır.
        </li>
        <li>
          <b>Issuer tarafı:</b> kartı çıkaran bankanın host’udur. <a href="#/egitim/host">ATM host ve transaction yönetimi</a> sayfasında ele
          alınır. Küçük kurumlarda iki rol aynı üründe de çalışabilir.
        </li>
        <li>
          <b>Ürünler:</b> piyasada kullanılan switch yazılımlarına örnek olarak ACI Worldwide’ın BASE24 ailesi (BASE24-eps gibi) ve Postilion’ı
          verilebilir; birçok banka ise kendi yazdığı (in-house) switch’i kullanır. Ürün adları, sürümleri ve sahiplik bilgisi zamanla değişir,
          karar vermeden önce üreticinin güncel sayfalarından <b>doğrulayın</b>. Bu sayfa belirli bir ürünün özelliklerini anlatmaz.
        </li>
      </ul>
      <Callout title="Simülatörle ilişkisi">
        Simülatörde “Switch” ayrı bir yazılım olarak çalışmaz; her işlemin yolunda bir durak olarak çizilir. Gerçek davranışları (BIN yönlendirme
        kararı, hop süreleri, ağa çıkış) Python tarafında <code>_route</code> fonksiyonu <i>trace</i> üreterek taklit eder. Sayfada
        <Sim>sim</Sim> işaretli kısımlar kodda doğrulanmış davranışlardır; “gerçekte” diye başlayan kısımlar simülatörün basitleştirdiği yerlerdir.
      </Callout>

      <h2 id="gorevler">Switch’in sorumlulukları</h2>
      <p>Bir switch’i “mesajı bir yerden alıp başka yere yollayan” bir proxy sanmak en sık yapılan hatadır. Asıl iş, aradaki kararlar ve hata yönetimidir.</p>
      <Table
        head={['Sorumluluk', 'Ne yapar', 'Simülatörde']}
        rows={[
          [<b key="1">Terminal ve oturum yönetimi</b>, 'Terminali tanır (profil), bağlantıyı açık tutar (sign-on, echo), işlem oturumunu izler.', <>Terminal kimliği (alan 41) acquirer bankayı belirler. İşlem oturumu 300 sn geçerli imzalı token; süresi dolunca 54. Terminal sign-on/echo yok.</>],
          [<b key="2">Protokol işleme</b>, 'ATM ile NDC/DDC ya da kuruma özel protokol, ağ ile ISO 8583 konuşur.', 'ATM → Switch hop’u “NDC / ISO 8583 · TLS 1.2” etiketli; Switch → InterAPI REST/JSON (mTLS). Gerçek NDC çözümlemesi yok.'],
          [<b key="3">Mesaj doğrulama</b>, 'Biçim, zorunlu alanlar, tutar aralığı, MAC, terminal yetkisi.', 'Tutar sıfırdan büyük ve 10’un katı olmalı (13), kart tanınmalı (14), token geçerli olmalı (54). Biçim/MAC doğrulaması yok.'],
          [<b key="4">BIN yönlendirme</b>, 'PAN’ın ilk hanelerine bakıp hedefi seçer: kendi host’u, ağ, başka switch.', 'Kartın bank alanı terminalin bankasıyla karşılaştırılır (on-us / not-on-us). PAN öneki tablosu yok.'],
          [<b key="5">Mesaj dönüşümü</b>, 'Terminal dilinden ağ diline alan eşleme.', 'İstek ISO 8583 alanlarıyla Olay günlüğünde gösterilir; arka uç REST/JSON’dur.'],
          [<b key="6">PIN çevirme ve MAC</b>, 'PIN bloğunu HSM’de bir anahtardan diğerine çevirir; MAC üretir/doğrular.', 'PIN doğrulama HSM durağından geçer. Anahtar çevirme ve MAC yok.'],
          [<b key="7">Fraud ve hız kontrolü</b>, 'Hız (velocity), kara liste, ülke/terminal kuralları; kararı host’a da bırakabilir.', 'Çekimde “Risk skoru” durağı var ama her zaman geçer; karar vermez.'],
          [<b key="8">Stand-in (STIP)</b>, 'Issuer’a ulaşılamazken önceden tanımlı kurallarla yerine karar verir.', 'Yok. Host’a ulaşılamazsa ATM 91 alır.'],
          [<b key="9">Store-and-forward</b>, 'Yanıtı alınamayan iptal ve advice mesajlarını saklayıp tekrar gönderir.', 'ATM tarafında SAF kuyruğu (Teknisyen sekmesi), iptal 0420 olarak tekrar gider.'],
          [<b key="10">Zaman aşımı yönetimi</b>, 'Her hop için süre tutar, süre dolunca kararı verir, geç gelen yanıtı ele alır.', 'Arıza sekmesi “Host yanıtı kaybolur” ile sonucu bilinmeyen işlemi üretir.'],
          [<b key="11">Mükerrer tespit</b>, 'Aynı isteğin ya da aynı iptalin ikinci kez işlenmesini engeller.', 'Host durumsuz olduğu için tam karşılığı yok (bkz. “Mükerrer isteği tanımak”).'],
          [<b key="12">İşlem günlüğü</b>, 'Her mesaj ve durum değişimi kalıcı yazılır (journal).', 'Olay günlüğü ve Servis → EJ sekmesi; host kayıtları imzalı kayıtlar (host book).'],
          [<b key="13">Settlement dosyası</b>, 'Gün sonu takas/mutabakat girdisini üretir.', 'Gün sonu (0500) ve Takas & Mutabakat sekmesi.'],
          [<b key="14">İzleme ve alarm</b>, 'TPS, gecikme, ret oranı, kuyruk derinliği, hat durumu.', 'Mesaj akışı panelinde hop süresi (ms), Olay günlüğü.'],
        ]}
      />

      <h2 id="mimari">Referans mimari</h2>
      <p>
        Ürünler farklı adlandırsa da çoğu switch aynı katmanlara ayrılır. Aşağıdaki akış, bir isteğin switch’e girdiği andan yanıtın terminale
        döndüğü ana kadar geçtiği halkaları sıralar.
      </p>
      <Flow
        items={[
          { title: 'Protokol işleyici (handler)', tag: 'NDC · DDC · ISO 8583', text: 'Terminal ya da ağ bağlantısını yönetir; ham baytı ortak bir iç mesaj modeline çevirir. Her bağlantı türünün kendi işleyicisi vardır, çekirdek protokolü bilmez.' },
          { title: 'Doğrulama ve oturum', tag: 'terminal profili · MAC · biçim', text: 'Terminal tanımlı mı, hizmette mi, bu işleme yetkili mi? Zorunlu alanlar ve MAC doğru mu? Başarısızsa istek burada, issuer’a gitmeden reddedilir.' },
          { title: 'Yönlendirici (router)', tag: 'BIN tablosu · kurallar', text: 'PAN’dan hedefi bulur: kendi issuer host’u, BKM, uluslararası şema ya da başka switch. Hedef kapalıysa alternatif yol ya da stand-in kuralına bakar.' },
          { title: 'Servis çağrıları', tag: 'HSM · fraud · limit · ücret', text: 'PIN çevirme, risk skoru, switch seviyesinde limit ve ücret hesabı. Bunlar yönlendirmeden önce ya da sonra çalışabilir.' },
          { title: 'Hedef bağlantı (connector)', tag: 'havuz · devre kesici · zamanlayıcı', text: 'İsteği hedefe iletir, zamanlayıcı başlatır, yanıtı STAN gibi anahtarlarla eşler. Hedef bağlantı sağlığını izler.' },
          { title: 'Yanıt dönüşümü', tag: 'alan 39 eşleme', text: 'Hedefin yanıt kodunu terminalin anlayacağı koda çevirir, ek verileri (bakiye, ücret) uygun alana koyar.' },
          { title: 'Günlük ve olay üretimi', tag: 'journal · SAF · settlement · metrik', text: 'İşlemin son durumu kalıcı yazılır; gerekiyorsa iptal/advice kuyruğa alınır, metrik ve alarm üretilir.' },
        ]}
      />
      <p>Simülatörün gerçek işlem trace’i bu yapının sadeleştirilmiş halidir. Ayşe Yılmaz’ın Demo Bank ATM’sinde PIN doğrulayıp 500 TL çekmesi şöyle çizilir:</p>
      <Sequence
        label="Simülatörde on-us çekimin host tarafı (hop süreleri demo değerlerdir)"
        actors={[ACT.atm, ACT.sw, ACT.api, ACT.hsm, ACT.core]}
        steps={[
          { sep: 'PIN doğrulama (0100)' },
          { from: 'atm', to: 'sw', label: 'NDC / ISO 8583 · TLS', sub: '18–40 ms', tone: 'ok' },
          { from: 'sw', to: 'api', label: 'REST/JSON · mTLS', sub: '8–20 ms', tone: 'ok' },
          { from: 'api', to: 'hsm', label: 'PIN doğrulama', sub: '4–12 ms', tone: 'ok' },
          { from: 'hsm', to: 'api', label: 'PIN doğru', res: true, tone: 'ok' },
          { sep: 'Para çekme (0200)' },
          { from: 'atm', to: 'sw', label: 'NDC / ISO 8583 · TLS', sub: '18–40 ms', tone: 'ok' },
          { from: 'sw', to: 'api', label: 'REST/JSON · mTLS', sub: '8–20 ms', tone: 'ok' },
          { note: 'InterAPI önce fraud durağına\n“risk skoru” sorar (5–15 ms)', at: 'api' },
          { from: 'api', to: 'core', label: 'Provizyon + borç kaydı', sub: '20–45 ms', tone: 'ok' },
          { from: 'core', to: 'api', label: 'Onay', res: true, tone: 'ok' },
        ]}
      />
      <Callout tone="warn" title="Simülatör neyi basitleştiriyor?">
        Switch’in kendi kararı yok: yönlendirme, zamanlayıcı ve dönüşüm kodda yalnızca trace satırı olarak var. Hop süreleri her istekte rastgele
        üretilen demo değerlerdir; gerçek hat gecikmesi gibi okumayın.
      </Callout>
      <TryInSim>Ayşe Yılmaz’ın Visa kartını (PIN 1234) ATM00684’e takıp 500 TL çekin. Sağ üstteki Mesaj akışı panelinde durakların sırayla yandığına, Olay günlüğünde her hop’un protokol ve ms değerine bakın. PIN doğrulamada HSM, çekimde fraud ve core duraklarının yandığını görün.</TryInSim>

      <h2 id="protokoller">Terminal ve ağ protokolleri</h2>
      <p>
        Switch iki yöne protokol konuşur. Terminal tarafı ATM üreticisine ve kuruma göre değişir, ağ tarafı ise büyük oranda ISO 8583’tür (ayrıntı için{' '}
        <a href="#/egitim/iso8583">ISO 8583</a> sayfası).
      </p>
      <Table
        head={['Taraf', 'Protokol', 'Not']}
        rows={[
          [<b key="1">ATM → Switch</b>, 'NDC / DDC (NCR ve Diebold Nixdorf ailelerinin terminal protokolleri) ya da kuruma özel protokol', 'ATM yazılımı (ör. APTRA) bu protokolü konuşur; çekim ve ekran akışını host bu protokolle yönetebilir. Ayrıntı ve sürüm davranışları üreticiye bağlıdır, ilgili dokümandan doğrulayın.'],
          [<b key="2">Switch → Issuer host</b>, 'ISO 8583 (TCP üzerinden), REST/JSON ya da kuruma özel API', 'Eski host’lar ISO 8583 bekler; modern çekirdekler genelde API sunar ve switch dönüşümü yapar.'],
          [<b key="3">Switch → Ulusal ağ / şema</b>, 'ISO 8583, ağa özel lehçe', 'Alan kullanımı, MAC ve anahtar yönetimi ağ şartnamesinde tanımlıdır.'],
          [<b key="4">Switch → Switch</b>, 'ISO 8583 ya da ISO 20022 (ödeme sistemlerinde)', <>Havale/EFT/FAST tarafı <a href="#/egitim/iso20022">ISO 20022</a> kullanır; simülatör bunu InterAPI → FAST hop’unda etiketler.</>],
          [<b key="5">Yönetim</b>, '0800 ağ yönetimi (sign-on, echo, anahtar değişimi)', 'Hat canlılığını ve anahtar yenilemeyi taşır; işlem değildir.'],
        ]}
      />
      <Callout title="Kanal güvenliği">
        Hatların TLS ya da özel hat ile korunması beklenir. PIN ayrıca kendi katmanında şifrelidir: ağ kanalı çözülse bile PIN bloğu açık gitmez.
      </Callout>

      <h2 id="yonlendirme">BIN yönlendirme: on-us ve off-us</h2>
      <p>
        Yönlendirmenin ilk sorusu şudur: kartı çıkaran banka ben miyim? Switch PAN’ın ilk hanelerini (BIN, kart numarası aralığı) bir tabloda arar ve
        hedefi bulur. Kart ATM’nin sahibi bankaya aitse <b>on-us</b> (host’a yerel yol), başka bankaya aitse <b>off-us / not-on-us</b> (ağa çıkış) kuralı işler.
      </p>
      <Flow
        items={[
          { title: 'Kart verisinden BIN okunur', tag: 'alan 2 / track 2', text: 'PAN’ın ilk 6–8 hanesi tablo anahtarıdır.' },
          { decision: true, title: 'BIN tablosunda kim çıkardı?', branches: [{ label: 'Bu banka · on-us', text: 'İstek kendi host’a gider. Simülatörde: Switch → InterAPI → HSM / fraud / core.', tone: 'ok' }, { label: 'Başka banka · off-us', text: 'İstek ağa çıkar. Simülatörde: Switch → BKM → Karşı Banka. PIN, bakiye ve provizyon orada yapılır.', tone: 'warn' }, { label: 'Tabloda yok', text: 'Switch isteği reddeder (geçersiz kart).', tone: 'bad' }] },
          { title: 'Off-us ise ücret ve kısıt kuralları uygulanır', tag: 'ücret · işlem türü', text: 'Başka banka kartından alınan işlem ücreti müşteriye gösterilir. Bazı işlemler off-us’ta hiç açılmaz.' },
        ]}
      />
      <Table
        head={['Kural', 'Simülatörde değer', 'Kaynak (kod)']}
        rows={[
          ['Terminal → acquirer banka', 'ATM00684 → 00061 Demo Bank, ATM77120 → 00099 Atlas Bank', <code key="a">TERMINALS</code>],
          ['On-us testi', 'Kartın bank kodu = terminalin bank kodu', <code key="b">_on_us</code>],
          ['Off-us çekim ücreti', '25 TL (bakiye sorgu 3 TL)', <code key="c">OFF_US_FEES</code>],
          ['Off-us’ta açık işlemler', 'Menüde yalnızca çekim ve bakiye sorgu görünür. Para yatırma, fatura, transfer, çek, kredi kartı ödemesi host’ta ayrıca 58 ile reddedilir', <code key="d">_require_on_us</code>],
          ['Off-us trace', 'atm → switch → bkm → issuer (PIN dahil her şey issuer’da)', <code key="e">_route</code>],
        ]}
      />
      <Callout tone="warn" title="Tanımsız terminal">
        Simülatör bilinmeyen bir terminal kimliğini sessizce Demo Bank’a bağlar (<code>_terminal_bank</code> varsayılanı). Gerçek bir switch tanımsız terminali
        reddeder; yanlış kuruma bağlanan bir terminal doğru ücret ve takas yönü demek değildir.
      </Callout>
      <TryInSim>Elif Demir’in Atlas Bank kartını (PIN 0000) ATM00684’e takın: PIN adımında iz Switch → BKM → Karşı Banka olur, ücret bildirimi çıkar. Sonra sağ üstten ATM77120 · Atlas Bank’ı seçip aynı kartı deneyin: artık on-us, BKM durağı yanmaz ve ücret yok. Ayşe’nin kartını ATM77120’ye takın: off-us olduğu için menüde yalnızca Para Çekme ve Bakiye Sorgulama kalır.</TryInSim>

      <h2 id="donusum">Mesaj dönüşümü</h2>
      <p>
        Terminal ve host aynı dili konuşmaz. Switch her yönde alanları eşler, değerleri çevirir, eksikleri üretir. Aşağıdaki tablo, bir nakit çekimin
        simülatördeki istek gövdesinden ISO 8583 alanlarına nasıl eşlendiğini gösterir; üçüncü sütun gerçek ağ lehçelerinde olabilecek farkları işaretler.
      </p>
      <Table
        head={['Kavram', 'Kaynak taraf (simülatör)', 'ISO 8583 alanı', 'Ağ lehçesinde olabilecek fark']}
        rows={[
          ['Kart numarası', 'Kart okunan PAN (günlükte maskeli)', '2', 'Uzunluk öneki, maskeleme kuralı ağa göre değişir.'],
          ['İşlem türü', 'Çekim, hesap türü vadesiz', '3 = 010000', 'Kredi kartı nakit avansında hesap türü 30 (sim: 013000).'],
          ['Tutar', 'Kuruş cinsinden tam sayı (500 TL)', '4 = 000000050000', 'Para birimi 49 ile birlikte okunur; ağ başka para birimine çevirebilir.'],
          ['Zaman', 'Terminal yerel saati', '7, 12, 13', 'Alan 7 çoğu ağda GMT ister; switch saati çevirir.'],
          ['Sıra no', 'ATM işlem sayacı', '11 (STAN)', 'Switch ağa kendi STAN’ını verip eşleştirme tablosu tutabilir.'],
          ['Terminal', 'ATM00684', '41', 'Alan 42/43 (kabul eden adı, yeri) switch tarafından eklenir.'],
          ['Acquirer', 'Terminal profilinden', '32', 'Off-us’ta switch ekler (ağ için zorunlu).'],
          ['Ücret', 'Müşteriye gösterilen tutar', '28 = D00002500', 'Ücret alanı ağa göre ayrı, ya da tutara dahil olabilir.'],
          ['PIN', 'EPP’de şifrelenmiş blok', '52', 'Anahtar ağa göre değişir; switch HSM’de çevirir.'],
          ['Sonuç', 'Host yanıtı', '39', 'Ağın kodu terminal kodlarına eşlenir (ör. birkaç farklı red nedeni tek “reddedildi”ye iner).'],
        ]}
      />
      <p>
        Yanıt yönü de aynı derecede önemlidir. Ağdan 14 farklı red kodu gelse bile ATM’nin ekranda gösterecek yalnızca birkaç metni vardır. Eşleme
        tablosu yanlış kurulursa müşteri “bakiye yetersiz” yerine “sistem arızası” görür ya da daha kötüsü, kartı alıkonması gereken bir red sıradan
        reddedilmiş olarak ATM’ye döner.
      </p>

      <h2 id="pin-mac">PIN çevirme ve MAC</h2>
      <p>
        ATM’nin tuş takımı (EPP) PIN’i terminal anahtarıyla şifreler. Switch bu bloğu <b>hiç açık görmez</b>: HSM içinde, terminal anahtarından
        (genelde bölge/zone PIN anahtarı) hedefin anahtarına çevrilir (<i>PIN translation</i>). Böylece her bağlantının kendi anahtarı olur, bir hattın
        anahtarı ele geçirilse bile diğerleri etkilenmez.
      </p>
      <Sequence
        label="PIN bloğu anahtar çevirme (kavramsal)"
        actors={[ACT.atm, ACT.sw, ACT.hsm, ACT.host]}
        steps={[
          { from: 'atm', to: 'sw', label: 'PIN bloğu · terminal anahtarı', sub: 'alan 52', tone: 'ok' },
          { from: 'sw', to: 'hsm', label: 'Çevir: terminal → host', sub: 'açık PIN HSM dışına çıkmaz', tone: 'ok' },
          { from: 'hsm', to: 'sw', label: 'PIN bloğu · host anahtarı', res: true, tone: 'ok' },
          { from: 'sw', to: 'host', label: '0100 / 0200 · alan 52', sub: 'yeni anahtarla şifreli', tone: 'ok' },
          { note: 'Host HSM’i PIN’i doğrular\n(PIN doğrulama verisi ile)', at: 'host' },
        ]}
      />
      <Notes
        items={[
          <>Switch yalnızca <b>şifreli</b> bloğu taşır ve HSM’ye “bu anahtardan şu anahtara çevir” der. Çevrilmiş bloğu da açık göremez.</>,
          <>Ağ tarafında anahtarlar belirli aralıklarla değişir (0800, alan 70 = 101). Anahtar değişimi sırasında iki anahtarın bir süre birlikte geçerli olması gerekir.</>,
          <><b>MAC</b> (alan 128 / 64) mesajın kurcalanmadığını ve doğru kaynaktan geldiğini gösterir. Switch gelen MAC’i doğrular, giden mesaja yeni MAC ekler; ikisi de HSM işidir.</>,
          <>Simülatörde: PIN doğrulama çağrısı InterAPI → HSM durağından geçer. PIN yalnızca <i>tuzlu SHA-256 hash</i> olarak karşılaştırılır; bu demo yöntemidir. Gerçekte PIN hash’i saklanmaz, doğrulama HSM içinde doğrulama verisiyle yapılır. Anahtar çevirme ve MAC simülatörde yok.</>,
        ]}
      />

      <h2 id="risk">Fraud ve hız kontrolü</h2>
      <p>
        Switch tüm trafiği gördüğü için kural işletmek için en uygun yerlerden biridir. Hız (<i>velocity</i>) kuralları aynı kartın kısa sürede çok işlem
        yapmasını, aynı terminalde art arda ret almasını ya da alışılmadık ülke/terminal birleşimini yakalar. Karar kuralı (reddet, bayrakla, issuer’a
        bildir) kuruma aittir.
      </p>
      <ul>
        <li>
          Fraud kontrolü <b>issuer yetkilendirmesinden önce</b> (reddetmek ucuz) ya da <b>paralel</b> (gecikme düşük) çalışabilir. Zaman bütçesi dar olduğu için
          çağrının kendisine de zaman aşımı konur: fraud servisi cevap vermezse varsayılan karar kuruma bağlıdır (geçir ya da reddet), önceden yazılı olmalıdır.
        </li>
        <li>
          Sonuç mesaja işaret olarak eklenip issuer’a taşınabilir; nihai karar çoğu zaman issuer’dadır.
        </li>
        <li>
          Simülatörde çekim ve transfer yolunda “Risk skoru” durağı vardır ve her zaman geçer. Bu durak risk kararı <b>vermez</b>; yalnızca yerini gösterir.
        </li>
      </ul>

      <h2 id="stip">Stand-in processing (STIP)</h2>
      <p>
        Issuer’a ulaşılamadığında switch’in, issuer’ın önceden verdiği parametrelerle onay ya da red vermesine <b>stand-in</b> denir. Amaç müşteriyi
        mağdur etmemek ama riski sınırlamaktır.
      </p>
      <Table
        head={['Konu', 'Tipik uygulama']}
        rows={[
          ['Ne zaman devreye girer?', 'Issuer bağlantısı kapalı (devre kesici açık), zaman aşımı ya da issuer’ın “gece bakımı” gibi planlı kesintisi.'],
          ['Hangi kurallarla?', 'Issuer’ın tanımladığı kart bazlı ya da toplu limitler: tek işlem üst sınırı, stand-in dönemi toplam limiti, kara liste (negative file), PIN deneme sayacı.'],
          ['Nelere izin verilmez?', 'Kurum politikasıdır. Çoğu kurum yüksek tutarlı nakit çekimi ve PIN doğrulamasının yapılamadığı durumları stand-in dışında tutar. Sınırlarınızı issuer ile yazılı belirleyin; doğrulayın.'],
          ['Sonrası', <>Issuer geri geldiğinde <b>advice (0220)</b> ile işlem ona bildirilir. Advice reddedilemez: issuer işlemi hesaba yansıtmak zorundadır, bakiye eksiye düşebilir. Bu risk issuer ve acquirer arasındaki anlaşmayla yönetilir.</>],
        ]}
      />
      <Callout tone="warn" title="Simülatörde stand-in yok">
        Host’a ulaşılamadığında (örneğin yerelde API’yi durdurmak) ATM işlemi 91 ile bitirir. “Stand-in onay + sonradan 0220” akışı yalnızca kavramsal
        olarak aşağıda 6. senaryoda gösterilir.
      </Callout>

      <h2 id="zaman-asimi">Zaman aşımı zinciri ve geç yanıt</h2>
      <p>
        Bir işlemin yolundaki her halkanın kendi zamanlayıcısı vardır. Altta kalan halkanın süresi üsttekinden <b>kısa</b> olmalıdır: ağ 20 sn, switch 25 sn,
        ATM 30 sn gibi (örnek değerler; gerçek süreleri ağ şartnamesi ve kurum politikası belirler). Aksi halde ATM zaman aşımına uğramışken alttaki bekliyor
        olur ve switch “bilmediği” bir işlemin sonucunu taşır.
      </p>
      <Table
        head={['Olay', 'Switch’in kararı', 'Neden']}
        rows={[
          ['Issuer süresinde yanıtladı', 'Yanıtı terminale ilet, durumu “tamamlandı” yap.', 'Normal akış.'],
          ['Süre doldu, yanıt yok', <>Terminale ret/zaman aşımı kodu (ör. 91; ağa göre doğrulayın) dön, işlemi “zaman aşımı” durumuna al, issuer’a <b>otomatik iptal (0400)</b> hazırla.</>, 'Issuer onaylamış olabilir; müşteri para almadı, borç iade edilmeli.'],
          ['Süre dolduktan sonra yanıt geldi (geç yanıt)', 'Yanıtı terminale İLETME. İşlem “zaman aşımı” durumunda olduğu için yanıt eşlenir, onaysa iptal (0400) gönderilir ya da zaten gönderilmişse tekrar edilir.', 'Terminal artık başka bir işlemde olabilir; geç yanıtı yanlış işleme bağlamak felakettir.'],
          ['İptale de yanıt yok', 'İptali SAF kuyruğuna al, ağ yönetim mesajıyla hat dönene kadar aralıklarla 0420 olarak tekrar dene.', <>İptal kaybolamaz. Tekrar zamanlaması ve üst sınırı tanımlıdır (simülatörde 24 saat, <code>REVERSAL_TTL</code>).</>],
        ]}
      />
      <TryInSim>Servis → Arıza sekmesinde “Host yanıtı kaybolur”u işaretleyip Ayşe’nin kartıyla 500 TL çekin. Hesap borçlanır ama ATM para vermez; Olay günlüğünde “zaman aşımı” ve “İptal mesajı SAF kuyruğuna alındı” satırlarını görün. Teknisyen sekmesinde SAF kuyruğunun 1 olduğuna bakın.</TryInSim>

      <h2 id="mukerrer">Mükerrer isteği tanımak ve iptali eşleştirmek</h2>
      <p>
        Ağ güvenilmezdir: aynı mesaj iki kez gelebilir (ATM tekrar gönderdi, hat tekrarladı) ya da hiç gelmeyebilir. Switch’in bunu bilmesi için her işlemi
        <b> doğal bir anahtarla</b> kaydetmesi gerekir. En sık kullanılan birleşim:
      </p>
      <Table
        head={['Parça', 'Alan', 'Neden gerekli']}
        rows={[
          [<b key="1">STAN</b>, '11', 'Terminalin işlem sıra numarası. Tek başına yetmez: gün içinde tekrar edebilir.'],
          [<b key="2">Tarih / saat</b>, '7, 12, 13', 'STAN’ın tekrar ettiği iki farklı günü ayırır.'],
          [<b key="3">Terminal</b>, '41', 'Her terminalin sayacı ayrıdır.'],
          [<b key="4">Acquirer kodu</b>, '32', 'Birden çok acquirer aynı switch’i kullanıyorsa terminal kimlikleri çakışabilir.'],
        ]}
      />
      <p>
        İptal mesajında (0400/0420) asıl işlemi bulmak için <b>alan 90</b> kullanılır: orijinal MTI, STAN, tarih/saat, acquirer ve forwarding kurum
        kodu. Switch önce bu anahtarla asıl işlemi bulur, sonra “bu iptal daha önce işlendi mi?” sorusuna bakar. <b>İptal idempotent olmalıdır</b>: ikinci
        0420 geldiğinde borç ikinci kez iade edilmez; kayıtlı sonuç tekrar döner.
      </p>
      <Table
        head={['Neyi doğruladığımız', 'Simülatörde']}
        rows={[
          ['İptal asıl işleme bağlı mı?', <>Evet. Çekim yanıtındaki imzalı <code>reversal_token</code> asıl işlemin kart, terminal, tutar, ücret, STAN, tarih ve RRN’sini taşır; alan 90 buradan üretilir (<code>0200 + STAN + tarih + acquirer</code>).</>],
          ['İptal başka terminalden gönderilemez', 'Evet. Token’daki terminal ile istek terminali farklıysa 05.'],
          ['Aynı iptal iki kez işlenmez', <>Host durumsuz olduğu için bu kontrol <b>istemcide</b>: SAF kuyruğundaki öğe onaylanınca kuyruktan çıkar. Host aynı token’la ikinci çağrıyı sunucu tarafında engellemez; gerçek bir switch/host engeller.</>],
          ['Defterde çift kayıt oluşmaz', <>Kısmen. Gün sonu ve takas kayıtları id ile tekilleştirir (iptal kaydının id’si <code>R + RRN</code>), böylece bir iptal mutabakatta iki kez sayılmaz.</>],
        ]}
      />

      <h2 id="durum">Switch içinde işlem durum makinesi</h2>
      <p>
        Switch her işlemi bir durum makinesiyle takip eder. Durum bilinmeden zaman aşımı, geç yanıt ve mükerrer isteğe doğru karar verilemez. Aşağıdaki durumlar
        kavramsaldır, ürüne göre adlar ve ayrıntı değişir.
      </p>
      <Table
        head={['Durum', 'Girişi tetikleyen', 'Switch’in yaptığı', 'Çıkış']}
        rows={[
          [<b key="1">ALINDI</b>, 'Terminalden istek geldi', 'Ham mesajı iç modele çevir, journal’a yaz.', 'DOĞRULANDI ya da YEREL RET'],
          [<b key="2">DOĞRULANDI</b>, 'Biçim, MAC, terminal ve oturum geçerli', 'BIN’den hedefi seç, PIN çevir, fraud sor.', 'YÖNLENDİRİLDİ ya da YEREL RET'],
          [<b key="3">YÖNLENDİRİLDİ</b>, 'Hedef seçildi', 'İsteği gönder, zamanlayıcı başlat.', 'YANITLANDI, ZAMAN AŞIMI, STIP ONAY'],
          [<b key="4">YANITLANDI</b>, 'Hedefin yanıtı süresinde geldi', 'Yanıtı dönüştür ve terminale ilet.', 'TAMAMLANDI'],
          [<b key="5">ZAMAN AŞIMI</b>, 'Süre doldu', 'Terminale ret/zaman aşımı kodu dön; otomatik iptal hazırla.', 'İPTAL BEKLİYOR, GEÇ YANIT'],
          [<b key="6">GEÇ YANIT</b>, 'Süre dolduktan sonra yanıt geldi', 'Onaysa iptal gönder, terminale iletme.', 'İPTAL BEKLİYOR'],
          [<b key="7">İPTAL BEKLİYOR</b>, 'İptal kuyruğa alındı', 'SAF’ta bekle, aralıkla 0420 tekrar gönder.', 'İPTAL EDİLDİ'],
          [<b key="8">STIP ONAY</b>, 'Hedef kapalı, kurallar uygun', 'Yerel onay ver, advice kuyruğa al.', 'ADVICE BEKLİYOR → ADVICE GÖNDERİLDİ'],
          [<b key="9">YEREL RET</b>, 'Switch seviyesinde kural ihlali', 'Issuer’a hiç sormadan ret yanıtı üret.', 'TAMAMLANDI'],
          [<b key="10">TAMAMLANDI / İPTAL EDİLDİ</b>, 'Son durum', 'Journal’ı kapat, settlement dosyasına al.', 'Gün sonu'],
        ]}
      />
      <Flow
        items={[
          { title: 'ALINDI → DOĞRULANDI → YÖNLENDİRİLDİ', text: 'Mutlu yol: her adımda journal’a durum yazılır.' },
          { decision: true, title: 'Yanıt süresinde geldi mi?', branches: [{ label: 'Evet', text: 'YANITLANDI → TAMAMLANDI. Terminale yanıt gider.', tone: 'ok' }, { label: 'Hayır', text: 'ZAMAN AŞIMI. Terminale ret gider, otomatik iptal başlar.', tone: 'bad' }] },
          { title: 'İptal gönderilir', tag: '0400 → gerekirse 0420', text: 'Yanıt gelmezse SAF, gelirse İPTAL EDİLDİ. Süre sonradan yanıt gelirse yanıt iptali durdurmaz, tersine tetikler.' },
        ]}
      />

      <h2 id="kayit">İşlem günlüğü, settlement ve izleme</h2>
      <ul>
        <li>
          <b>Journal:</b> her mesaj ve durum değişimi, zaman damgasıyla kalıcı yazılır. Denetim, itiraz ve mutabakat için tek gerçek kaynaktır. Günlükte PAN
          maskelenir; PIN bloğu, track verisi ve CVV hiçbir yerde açık yer almaz.
        </li>
        <li>
          <b>Settlement dosyası:</b> gün sonunda, kesilen dönemin tamamlanmış işlemleri takas girdisine dönüşür (kim kime ne kadar borçlu). Simülatörde bu rol
          Takas &amp; Mutabakat sekmesidir; bir işlem önce 0500 ile mutabakata, sonra takas oturumuyla bankalar arası pozisyona girer.
        </li>
        <li>
          <b>İzleme:</b> en azından işlem hızı (TPS), yanıt gecikmesi yüzdelikleri, hedef bazlı ret ve zaman aşımı oranı, SAF kuyruk derinliği, hat durumu
          (sign-on, echo), eşleşmeyen yanıt sayısı. Alarm eşikleri kurum SLO’larından türetilir.
        </li>
      </ul>
      <TryInSim>Birkaç işlem yaptıktan sonra Servis → EJ sekmesine (ATM’nin kendi günlüğü) ve Olay günlüğüne (host/ISO satırları) bakın. İki kaydı karşılaştırın: ATM “VERİLDİ” yazarken host tarafında 0200/0210 çifti vardır. Gerçek bir mutabakat bu iki kaydı eşleştirir.</TryInSim>

      <h2 id="ha">Yüksek erişilebilirlik ve dayanıklılık</h2>
      <p>
        Switch durursa tüm ATM’ler durur. Bu yüzden erişilebilirlik tasarımın ilk maddesidir. Temel yöntemler:
      </p>
      <Table
        head={['Teknik', 'Ne sağlar', 'Dikkat edilecek']}
        rows={[
          [<b key="1">Active-active</b>, 'İki ya da daha fazla düğüm aynı anda trafik taşır. Kapasite ve kesinti dayanıklılığı sağlar.', 'İşlem durumu düğümler arasında paylaşılmalı ya da isteğin bütün ömrü tek düğümde geçmeli (aksi halde geç yanıt yanlış düğüme gider).'],
          [<b key="2">Active-passive</b>, 'Yedek düğüm hazırda bekler, hata olunca devralır.', 'Devralma süresi (RTO) ve devralma anında uçuştaki işlemlerin akıbeti tanımlı olmalı.'],
          [<b key="3">Oturum yakınlığı (session affinity)</b>, 'Bir terminalin ya da hedef bağlantının mesajları aynı düğüme gider.', 'Düğüm düşünce bağlantılar yeniden kurulur; yeniden bağlanan terminalin bekleyen işlemleri için kural gerekir.'],
          [<b key="4">Bağlantı havuzu</b>, 'Hedefe sınırlı sayıda kalıcı bağlantı. Her istekte bağlantı kurma maliyeti yok.', 'Havuz boyutu hedefin kapasitesini aşmamalı; dolu havuz bekleme kuyruğu değil, hızlı ret olmalı.'],
          [<b key="5">Devre kesici (circuit breaker)</b>, 'Hedef art arda hata/zaman aşımı verirse bağlantı “açılır”: istekler beklemeden hata döner.', 'Kapalı → açık → yarı açık döngüsü: belli süre sonra tek bir deneme (0800 echo) yapılır, başarılıysa kapanır.'],
          [<b key="6">Backpressure</b>, 'Hedef yavaşlayınca giriş hızı sınırlanır. Kuyruklar sınırsız büyümez.', 'Terminallere “sistem meşgul” dönmek, hepsini zaman aşımına uğratmaktan iyidir.'],
          [<b key="7">Zarif bozulma (graceful degradation)</b>, 'Kısmi arızada işlevlerin bir kısmı sürer: ör. yalnızca bakiye sorgu ve düşük tutarlı çekim açık.', 'Hangi işlemin hangi koşulda kapanacağı önceden kararlaştırılmalı.'],
        ]}
      />
      <Callout title="Neden devre kesici?">
        Host ölmüş ama her istek 25 sn bekleyip zaman aşımına uğruyorsa switch’in iş parçacıkları ve bağlantıları dolar; sağlam hedefler de etkilenir.
        Devre kesici, kötü hedefe hızlıca “hayır” demenin ve diğer trafiği korumanın yoludur. Simülatörde yok; 6. senaryoda akış gösterilir.
      </Callout>

      <h2 id="performans">Performans ve gecikme bütçesi</h2>
      <p>
        ATM işlemi kullanıcı karşısında bekleyen bir işlemdir. Toplam bütçeyi hop’lara bölmek gerekir; hangi halkanın bütçeyi aştığı izlemeyle görülür.
        <b> TPS</b> (saniyedeki işlem) ve <b>gecikme yüzdelikleri</b> (p50, p95, p99) birlikte ölçülür: ortalama iyi görünürken kuyruk gecikmesi zaman
        aşımına yol açabilir. Gerçek bütçe sayıları kurum, ağ ve donanım koşuluna bağlıdır; bu sayfada gerçek ölçüm verilmez.
      </p>
      <Table
        head={['Hop', 'Simülatörde süre (demo)', 'Ne zaman girer']}
        rows={[
          ['ATM → Switch', '18–40 ms', 'Her işlem'],
          ['Switch → InterAPI (on-us)', '8–20 ms', 'On-us'],
          ['InterAPI → HSM (PIN doğrulama)', '4–12 ms', 'PIN adımı'],
          ['InterAPI → Fraud', '5–15 ms', 'Çekim, transfer'],
          ['InterAPI → Core', '20–45 ms (çekim)', 'Çekim, bakiye, para yatırma'],
          ['Switch → BKM', '40–90 ms', 'Off-us'],
          ['BKM → Karşı Banka', '60–120 ms', 'Off-us'],
        ]}
      />
      <p>
        Bu süreleri toplarsak on-us çekim yaklaşık 51–120 ms, off-us çekim yaklaşık 118–250 ms çıkar (kodda tanımlı aralıkların toplamı; gerçek hat
        gecikmesi değildir). Önemli olan sayı değil, <b>off-us’un dış ağ yüzünden yapısal olarak daha yavaş</b> olması ve zaman aşımı sürelerinin bu farka
        göre ayarlanması gerektiğidir.
      </p>

      <h2 id="konfig">Konfigürasyon</h2>
      <p>
        İyi bir switch’te iş kuralları kodda değil, tablolarda durur: yeni bir ATM eklemek ya da bir bankanın hedefini değiştirmek yazılım dağıtımı
        gerektirmemelidir.
      </p>
      <Table
        head={['Tablo', 'İçerik', 'Simülatördeki karşılığı']}
        rows={[
          [<b key="1">Yönlendirme (BIN)</b>, 'BIN aralığı → hedef (host, ağ, switch), öncelik, yedek hedef', <>Kartın <code>bank</code> alanı. Gerçekte PAN önekine bakılır (demo kartlar 4543, 9792, 5400 → Demo Bank; 5170 → Atlas Bank).</>],
          [<b key="2">Terminal profili</b>, 'Terminal kimliği → acquirer, hangi işlemler açık, limitler, anahtar kimliği, konum', <code key="a">TERMINALS</code>],
          [<b key="3">Kurum tablosu</b>, 'Banka kodu → ad, bağlantı, takas yönü', <code key="b">BANKS</code>],
          [<b key="4">Limitler</b>, 'Günlük çekim tutarı, adet, tek işlem üst sınırı, kupür kümesi', <>Günlük 10.000 TL (61), tutar 10’un katı olmalı (13), dağıtılan kupürler 200/100/50/20.</>],
          [<b key="5">Ücret tarifesi</b>, 'İşlem türü ve kart türüne göre ücret, off-us kuralı', <code key="c">OFF_US_FEES</code>],
          [<b key="6">Zaman aşımı ve yeniden deneme</b>, 'Hedef bazlı süre, iptal tekrar aralığı ve üst sınırı', <>İptal ömrü 24 saat (<code>REVERSAL_TTL</code>), oturum 300 sn, kayıt ömrü 7 gün (<code>RECORD_TTL</code>).</>],
          [<b key="7">Yanıt kodu eşleme</b>, 'Hedef kodu → terminal kodu ve ekran metni', <code key="d">RESPONSE_TEXT</code>],
        ]}
      />
      <Callout tone="warn" title="Demo değerleri">
        Ücretler, limitler ve süreler demo değerleridir; gerçek tarifeleri ve mevzuatı yansıtmaz. Gerçek değerler için ilgili kurum ve ağ belgelerine
        başvurun.
      </Callout>

      <h2 id="test">Switch’i test etmek</h2>
      <ul>
        <li>
          <b>Simüle terminaller:</b> gerçek ATM olmadan binlerce terminal davranışı üretmek (yük ve hata senaryosu). Sahte host ile de karşı taraf taklit
          edilir: onay, red, gecikme, hiç yanıt verme.
        </li>
        <li>
          <b>Hata enjeksiyonu:</b> yanıtı geciktir, kaybet, iki kez gönder, geç gönder. Zaman aşımı, geç yanıt ve mükerrer iptal kodu ancak böyle
          sınanır. Simülatördeki Arıza sekmesi bunun küçük bir örneğidir.
        </li>
        <li>
          <b>Replay:</b> üretimden alınmış (maskelenmiş) trafiği test ortamında yeniden oynatıp çıktıları karşılaştırmak. Veriyi maskelemeden test ortamına
          taşımayın.
        </li>
        <li>
          <b>Ağ sertifikasyonu:</b> BKM, Visa, Mastercard gibi ağlara bağlanmadan önce ağın kendi test senaryolarını geçmek gerekir; kapsam ve süreç ağa
          göre farklıdır, ilgili ağın belgelerinden doğrulayın.
        </li>
        <li>
          <b>Mutabakat testi:</b> her test senaryosunda gün sonu toplamlarının tuttuğunu doğrulamak. Çoğu hata ancak mutabakatta görünür.
        </li>
      </ul>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Her senaryonun altında “Simülatörde dene” kutusu, o davranışın simülatörde ne kadarının var olduğunu açıkça söyler.{' '}
        <span className="tr-key ok">Yeşil</span> oklar başarılı, <span className="tr-key bad">kırmızı</span> oklar red/hata, kesikli oklar yanıttır.
      </p>
      <Tabs
        label="Switch senaryoları"
        tabs={[
          {
            label: '1 · Normal yönlendirme (on-us)',
            content: (
              <>
                <Sequence
                  label="Demo Bank kartı, Demo Bank ATM’si: switch isteği kendi host’una yönlendirir"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', sub: 'terminal ATM00684', tone: 'ok' },
                    { note: 'Doğrula: terminal profili, token, tutar\nBIN → kart Demo Bank → on-us', at: 'sw' },
                    { from: 'sw', to: 'host', label: 'REST/JSON · mTLS', sub: 'fraud → provizyon + borç kaydı', tone: 'ok' },
                    { note: 'Host onaylar,\nonay kodu üretir', at: 'host' },
                    { from: 'host', to: 'sw', label: 'Onay + onay kodu', res: true, tone: 'ok' },
                    { note: 'Journal: TAMAMLANDI\nSettlement dosyasına girer', at: 'sw' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00 · 38=onay kodu', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Switch isteği iletmeden önce <b>kendi başına</b> reddedebilir (10’un katı olmayan tutar gibi); bu durumda issuer işlemi hiç görmez.</>,
                    <>On-us yol en kısa yoldur: dış ağ yok, ücret yok, BKM durağı yanmaz.</>,
                    <>Yanıt STAN ile eşlenir ve ATM’ye dönülür. İşlemin son durumu journal’a yazılır; gün sonu mutabakatı bu kaydı kullanır.</>,
                  ]}
                />
                <TryInSim>Ayşe Yılmaz’ın Visa kartıyla ATM00684’te 500 TL çekin. Mesaj akışı panelinde ATM → ATM Switch → InterAPI → Fraud → Core Banking yolunu ve her hop’un ms değerini izleyin.</TryInSim>
              </>
            ),
          },
          {
            label: '2 · Off-us (BKM)',
            content: (
              <>
                <Sequence
                  label="Atlas Bank kartı, Demo Bank ATM’sinde: switch ağa çıkar"
                  actors={[ACT.atm, ACT.sw, ACT.bkm, ACT.iss]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0100 PIN · 0200 500 TRY', tone: 'ok' },
                    { note: 'BIN → kart Atlas Bank\noff-us: ağa çıkış, ücret kuralı', at: 'sw' },
                    { from: 'sw', to: 'bkm', label: '0200 + alan 32, 28', sub: 'acquirer kodu · ücret 25 TL', tone: 'warn' },
                    { from: 'bkm', to: 'iss', label: '0200', tone: 'warn' },
                    { note: 'PIN, bakiye, limit ve\nprovizyon issuer’da', at: 'iss' },
                    { from: 'iss', to: 'bkm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { from: 'bkm', to: 'sw', label: '0210', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00', res: true, tone: 'ok' },
                    { sep: 'Gün sonu' },
                    { note: 'Takas: Atlas Bank, Demo Bank’a tutar + ücreti öder', span: ['sw', 'iss'] },
                  ]}
                />
                <Notes
                  items={[
                    <>Switch kartın başka bankaya ait olduğunu BIN’den anlar ve isteği <b>ağın lehçesine</b> çevirir (acquirer kodu, ücret alanı).</>,
                    <>PIN doğrulamada issuer tarafı HSM’i kullanır: acquirer kartın PIN’ini ya da bakiyesini bilmez.</>,
                    <>Simülatörde off-us çekim 25 TL ücretlidir; müşteri çekimden önce ücret ekranında onay verir. Bakiye 4.200 TL’den çekim 500 TL + ücret 25 TL kadar düşer.</>,
                    <>Para gerçekte gün sonu takasında el değiştirir. Simülatörde Takas oturumu “Atlas Bank → Demo Bank” satırını üretir.</>,
                  ]}
                />
                <TryInSim>Elif Demir’in kartıyla (PIN 0000) ATM00684’te 500 TL çekin; ücret ekranını onaylayın. Sonra Servis → Takas &amp; Mutabakat sekmesinde “Takas oturumunu çalıştır”a basın: BKM tablosunda Atlas Bank → Demo Bank, 1 işlem, 500 TL, ücret 25 TL, ödenecek 525 TL görünür.</TryInSim>
              </>
            ),
          },
          {
            label: '3 · Issuer zaman aşımı ve iptal',
            content: (
              <>
                <Sequence
                  label="Host onayladı ama yanıt switch’e/ATM’ye ulaşmadı; iptal SAF ile tamamlanır"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0200', sub: 'zamanlayıcı başlar', tone: 'ok' },
                    { note: 'Host hesabı borçlandırdı\n(kayıt yazıldı)', at: 'host' },
                    { from: 'host', to: 'sw', label: '0210 · 39=00', lost: true, res: true, tone: 'bad' },
                    { note: 'Süre doldu: sonuç bilinmiyor\nPara VERİLMEZ, işlem ZAMAN AŞIMI', at: 'sw', tone: 'warn' },
                    { sep: 'İptal' },
                    { from: 'atm', to: 'sw', label: '0400 · 39=68 · alan 90', lost: true, tone: 'warn' },
                    { note: 'Yanıt yok → SAF kuyruğu', at: 'atm', tone: 'warn' },
                    { sep: 'Hat düzelince' },
                    { from: 'atm', to: 'sw', label: '0420 · aynı alan 90', tone: 'warn' },
                    { from: 'sw', to: 'host', label: '0420', sub: 'asıl işlem alan 90’dan bulunur', tone: 'warn' },
                    { note: 'Borç iade edilir', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0430 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0430 · 39=00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Zaman aşımı “reddedildi” demek değildir. Switch (ve ATM) sonucu <b>bilmez</b>; güvenli taraf para vermemek ve iptal etmektir.</>,
                    <>Sıralama önemlidir: iptal, asıl işlemin STAN, tarih ve terminalinden bulunur. Asıl işlem host’ta yoksa iptal edilecek bir şey de yoktur (yine olumlu yanıt dönülür).</>,
                    <>İptal yanıtsız kalırsa SAF’ta bekler ve tekrarlanır. Süre sınırı (simülatörde 24 saat) dolarsa operasyon ekibine düşer.</>,
                    <>Gerçek bir switch zaman aşımını kendi zamanlayıcısıyla yönetir ve iptali kendisi üretebilir. Simülatörde zamanlayıcı ve SAF ATM tarafındadır; ilk 0400’ün “yanıtsız kaldığı” loga yazılır, mesaj gerçekte host’a gitmez, sonra 0420 olarak gider.</>,
                  ]}
                />
                <TryInSim>Arıza sekmesinde “Host yanıtı kaybolur”u işaretleyip Ayşe ile 500 TL çekin. Bakiye 500 TL düşer, para verilmez. Teknisyen sekmesinde “Bakım moduna al”, ardından “SAF kuyruğunu gönder”e basın: Olay günlüğünde 0420 ve 0430 satırlarını görün, bakiye iade olur.</TryInSim>
              </>
            ),
          },
          {
            label: '4 · Geç yanıt (late response)',
            content: (
              <>
                <Sequence
                  label="Issuer yanıtı switch’in süresi dolduktan sonra gönderdi"
                  actors={[ACT.atm, ACT.sw, ACT.iss]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0200 · 500 TRY', sub: 'STAN 004217', tone: 'ok' },
                    { from: 'sw', to: 'iss', label: '0200', sub: 'zamanlayıcı: 25 sn (örnek)', tone: 'ok' },
                    { note: 'Süre doldu: durum ZAMAN AŞIMI', at: 'sw', tone: 'warn' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=91', sub: 'ret (kod ağa göre doğrulanmalı)', res: true, tone: 'bad' },
                    { note: 'ATM para vermedi,\nmüşteri başka işleme geçebilir', at: 'atm', tone: 'warn' },
                    { sep: 'Geç yanıt' },
                    { from: 'iss', to: 'sw', label: '0210 · 39=00 (geç)', sub: 'STAN 004217', res: true, tone: 'ok' },
                    { note: 'STAN, tarih, terminal ile eşleşir:\nişlem ZAMAN AŞIMI durumunda → ATM’ye İLETME', at: 'sw', tone: 'warn' },
                    { from: 'sw', to: 'iss', label: '0400 · otomatik iptal', sub: 'alan 90 = 004217…', tone: 'warn' },
                    { from: 'iss', to: 'sw', label: '0410 · 39=00', res: true, tone: 'ok' },
                    { note: 'Journal: GEÇ YANIT → İPTAL EDİLDİ\nUyarı metriği artar', at: 'sw' },
                  ]}
                />
                <Notes
                  items={[
                    <>Issuer onayladığı için müşterinin hesabı borçlanmıştır; ATM’ye “ret” denmiştir. Aradaki fark ancak <b>iptalle</b> kapanır.</>,
                    <>Geç yanıt asla terminale iletilmez: terminal o sırada başka bir işlemde olabilir ve STAN’lar tekrar edebilir.</>,
                    <>Eşleştirme anahtarı (STAN + tarih + terminal + acquirer) sayesinde geç gelen yanıtın hangi işleme ait olduğu bulunur.</>,
                    <>Geç yanıt oranı bir sağlık göstergesidir: artıyorsa issuer yavaşlıyordur ve zaman aşımı süresini ya da kapasiteyi gözden geçirmek gerekir.</>,
                  ]}
                />
                <TryInSim>Simülatör geç yanıtı ayrıca üretmez: zaman aşımında yanıt hiç gelmemiş sayılır. Yakın deneyim için 3. senaryodaki adımları izleyin ve Olay günlüğündeki “yanıt alınamadı · zaman aşımı” satırında host’un yine de borçlandırdığını not edin. Geç yanıt için gerekli “eşleştirme anahtarı” alan 90’da ve imzalı <code>reversal_token</code>’da görünür.</TryInSim>
              </>
            ),
          },
          {
            label: '5 · Mükerrer 0420',
            content: (
              <>
                <Sequence
                  label="ATM iptali iki kez gönderir (ilk yanıt ATM’ye ulaşmadı)"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { from: 'atm', to: 'sw', label: '0420 · 1. gönderim', sub: 'alan 90 = asıl işlem', tone: 'warn' },
                    { note: 'Anahtar tabloda yok: yeni iptal.\nSTAN + tarih + terminal + acquirer kaydedilir', at: 'sw' },
                    { from: 'sw', to: 'host', label: '0420', tone: 'warn' },
                    { note: 'Borç iade edildi', at: 'host', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0430 · 39=00', res: true, tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0430', lost: true, res: true, tone: 'bad' },
                    { note: 'ATM yanıt alamadı → kuyrukta tutar', at: 'atm', tone: 'warn' },
                    { sep: 'Tekrar' },
                    { from: 'atm', to: 'sw', label: '0420 · 2. gönderim', sub: 'aynı alan 90', tone: 'warn' },
                    { note: 'Anahtar bulundu: İPTAL EDİLDİ\nhost’a gönderme, kayıtlı yanıtı dön', at: 'sw', tone: 'ok' },
                    { from: 'sw', to: 'atm', label: '0430 · 39=00', sub: 'önceki sonucun kopyası', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>ATM’nin tekrar göndermesi <b>doğru davranıştır</b>: 0430’u almadan iptalin tamamlandığından emin olamaz. Yanlış olan, tekrarın çift iade üretmesidir.</>,
                    <>Switch iptali anahtarla tanır. İkinci gelişte host’a hiç sormadan ilk sonucu döner; bir kerelik işlemin tekrarı zararsız olur (idempotentlik).</>,
                    <>Host da kendi içinde aynı kontrolü yapmalıdır (kemer ve askı): switch yedeğe geçtiyse ve anahtar tablosu yeni düğümde yoksa son savunma host’tur.</>,
                    <>Simülatörde SAF öğesi onaylanınca kuyruktan çıkar, bu yüzden aynı iptal arayüzden iki kez gönderilemez. Host kodu ise aynı token’la ikinci çağrıyı sunucu tarafında engellemez; bu kontrol gerçek sistemde host ve switch’e aittir. Yalnızca kayıt tekilleştirme (<code>R + RRN</code>) mutabakatta çift sayımı önler.</>,
                  ]}
                />
                <TryInSim>Simülatörde arayüzden mükerrer iptal gönderemezsiniz. Bunun yerine zaman aşımı senaryosunu çalıştırıp SAF kuyruğunu gönderin; kuyruğun 0’a düştüğüne, sonra Gün sonu’nun (0500) tuttuğuna bakın. Mükerrer iptal olsaydı host kaydı ve ATM sayaçları tutmazdı.</TryInSim>
              </>
            ),
          },
          {
            label: '6 · Host kapalı: devre kesici ve stand-in',
            content: (
              <>
                <Sequence
                  label="Issuer host art arda yanıt vermiyor: devre kesici açılır, stand-in devreye girer, host dönünce advice gider"
                  actors={[ACT.atm, ACT.sw, ACT.host]}
                  steps={[
                    { sep: 'Host düşüyor' },
                    { from: 'sw', to: 'host', label: '0200 · zaman aşımı ×N', lost: true, tone: 'bad' },
                    { note: 'Hata eşiği aşıldı:\nDEVRE KESİCİ AÇIK', at: 'sw', tone: 'bad' },
                    { sep: 'Devre açıkken yeni işlem' },
                    { from: 'atm', to: 'sw', label: '0200 · 300 TRY', tone: 'ok' },
                    { note: 'Host’a gitme (bekletme yok).\nSTIP kuralı: tutar ≤ limit,\nkara listede değil, stand-in toplamı uygun', at: 'sw', tone: 'warn' },
                    { from: 'sw', to: 'atm', label: '0210 · 39=00 · STIP onay kodu', res: true, tone: 'warn' },
                    { note: 'Journal: STIP ONAY\nADVICE BEKLİYOR (kuyruk)', at: 'sw', tone: 'warn' },
                    { sep: 'Host dönüyor' },
                    { from: 'sw', to: 'host', label: '0800 · alan 70 = 301', sub: 'yarı açık: tek deneme', tone: 'ok' },
                    { from: 'host', to: 'sw', label: '0810 · 39=00', res: true, tone: 'ok' },
                    { note: 'DEVRE KESİCİ KAPALI', at: 'sw', tone: 'ok' },
                    { from: 'sw', to: 'host', label: '0220 · STIP advice', sub: 'kuyruk sırayla boşalır', tone: 'warn' },
                    { note: 'Advice reddedilemez:\nborç kaydı yapılır, bakiye\neksiye düşebilir', at: 'host', tone: 'warn' },
                    { from: 'host', to: 'sw', label: '0230 · 39=00', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Devre kesici</b> sağlam hedeflere zarar vermeden kötü hedefi izole eder; kapalı hedefe “bekleme” yerine hızlı karar verilir.</>,
                    <><b>Stand-in</b> her işlemde değil, issuer’ın önceden verdiği kurallar içinde çalışır. Bu tutar küçük (limit içi), kart temiz ve toplam stand-in tutarı sınır altı olmalıdır; aksi halde ret verilir.</>,
                    <>Hat geri geldiğinde ilk iş <b>echo (0800/301)</b> ile sağlık kontrolüdür; ancak ondan sonra devre kapanır ve bekleyen advice’lar sırayla gönderilir.</>,
                    <>Advice (0220) bir <i>soru</i> değil bildirimdir: issuer işlemi hesaba yansıtmak zorundadır. Bakiyesi yetmeyen müşterinin hesabı eksiye düşebilir, bu risk acquirer ile issuer arasında kararlaştırılan bir politikadır.</>,
                    <>Simülatörde devre kesici ve stand-in yoktur: host API’sine ulaşılamazsa ATM 91 ile bitirir ve ekranın üstünde bir uyarı çıkar.</>,
                  ]}
                />
                <TryInSim>Bu akış simülatörde yok. Kısmi bir deneyim isterseniz yerelde <code>npm run dev:api</code> sürecini durdurup bir işlem deneyin: ATM “Host sistemine ulaşılamadı” (91) ile biter ve ekranın üstünde bir uyarı belirir. Hızlı ret var, stand-in yok; API’yi tekrar başlatınca işlem çalışır.</TryInSim>
              </>
            ),
          },
        ]}
      />

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['Switch', 'Terminal ve ağ/host arasında doğrulayan, yönlendiren, dönüştüren ve hatayı yöneten orta katman'],
          ['On-us / off-us', 'Kart ATM’nin bankasına mı ait (host’a yerel yol), başka bankaya mı (BKM üzerinden ağa çıkış)?'],
          ['BIN yönlendirme', 'PAN öneki tablosu hedefi belirler; kural kodda değil tabloda durur'],
          ['Mesaj dönüşümü', 'Alan eşleme ve yanıt kodu eşleme; yanlış eşleme yanlış müşteri deneyimi demektir'],
          ['PIN çevirme', 'HSM içinde anahtardan anahtara; switch açık PIN görmez'],
          ['STIP', 'Issuer yokken kurallı yerel karar; sonradan 0220 advice ile bildirilir'],
          ['Zaman aşımı zinciri', 'Alt halka üsttekinden kısa; süre dolunca otomatik iptal, geç yanıt iletilmez'],
          ['İptal eşleme', 'STAN + tarih + terminal + acquirer ile asıl işlem bulunur, iptal idempotent işlenir'],
          ['SAF', 'Yanıtı alınamayan iptal/advice saklanır ve tekrarlanır; kaybolması mutabakat farkı demektir'],
          ['Devre kesici', 'Hasta hedefi izole eder; yarı açık durumda tek deneme yapılır'],
          ['HA', 'Active-active/passive, oturum yakınlığı, havuz, backpressure, zarif bozulma'],
          ['Test', 'Simüle terminal, hata enjeksiyonu, replay, ağ sertifikasyonu, mutabakat doğrulaması'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/host">ATM host ve transaction yönetimi — switch’in karşı ucundaki uygulama ve defter →</a>
      </p>
    </>
  )
}
