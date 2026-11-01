import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

const ACT = {
  app: { id: 'app', label: 'ATM Uygulaması', sub: 'İş mantığı' },
  sp: { id: 'sp', label: 'XFS SP', sub: 'Service Provider' },
  drv: { id: 'drv', label: 'Üretici sürücüsü', sub: 'SDK · USB · CAN' },
  fw: { id: 'fw', label: 'Firmware', sub: 'Cihaz içi yazılım' },
  hw: { id: 'hw', label: 'Mekanik', sub: 'Motor · sensör' },
  idc: { id: 'idc', label: 'IDC SP', sub: 'Kart okuyucu' },
  pin: { id: 'pin', label: 'PIN SP', sub: 'EPP tuş takımı' },
  cdm: { id: 'cdm', label: 'CDM SP', sub: 'Para verme' },
  host: { id: 'host', label: 'Banka Host', sub: 'ISO 8583' },
  tech: { id: 'tech', label: 'Teknisyen', sub: 'Servis ekranı' },
}

export default function DeviceDrivers() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · ATM yazılımı"
        title="ATM cihaz sürücüleri"
        lead="XFS sayfası ATM uygulamasının cihazlarla nasıl konuştuğunu anlattı. Bu sayfa komutun yolunun devamını izliyor: Service Provider’ın altında hangi sürücü, hangi firmware ve hangi mekanik var, cihazlar hangi durumlara girer ve uygulama hatalarda ne yapmalı? Simülatörün Arıza ve Teknisyen sekmeleri tam olarak bu konunun uygulamasıdır."
      />

      <h2 id="giris">Sürücü ve SP: kim ne?</h2>
      <p>
        ATM dünyasında “sürücü” kelimesi birkaç farklı katman için kullanılır ve bu karışıklık hata ayıklarken zaman kaybettirir. Aşağıdaki tablo bu
        sayfada kullanılacak anlamları sabitliyor.
      </p>
      <Table
        head={['Terim', 'Ne?', 'Nerede çalışır?', 'Kim yazar?']}
        rows={[
          [<b key="1">Firmware</b>, 'Cihazın kendi içindeki yazılım: motorları, sensörleri, kart okuyucu kontrolcüsünü yönetir.', 'Cihazın üzerindeki mikrodenetleyici', 'Cihaz üreticisi'],
          [<b key="2">Üretici sürücüsü / SDK</b>, 'Bilgisayarın cihazla konuştuğu katman: USB, seri port, CAN gibi bağlantı üzerinden paket gönderir/alır.', 'ATM bilgisayarı (Windows)', 'Cihaz üreticisi'],
          [<b key="3">Service Provider (SP)</b>, 'XFS komutunu üretici sürücüsünün diline çevirir; yanıtı XFS sonucuna dönüştürür; durumu izler, olay üretir.', 'ATM bilgisayarı (bir DLL)', 'Üretici ya da ATM yazılım satıcısı'],
          [<b key="4">XFS Manager</b>, 'Uygulama ile SP’ler arasında yönlendirir.', 'ATM bilgisayarı', 'Standart bileşen (msxfs.dll)'],
          [<b key="5">Uygulama / ara yazılım</b>, 'Müşteri akışı, host mesajları, cihaz arıza kararları. Bazen bir ATM ara yazılımı (middleware) bu işi cihaz çeşitliliğinden izole eder.', 'ATM bilgisayarı', 'Banka, ATM yazılım satıcısı'],
        ]}
      />
      <Callout title="“Sürücü” kimi zaman “SP” demektir">
        Sahadaki konuşmada “CDM sürücüsü güncellendi” cümlesi SP’yi de, üretici SDK’sını da, firmware’i de kastedebilir. Bir arıza raporunda hangi katmanın
        hangi sürümünün çalıştığını <b>ayrı ayrı</b> yazmak gerekir. Aksi halde “sürücü 3.10” gibi bir bilgi yarım kalır.
      </Callout>

      <h2 id="katmanlar">Bir komutun yolculuğu</h2>
      <p>
        Uygulama bir banknot karışımı dağıtmak istediğinde komut aşağıdaki katmanlardan geçer. Sonuç aynı yoldan yukarı çıkar ve her katman, kendi
        bilgisini bir üst katmanın anlayacağı biçime çevirir.
      </p>
      <Sequence
        label="Para dağıtma komutunun CDM SP’den mekanik katmana inişi"
        actors={[ACT.sp, ACT.drv, ACT.fw, ACT.hw]}
        steps={[
          { sep: 'Aşağı yön: komut' },
          { from: 'sp', to: 'drv', label: 'Dispense(plan)', sub: 'XFS komutu → üretici API’si', tone: 'ok' },
          { from: 'drv', to: 'fw', label: 'USB/CAN paketi', sub: 'ör. “2×200 + 1×100”', tone: 'ok' },
          { from: 'fw', to: 'hw', label: 'kasetten çek', sub: 'pick motoru · sensörler', tone: 'ok' },
          { sep: 'Yukarı yön: sonuç' },
          { from: 'hw', to: 'fw', label: 'sayım + çift çekim sensörü', sub: 'uzunluk, kalınlık, kalite', res: true },
          { from: 'fw', to: 'drv', label: 'durum + sayaçlar', sub: 'verilen / reddedilen', res: true },
          { from: 'drv', to: 'sp', label: 'dönüş kodu + sayılar', res: true },
          { note: 'SP bunları XFS’ye çevirir: başarıda hResult = 0 ve sayaçlar,\nhatada ör. WFS_ERR_CDM_CASHUNITERROR', span: ['sp', 'hw'], tone: 'ok' },
        ]}
      />
      <Notes
        items={[
          <>SP, <b>XFS’nin cihaz sınıfı sözleşmesini</b> üretici sürücüsünün sözleşmesine çevirir. Aynı XFS komutu farklı üreticilerde farklı sürücü çağrısına karşılık gelir.</>,
          <>Fiziksel doğrulama (banknot kalınlığı, çift çekim, uzunluk) <b>cihazın içinde</b>, firmware ve sensör düzeyinde yapılır. Uygulama banknotu “görmez”; yalnızca özet sonucu alır.</>,
          <>Hatalar da yukarı çıkarken <b>çevrilir ve bilgi kaybeder</b>. Sürücünün “motor takıldı” bilgisi XFS’de tek bir hata koduna dönüşebilir. Ayrıntıyı bulmak için sürücü günlüğüne bakmak gerekir.</>,
        ]}
      />

      <h2 id="durum">Cihaz durum makinesi</h2>
      <p>
        Her XFS cihazı bir <b>durum</b> bildirir (STATUS sorgusu ve SYSTEM olaylarıyla). Uygulamanın kararlarının çoğu bu durum üzerine kurulur: müşteriye “para
        çekme” seçeneğini göstermek, bir işlemi başlatmak, teknisyen çağırmak. Durum adları sınıfa özgüdür (<code>WFS_IDC_DEVONLINE</code>,{' '}
        <code>WFS_CDM_DEVHWERROR</code> gibi); aşağıdaki sınıflandırma sürümden bağımsız bir özettir, tam sabit listesi için ilgili sürümün şartnamesine
        bakın (doğrulayın).
      </p>
      <Table
        head={['Durum', 'Anlamı', 'Uygulama ne yapar?']}
        rows={[
          [<b key="1">Online (OK)</b>, 'Cihaz hazır, komut kabul eder.', 'Normal akış.'],
          [<b key="2">Offline</b>, 'Cihaz bağlı ama hizmet vermiyor (kapı açık, bakım, kendini kapatmış).', 'İlgili işlemi menüden kaldır; müşteriye “geçici hizmet dışı” göster; durum değişince (SYSE_DEVICE_STATUS) menüyü geri aç.'],
          [<b key="3">Güç tasarrufu (power save)</b>, 'Cihaz uyku modunda; komut gelince uyanır ve kısa süre meşgul olabilir.', 'İlk komuta biraz uzun zaman aşımı ver; uyanma süresini hata sayma. Bu durumun XFS’deki tam adı ve davranışı sürüme göre değişir; doğrulayın.'],
          [<b key="4">Meşgul (busy)</b>, 'Başka bir komutu işliyor.', 'Bekle ya da komutu sıraya al; üst üste göndermeyin.'],
          [<b key="5">Kullanıcı hatası</b>, 'İnsan müdahalesiyle düzelen durum: sıkışma, kağıt yok, kaset eksik, kutu dolu.', 'İşlemi güvenle sonlandır, cihazı işaretle, teknisyen bildirimi üret. Müşteriyi bekletme.'],
          [<b key="6">Donanım hatası</b>, 'Cihaz bozuk ya da sağlıklı çalışmıyor; kendiliğinden düzelmez.', 'Cihazı servis dışı bırak, RESET dene; geçmezse servis çağrısı. Sistem olayındaki eylem bilgisi (reset mi, servis mi) karar için kullanılır.'],
          [<b key="7">Fatal / cihaz yok</b>, 'Cihaz hiç yanıt vermiyor, bağlantı kopmuş veya kalıcı arıza.', 'Cihaz sınıfı gerekliyse ATM’yi tümüyle servis dışı bırak (ör. kart okuyucu yoksa işlem olmaz); izleme sistemine kritik uyarı gönder.'],
        ]}
      />
      <Callout title="Simülatörde durum makinesi">
        Simülatör her terminal için yalnızca iki cihazın durumunu tutar: <b>CDM</b> (<code>ok</code> ya da <code>jam</code>) ve <b>PTR</b> (<code>ok</code> ya
        da <code>paper-out</code>). Teknisyen sekmesindeki “Para verme (CDM)” ve “Fiş yazıcı (PTR)” satırları bunu gösterir. Kart okuyucu ve EPP için durum
        tutulmaz; kart sıkışması tek seferlik bir olaydır, kalıcı bir durum değildir. Gerçekte her cihazın durumu bu sayfadaki tablodan çok daha ayrıntılıdır.
      </Callout>
      <p>
        <b>Kural:</b> CDM <code>jam</code> iken para çekme kapalıdır ama bakiye, yatırma, fatura gibi diğer işlemler açıktır. Gerçek ATM’lerde de mantık
        aynıdır: bir cihazın arızası yalnızca onu gerektiren işlemleri kapatır (<i>degraded mode</i>), ATM’nin tamamı değil. Simülatörde ana ekranda “Para
        verme geçici olarak hizmet dışı” notunu görürsünüz.
      </p>

      <h2 id="idc">Kart okuyucu (IDC)</h2>
      <h3>Ne yapar?</h3>
      <ul>
        <li>
          <b>Manyetik şerit:</b> ISO 7811 izleri: Track 1 (alfanümerik, kart sahibi adı), Track 2 (sayısal, PAN + son kullanma + servis kodu; ISO 8583 alan 35’in
          kaynağı), Track 3 (eski, çoğu uygulamada kullanılmaz).
        </li>
        <li>
          <b>Çipli kart (temaslı):</b> ISO 7816. Okuyucu kartın çip temas noktalarına güç verir ve sıfırlar; uygulama <code>CHIP_IO</code> komutuyla APDU’ları
          iletir (EMV sayfasındaki SELECT, GET PROCESSING OPTIONS…). Okuyucu APDU’nun anlamını bilmez, taşıyıcıdır.
        </li>
        <li>
          <b>Kartı hareket ettirmek:</b> motorlu okuyucuda kart içeri çekilir, işlem boyunca ATM’nin içinde durur, sonunda iade edilir ya da alıkonur. Kimi
          modellerde müşteri kartı sadece “daldırıp çıkarır” (dip reader); kart içeride tutulmaz. Hangisi olduğu uygulamanın akışını (ör. “kart-önce-para”) etkiler.
        </li>
        <li>
          <b>Alıkonma kutusu (retain bin):</b> PIN denemesi aşıldığında, yakalanmış kartta ya da iade edilemeyen kartta kart kutuya düşer. Kutunun kapasitesi
          sınırlıdır; dolmaya yaklaşınca <b>eşik olayı</b> (<code>USRE</code> sınıfı) gelir, dolunca yeni kart alınamaz.
        </li>
        <li>
          <b>Skimmer (kopyalama) önlemleri:</b> kart ağzına takılan sahte aparatları sezen sensör ve algoritmalar, kartın yolunda “jitter” gibi karşı önlemler. SP
          şüpheli durumu durum/olay olarak bildirir (ör. bir “fraud attempt” durumu); uygulama bu durumda müşteri işlemini engelleyebilir ve alarm gönderir. Hangi
          modelin ne yaptığı üreticiye göre değişir, doğrulayın.
        </li>
      </ul>
      <Table
        head={['Olay', 'Simülatör']}
        rows={[
          ['Kart takıldı, iz ve çip okunur', <><code key="1">WFS_CMD_IDC_READ_RAW_DATA</code>, sonra <code key="2">WFS_CMD_IDC_CHIP_IO</code> <Sim key="s">sim</Sim></>],
          ['Kart iade edilir', <><code key="3">WFS_CMD_IDC_EJECT_CARD</code>, müşteri alınca <code key="4">WFS_SRVE_IDC_MEDIAREMOVED</code> <Sim key="s2">sim</Sim></>],
          ['PIN 3. kez yanlış (alan 39 = 75)', <><code key="5">WFS_CMD_IDC_RETAIN_CARD</code>, “Alıkonan kart” sayacı +1 <Sim key="s3">sim</Sim></>],
          ['İade sırasında sıkışma', <><code key="6">WFS_ERR_IDC_MEDIAJAM</code> ardından <code key="7">RETAIN_CARD</code> <Sim key="s4">sim</Sim></>],
          ['Kart iade edildi ama alınmadı (zaman aşımı)', 'Yok: simülatörde kartı alma süresi sınırlı değil'],
          ['Alıkonma kutusu dolu', 'Yok: sayaç sınırsız artar'],
          ['Skimmer / sahte aparat algılama', 'Yok'],
        ]}
      />
      <p>
        Alıkonan kartın geri alınması: <b>Teknisyen → Kutuları boşalt</b> alıkonan kartları “şubeye teslim eder” sayar. Demo kolaylığı olarak teslim edilen kartlar
        cüzdanda tekrar kullanılabilir hale gelir; gerçek hayatta kart müşteriye geri verilmez, kartı çıkaran banka karar verir.
      </p>

      <h2 id="pin">PIN pad (EPP)</h2>
      <p>
        <b>EPP</b> (Encrypting PIN Pad), PIN’in girildiği ve <b>açık halde hiçbir zaman ATM bilgisayarına çıkmadığı</b> tuş takımıdır. Bu yüzden kurcalamaya
        karşı korumalı (tamper-resistant) bir donanımdır; güvenlik değerlendirmesi PCI’ın PTS POI (PIN Transaction Security) kapsamında yapılır. Uygulama PIN’i
        <i> görmez</i>: EPP “bir tuşa basıldı” bilgisini yollar, PIN’in kendisi şifreli bir <b>PIN bloğu</b> olarak döner.
      </p>
      <h3>Anahtar hiyerarşisi</h3>
      <Table
        head={['Anahtar', 'Rolü', 'Not']}
        rows={[
          [<b key="1">Master key (TMK)</b>, 'EPP içinde saklanan, diğer anahtarları korumak için kullanılan ana anahtar.', 'Cihaza güvenli bir törenle yüklenir; EPP’den dışarı çıkmaz.'],
          [<b key="2">KEK</b>, 'Anahtar şifreleme anahtarı: başka anahtarları taşımak/yüklemek için.', 'Hiyerarşide master’ın altında ya da onun yerine.'],
          [<b key="3">PIN anahtarı</b>, 'PIN bloğunu şifreler (çalışma anahtarı).', 'Düzenli olarak yenilenir (ISO 8583 sayfasındaki 0800 / alan 70 = 101 anahtar değişimi).'],
          [<b key="4">MAC anahtarı</b>, 'Mesaj bütünlüğü kodu (alan 128) için.', 'Genelde PIN anahtarından ayrıdır.'],
        ]}
      />
      <h3>Anahtar yükleme</h3>
      <ul>
        <li>
          <b>Elle (manuel) yükleme:</b> iki ya da üç kişi anahtarın parçalarını (component) ayrı ayrı girer; EPP bunları birleştirir. Hiçbir kişi anahtarın
          tamamını bilmez.
        </li>
        <li>
          <b>Uzaktan yükleme (remote key loading):</b> sertifikaya dayalı bir protokolle anahtar şifreli olarak ağdan yüklenir. Bu amaçla <b>TR-34</b> kullanılır;
          XFS tarafında 3.30 sürümü TR-34 desteğini eklediğini duyurdu (XFS sayfası). PCI, uzaktan yükleme yapılıyorsa TR-34’ü gerektiren bir yönerge belirtiyor
          (bir üretici belgesine göre; güncel PCI PIN gerekliliklerini doğrulayın).
        </li>
        <li>
          <b>TR-31 anahtar bloğu:</b> anahtarı, kullanım amacı ve izinleriyle birlikte tek bir korumalı paket olarak taşır; böylece bir PIN anahtarı bir MAC anahtarı
          gibi yanlış amaçla kullanılamaz. Bu konudaki PCI mühlet tarihleri birkaç kez değişti; güncel tarihleri PCI’dan doğrulayın.
        </li>
        <li>
          Açık (clear) anahtar yüklemesi PCI’ın yeni cihaz sürümlerinde kullanımdan kaldırılmıştır (yüklemenin şifreli olması şartı, bir PCI sunumuna göre).
          Güncel durumu doğrulayın.
        </li>
      </ul>
      <h3>Şifreli PIN bloğu ve biçimleri</h3>
      <p>
        PIN’in şifrelenmeden önceki biçimi ISO 9564’te tanımlıdır. ATM’lerde en yaygın olanı <b>format 0</b>’dır.
      </p>
      <Table
        head={['Biçim', 'Yapı', 'Not']}
        rows={[
          [<b key="1">ISO format 0</b>, 'PIN alanı XOR PAN alanı. PIN alanı: 0 · PIN uzunluğu · PIN · F ile doldurma. PAN alanı: 0000 + PAN’ın kontrol hanesi hariç sağdaki 12 hanesi.', 'PAN’a bağlı; aynı PIN farklı kartta farklı blok üretir. Simülatörde anılan biçim.'],
          [<b key="2">ISO format 1</b>, '1 · PIN uzunluğu · PIN · rastgele doldurma. PAN kullanılmaz.', 'Karta bağlı olmayan durumlar için.'],
          [<b key="3">ISO format 3</b>, 'Format 0 gibi, ama doldurma karakterleri F yerine rastgele (A–F aralığı).', 'Aynı PIN + PAN her seferinde farklı blok verebilir.'],
          [<b key="4">ISO format 4</b>, 'AES tabanlı yeni biçim.', 'PCI’ın uygulama tarihleri askıya alındı; güncel durumu doğrulayın.'],
        ]}
      />
      <p>
        <b>Örnek (format 0).</b> PIN <code>1234</code>, örnek PAN <code>4543990000010001</code>:
      </p>
      <Table
        head={['Adım', 'Değer']}
        rows={[
          ['PIN alanı', <code key="1">04 12 34 FF FF FF FF FF</code>],
          ['PAN alanı (kontrol hanesi hariç sağdaki 12 hane: 399000001000)', <code key="2">00 00 39 90 00 00 10 00</code>],
          ['XOR (şifrelenecek açık PIN bloğu)', <code key="3">04 12 0D 6F FF FF EF FF</code>],
          ['EPP bu bloğu PIN anahtarıyla şifreler', <>ISO 8583 <b>alan 52</b> olarak yola çıkar (64 bit)</>],
        ]}
      />
      <Callout tone="warn" title="Simülatör gerçek EPP değil">
        Simülatörde PIN, doğrulama için host’a bir demo API isteğiyle iletilir; EPP’de gerçek bir şifreleme yapılmaz. Olay günlüğü
        <code> WFS_CMD_PIN_GET_PINBLOCK</code> satırında “ISO-0 formatında şifrelendi” der ve 0100 mesajının alan 52’si bir yer tutucudur. Bu sayfadaki
        örnek hesap, gerçek EPP’nin ne yaptığını gösteren bir açıklamadır, simülatör bunu hesaplamaz.
      </Callout>

      <h2 id="cdm">Para dağıtıcı (CDM)</h2>
      <h3>Parçalar</h3>
      <Table
        head={['Parça', 'Görevi']}
        rows={[
          [<b key="1">Kasetler</b>, 'Kupür başına banknot taşır (genelde 4–6 kaset). Her kasetin kupürü, para birimi ve sayaçları vardır. Simülatör 200, 100, 50 ve 20 TL’lik dört kaset gösterir.'],
          [<b key="2">Pick (çekme) birimi</b>, 'Kasetin üstünden banknotu tek tek çeker. Çift çekim sensörü iki banknotun birlikte çıkmasını yakalar.'],
          [<b key="3">Taşıma yolu ve sensörler</b>, 'Banknot kalınlığı, uzunluğu, kalitesi ölçülür; hatalı olanlar ayrılır.'],
          [<b key="4">Red kutusu (reject bin)</b>, 'Ölçüm sonucu verilemeyen banknotlar (buruşuk, çift, yarım). Müşteriye ulaşmaz.'],
          [<b key="5">İstifleyici / presenter ve shutter</b>, 'Hazırlanan banknotlar toplanır ve shutter açılarak müşteriye sunulur.'],
          [<b key="6">Geri çekme kutusu (retract bin)</b>, 'Sunulan ama müşterinin almadığı banknotlar. Kendi sayacı vardır.'],
        ]}
      />
      <h3>Banknot planı: “denominate”</h3>
      <p>
        Bir tutarın hangi kupürlerle verileceğine <b>denominate</b> denir. XFS’de <code>WFS_CMD_CDM_DENOMINATE</code> bu hesabı <i>dağıtmadan</i> yapar; uygulama
        planı görür, onaylarsa <code>DISPENSE</code> gönderir. Simülatörde planı <b>host</b> hesaplar (<code>plan_dispense</code>):
      </p>
      <ul>
        <li>Yalnızca 200, 100, 50 ve 20 TL dağıtılır; 10 TL’nin katı olmayan tutar 13 koduyla (geçersiz tutar) reddedilir.</li>
        <li>En büyük banknottan başlar (açgözlü), kasette yeterli banknot yoksa ya da kalan tutar tamamlanamıyorsa <b>geri izler (backtracking)</b>.</li>
        <li>Hiçbir karışım tutarı tamamlayamıyorsa işlem 86 koduyla reddedilir (“banknot dağıtılamıyor”).</li>
      </ul>
      <Table
        head={['Tutar', 'Demo Bank kasetleri', 'Plan', 'Neden?']}
        rows={[
          [<b key="1">570 TL</b>, '200:40 · 100:60 · 50:80 · 20:6', '2×200 + 1×100 + 1×50 + 1×20', 'Açgözlü seçim hepsini tamamlar.'],
          [<b key="2">60 TL</b>, 'aynı', '3×20', '50 seçilince 10 TL kalır ve tamamlanamaz; geri izleme 50’yi bırakıp 20’lere döner.'],
          [<b key="3">130 TL</b>, 'aynı', '1×50 + 4×20', '100 seçilince 30 TL kalır (tamamlanamaz); 50×2 sonrası 30 TL kalır (tamamlanamaz); 50×1 + 4×20 tamamlar.'],
          [<b key="4">30 TL</b>, 'aynı', 'Yok → 86', '20 ve 50 ile 30 TL oluşmaz.'],
        ]}
      />
      <p className="tr-muted">
        Hesaplar simülatörün başlangıç kaset sayılarıyla (Demo Bank, ATM00684) yapıldı; kasetler azaldıkça aynı tutar için plan değişebilir.
      </p>
      <Callout title="Gerçek planlayıcılar daha kurnazdır">
        Gerçek sistemlerde plan çoğu zaman yalnızca “tutarı tamamla” değildir: kasetleri dengeli boşaltmak, küçük kupürün tükenmesini geciktirmek, bir
        işlemde en çok kaç banknot verilebileceğini sınırlamak (çok banknot istenirse <code>WFS_ERR_CDM_TOOMANYITEMS</code> gibi hatalar) ve belirli kupürleri
        tercih etmek bu kuralların parçasıdır. Bu sınırlar cihaza ve kuruma göre değişir. Simülatör yalnızca temel mantığı gösterir.
      </Callout>
      <h3>Nakit hesabı: sayaçlar neden tutmalı?</h3>
      <p>
        Her kasetin sayacı, ATM’nin <b>kasette kaç banknot olduğunu sandığını</b> gösterir. Gerçek sayı teknisyen kasetleri sayana kadar bilinmez. Aradaki fark
        para kaybı ya da fazlasıdır, bu yüzden <b>sayaçlar ayrı ayrı</b> tutulur. Simülatörün Denkleştirme tablosu aynı formülü kullanır:
      </p>
      <Table
        head={['Sütun', 'Anlamı', 'Artar / azalır']}
        rows={[
          ['Açılış', 'Dönem başındaki kaset sayısı', 'Gün sonu kapanınca yenilenir'],
          ['+ İkmal', 'Teknisyenin eklediği banknot', 'Kasetleri doldur'],
          ['+ Yatan', 'Yatırılan, kasete alınan banknot (yalnızca kasetli kupürler)', 'Para yatırma'],
          ['− Verilen', 'Müşterinin aldığı banknot', 'ITEMSTAKEN'],
          ['− Red', 'Red kutusuna giden banknot', 'Sıkışma / hatalı banknot'],
          ['− Geri', 'Geri çekme kutusuna giden banknot', 'Para alınmadı (RETRACT)'],
        ]}
      />
      <p>
        <b>Beklenen = Açılış + İkmal + Yatan − Verilen − Red − Geri.</b> “Sayılan” ile “Beklenen” tutarsa <b>Fark</b> 0’dır. Gerçek sistemde <b>host’un
        kendi defteri</b> de ayrı bir doğrulama katmanıdır: gün sonunda toplam çekim tutarı ATM sayaçları ile host kayıtları arasında karşılaştırılır (ISO 8583
        sayfasında 0500/0510 ve alan 39 = 95).
      </p>

      <h2 id="cim">Para yatırma ve recycler (CIM)</h2>
      <ul>
        <li>
          <b>CIM</b> (Cash-In Module) banknotları <b>kabul eder, tanır ve saklar</b>. XFS’de tipik akış: <code>CASH_IN_START</code> (hazne açılır), <code>CASH_IN</code>
          (banknotlar alınır, sayılır, doğrulanır), sonra iki yoldan biri: <code>CASH_IN_END</code> (işlem kesinleşir, banknotlar kasete gider) ya da müşteri
          vazgeçerse geri iade (<code>CASH_IN_ROLLBACK</code> / <code>RETRACT</code> türü komutlar, ayrıntı için şartnameye bakın).
        </li>
        <li>
          <b>Şüpheli banknot:</b> sahte ya da tanınmayan banknotlar müşteriye iade edilmez, ayrı bir kutuda incelemeye alınır. Müşterinin hesabına yalnızca geçerli
          banknotlar geçer. Simülatörde “şüpheli” sayısı ayrı girilir ve işlem sonunda “… şüpheli banknot incelemeye alındı” yazılır.
        </li>
        <li>
          <b>Recycler:</b> yatırılan banknotlar ayrı bir yatırma kasetinde birikmek yerine <b>dağıtım kasetlerine yönlendirilir</b>; yani başka bir müşteri aynı banknotları
          çekebilir. Böylece nakit ikmal ihtiyacı azalır. Simülatör bunu böyle modeller: yatan banknotlar kasetlere eklenir (yalnızca 200, 100, 50 ve 20 TL) ve
          Denkleştirmede “+ Yatan” sütununda görünür.
        </li>
        <li>
          Simülatörde <b>iade (rollback) yoktur</b>: banknotlar tanıma sonrası doğrudan onay ekranına gider.
        </li>
      </ul>
      <TryInSim>
        Ayşe Yılmaz’la (PIN 1234) “Para Yatırma”yı seçip bazı banknotları artırın ve şüpheli sayısını 1 yapın; onaylayın. Günlükte CIM_CASH_IN_START, CASH_IN (şüpheli
        alıkonuldu) ve CASH_IN_END satırlarını görün; Teknisyen sekmesinde Denkleştirme’deki “+ Yatan” sütununa bakın.
      </TryInSim>

      <h2 id="ptr">Fiş yazıcı ve diğer cihazlar</h2>
      <h3>Fiş yazıcı (PTR)</h3>
      <ul>
        <li>
          Termal yazıcılar tek bir ısıtma başlığıyla kağıt üzerine basar; <code>PRINT_FORM</code> ile bir <b>form</b> (alan adlarıyla düzen) doldurulup basılır.
          Kağıt azaldığında yazıcı bir <b>eşik</b> bildirir; bittiğinde <code>WFS_ERR_PTR_PAPEROUT</code> ile komut başarısız olur.
        </li>
        <li>
          Fiş bir <b>kolaylıktır, işlemin kendisi değil</b>: para hareketi tamamlanmışsa fiş olmasa da işlem geçerlidir. Sıkıştığında ATM bunu raporlar ama müşteriyi
          bekletmez. Bazı kurumlar fişsiz çalışmayı yasaklar (kağıt bitince para çekmeyi kapatır); bu iş kuralıdır, XFS’nin değil.
        </li>
        <li>
          <b>Journal (denetim) yazıcısı</b>, eski ATM’lerde her işlemi kağıda döken ikinci bir yazıcıydı. Günümüzde yerini <b>elektronik günlük (EJ)</b> aldı.
          Simülatörün “EJ” sekmesi bunun karşılığıdır: terminal başına işlem, tutar ve sonuç.
        </li>
      </ul>
      <h3>Sensörler ve göstergeler (SIU)</h3>
      <p>
        SIU, ATM’nin <b>fiziksel durumunu</b> verir: kasa kapısı, üst kabin, destek/yedek pil, titreşim ya da eğim sensörleri, ve ışıklı göstergeler (kart ağzı
        ışığı, para ağzı ışığı). Kasa kapısı açıkken uygulama normal işlem yapmamalıdır. Simülatör SIU’yu taklit etmez; ATM üzerindeki küçük LED’ler yalnızca
        o anda hangi cihazın çalıştığını gösterir.
      </p>
      <h3>Çek (IPM), kamera, alarm</h3>
      <ul>
        <li>
          <b>IPM</b> (Item Processing Module) çek gibi belgeleri alır, iki yüzünü görüntüler ve alt satırdaki <b>MICR</b>’ı okur. Simülatör çek yatırmada
          <code> WFS_CMD_IPM_MEDIA_IN</code> ve <code>WFS_CMD_IPM_READ_IMAGE</code> yazar <Sim>sim</Sim>; çek takasa girer (Takas sekmesi).
        </li>
        <li>
          <b>Kamera (CAM)</b>, işlem sırasında müşteri ve cihaz görüntüsü kaydeder; kayıtların işlemle eşleştirilmesi itiraz çözümünde işe yarar. Simülatörde yok.
        </li>
        <li>
          <b>Alarm (ALM)</b>, kurcalama veya kapı ihlalinde uyarı verir. Simülatörde yok.
        </li>
      </ul>

      <h2 id="hata">Hata yönetimi ve kurtarma</h2>
      <p>
        Cihaz hatası, ATM yazılımının <b>para söz konusu olduğunda</b> en dikkatli olması gereken yerdir. Dört temel kural:
      </p>
      <ol>
        <li>
          <b>Emin değilsen para verme, parayı geri al:</b> sonucu bilinmeyen bir dağıtımda host’a iptal (0400) gönderilir. ISO 8583 sayfasındaki ilke aynen
          geçerli.
        </li>
        <li>
          <b>Önce müşteri güvenliği:</b> kartı iade etmek ya da güvenle alıkoymak; parayı, kart alınmadan sunmamak (card-before-cash).
        </li>
        <li>
          <b>Her şeyi kaydet:</b> elektronik günlük, cihaz sayaçları ve sürücü günlükleri. Sonradan “para çıktı mı çıkmadı mı” sorusunu yalnızca kayıt yanıtlar.
        </li>
        <li>
          <b>Hatalı cihazı izole et, ATM’yi değil:</b> yalnızca etkilenen işlemleri kapat, teknisyen bildirimi üret.
        </li>
      </ol>
      <h3>Dağıtım sırasında hata: ne yapılır?</h3>
      <p>Aşağıdaki akış, simülatörün üç arıza türünü (sıkışma, para alınmadı, host zaman aşımı) ve kart sıkışmasını aynı karar ağacında gösterir.</p>
      <Flow
        items={[
          { title: 'Müşteri tutarı seçti, plan hazırlandı', tag: 'CMD_CDM_DENOMINATE → 0200', text: 'Uygulama kupür planını çıkarır ve host’a 0200 ile sorar.' },
          {
            decision: true,
            title: 'Host yanıtı geldi mi?',
            branches: [
              { label: 'Hayır · zaman aşımı', text: 'Para verme. 0400 gönder; yanıt yoksa SAF kuyruğuna al, hat düzelince 0420 olarak tekrarla. Simülatör: “Host yanıtı kaybolur” arızası.', tone: 'warn' },
              { label: 'Evet · 39 = 00', text: 'Dağıtıma geç. 00 dışı kod gelirse işlem biter, iptal gerekmez.', tone: 'ok' },
            ],
          },
          { title: 'Dağıtım', tag: 'CMD_CDM_DISPENSE', text: 'Banknotlar kasetlerden çekilir, kaset sayaçları düşer.' },
          {
            decision: true,
            title: 'DISPENSE hata verdi mi? (CASHUNITERROR)',
            branches: [
              { label: 'Evet · sıkışma', text: 'Banknotlar red kutusuna, CDM servis dışı. 0400 (39 = 22) hemen gönderilir. Teknisyen çağrılır. Simülatör: “Para sıkışması” arızası.', tone: 'bad' },
              { label: 'Hayır', text: 'Kart iadesine geç.', tone: 'ok' },
            ],
          },
          { title: 'Kart iadesi, sonra sunum', tag: 'EJECT_CARD → MEDIAREMOVED → PRESENT', text: 'Kart önce iade edilir; müşteri kartı alınca shutter açılır, süre sayacı başlar.' },
          {
            decision: true,
            title: 'Müşteri süresinde aldı mı? (ITEMSTAKEN)',
            branches: [
              { label: 'Hayır · süre doldu', text: 'CMD_CDM_RETRACT ile geri çekme kutusuna. 0400 (39 = 17). Simülatör: “Para alınmaz” arızası.', tone: 'warn' },
              { label: 'Evet', text: 'Sayaç “Verilen”e işlenir, fiş basılır, EJ’ye yazılır.', tone: 'ok' },
            ],
          },
          {
            decision: true,
            title: 'Kart iadesinde kart sıkıştı mı? (MEDIAJAM)',
            branches: [
              { label: 'Evet', text: 'RETAIN_CARD ile alıkonma kutusuna; müşteriye “şubeye başvurun”. Simülatör: “Kart sıkışması” arızası.', tone: 'bad' },
              { label: 'Hayır', text: 'Normal bitiş.', tone: 'ok' },
            ],
          },
          { title: 'Her durumda', tag: 'EJ · sayaç · günlük · uyarı', text: 'EJ kaydı yazılır, sayaçlar güncellenir, cihaz durumu izleme sistemine bildirilir, teknisyen işi atanır.' },
        ]}
      />
      <Table
        head={['Durum', 'Para hesaba?', 'Para fiziksel?', 'Düzeltme', 'Simülatörde']}
        rows={[
          ['Host yanıtı kayboldu', 'Düştü olabilir', 'Verilmedi', '0400, olmazsa SAF → 0420', 'Host yanıtı kaybolur'],
          ['Sıkışma', 'Düştü', 'Red kutusunda', '0400 (22), CDM reset, kutu boşaltma', 'Para sıkışması'],
          ['Para alınmadı', 'Düştü', 'Geri çekme kutusunda', '0400 (17), kutu boşaltma', 'Para alınmaz'],
          ['Kart sıkıştı', 'Para zaten verilmedi veya verildi', '—', 'Kart alıkonur, kutu boşaltma', 'Kart sıkışması'],
        ]}
      />
      <Callout tone="warn" title="“Sıkışma” bile her zaman bilinen bir sonuç değildir">
        Simülatör sıkışmada tüm banknotları red kutusuna koyar. Gerçekte bir sıkışmanın sonunda <b>kaç banknotun taşıma yolunda, kaçının müşterinin elinde olduğu
        kesin olmayabilir</b>. Çoğu zaman bunu ancak kasetleri ve kutuları <i>fiziksel olarak saymak</i> belirler; bu yüzden bu tür olaylar gün sonu denkleştirmede
        “fark” olarak çıkar ve soruşturulur.
      </Callout>

      <h2 id="firmware">Firmware, sürüm ve işletim sistemi</h2>
      <h3>Firmware güncelleme</h3>
      <ul>
        <li>
          <b>Uyumluluk matrisi:</b> cihaz firmware’i, üretici sürücüsü, SP ve ATM uygulaması birbirine bağlıdır. Üreticiler hangi firmware’in hangi sürücü ve SP
          ile test edildiğini yayımlar; bu tabloya uymayan bir kombinasyon tuhaf arızalar üretir.
        </li>
        <li>
          <b>Aşamalı dağıtım:</b> önce laboratuvarda, sonra az sayıda ATM’de (pilot), sonra tüm filoda. Bir güncelleme geri alınabilir olmalıdır (rollback planı).
        </li>
        <li>
          <b>Bakım penceresi:</b> güncelleme ATM hizmet dışıyken yapılır; güç kesilmesi riskine karşı cihazın güncelleme sırasında güvenle kalabilmesi gerekir.
        </li>
        <li>
          <b>İmzalı paketler:</b> firmware’in kaynağı ve bütünlüğü doğrulanmadan yüklenmemelidir. Aksi halde ATM saldırı yüzeyi olur.
        </li>
        <li>
          <b>Sürümü okumak:</b> uygulama genellikle cihaz sürümünü durum/yetenek bilgisinden ya da üretici aracından alır; XFS durum yapılarında üreticiye özgü “extra”
          alanlar bu amaçla kullanılır (doğrulayın). Her arıza kaydında firmware, sürücü ve SP sürümünün yazılması işi kolaylaştırır.
        </li>
      </ul>
      <h3>İşletim sistemi ve uyumluluk</h3>
      <p>
        XFS 3.x, Windows’a bağlıdır (msxfs.dll). Bu yüzden ATM yazılımı ile işletim sistemi sürümü arasındaki uyumluluk bir filo yönetimi konusudur: yeni bir
        Windows sürümü, ATM’in SP’leri ve üretici sürücüleri o sürüm için sertifikalanana kadar sahaya çıkamaz.
      </p>
      <ul>
        <li>
          <b>Doğrulayabildiğim:</b> Microsoft’un yaşam döngüsü sayfasına göre <b>Windows 10 IoT Enterprise LTSC 2021</b> için genel destek bitişi 12 Ocak 2027,
          uzatılmış destek bitişi 13 Ocak 2032’dir. Yarı yıllık kanal (SAC) sürümlerinin desteği ise 14 Ekim 2025’te bitti.
        </li>
        <li>
          <b>Doğrulayamadığım:</b> belirli bir ATM satıcısının hangi Windows sürümünü ne zamana kadar desteklediği ve ATM’ler için özel uzatılmış güvenlik
          güncellemesi seçenekleri. Bunlar satıcı bazlıdır, her satıcının duyurusundan öğrenilmelidir.
        </li>
        <li>
          <b>Genel ilke:</b> işletim sistemi geçişi tek başına bir proje değildir; EPP anahtar yönetimi, kart okuyucu SP’si, dağıtıcı SP’si ve uygulama ile birlikte
          yeniden test edilir. XFS4IoT, uygulama ile cihaz yazılımını aynı Windows’a bağlı olmaktan kurtarmayı hedefler (XFS sayfası).
        </li>
      </ul>

      <h2 id="test">Test araçları ve simülatörler</h2>
      <Table
        head={['Araç türü', 'Ne işe yarar?', 'Sınırı']}
        rows={[
          [<b key="1">Üretici simülatörleri</b>, 'Gerçek cihaz yokken SP’yi çalıştırır; kaset ve kart durumunu yazılımla taklit eder.', 'Yalnızca o üreticinin davranışını taklit eder; gerçek mekanik gecikmeleri yansıtmayabilir.'],
          [<b key="2">XFS test araçları</b>, 'Komutları elle gönderir, olayları ve hResult değerlerini görüntüler; SP’nin şartnameye uyumunu denetler.', 'Araç ve sürüm desteği satıcıya göre değişir.'],
          [<b key="3">Loopback / sahte SP</b>, 'Uygulama ile XFS arasına, belirlenmiş yanıtlar veren bir SP koyar: “şu komutta hata ver”.', 'Yeni bir yetenek eklendiğinde senaryo yazmak gerekir.'],
          [<b key="4">Arıza enjeksiyonu</b>, 'Belirli bir işlemde sıkışma, kağıt bitişi, host zaman aşımı gibi koşulları bilerek üretir.', 'Simülatörün Arıza sekmesi bunun öğretici bir örneğidir.'],
          [<b key="5">Sahada pilot</b>, 'Gerçek müşteri trafiği ve gerçek donanım toleransları.', 'Pahalı ve riskli: yalnızca laboratuvar testi geçtikten sonra.'],
        ]}
      />
      <p>
        Bir cihaz sorunu çoğu zaman “komut yanlış” değil, <b>zamanlama</b> ve <b>olay sırası</b> sorunudur. Bu yüzden testlerde yalnızca başarılı sonuçlar değil,
        gecikmeli yanıt, olayın tamamlanmadan önce gelmesi ve iptal-sonrası durum da denenmelidir (XFS sayfasındaki tuzaklar).
      </p>

      <h2 id="izleme">Uzaktan izleme ve tanılama</h2>
      <p>
        Bir ATM’nin sağlığı, cihaz durumlarının ve sayaçlarının bir <b>izleme sistemine</b> aktarılmasıyla izlenir. Kavram basittir; ürünler farklıdır:
      </p>
      <ul>
        <li>
          <b>Olaylar:</b> SYSTEM ve USER olayları (kaset azaldı, kağıt azaldı, donanım hatası, cihaz çevrimdışı) bir <b>uyarıya</b> dönüşür. Uyarı, ciddiyetine
          göre bir servis çağrısı ya da bir ikmal planı üretir.
        </li>
        <li>
          <b>Sayaçlar:</b> kaset doluluğu, alıkonan kart sayısı, kutu doluluğu. Nakit tükenmeden ikmal planlanır; simülatörde Kasetler paneli ile Teknisyen sekmesi
          bunun görünümüdür.
        </li>
        <li>
          <b>Günlükler:</b> EJ, cihaz sürücü günlüğü, XFS trace. Sorun çözümünde “kim, ne zaman, hangi komut, hangi sonuç” sorusuna bu kayıtlar cevap verir.
          Günlükte PIN, track verisi gibi hassas bilgi tutulmaz.
        </li>
        <li>
          <b>Uzaktan tanılama:</b> bazı sorunlar (cihaz reset, yazılım yeniden başlatma) uzaktan çözülebilir; mekanik sıkışmalar çözülemez. Bu yüzden uzaktan müdahale
          ile saha servisi ayrı iş akışlarıdır.
        </li>
      </ul>
      <p>
        Simülatörde <b>Olay günlüğü</b> bu bilgiyi canlı gösterir; <b>EJ</b> sekmesi işlem bazlı kaydı verir; <b>Teknisyen</b> sekmesindeki cihaz durumu, alıkonan
        kart sayısı ve SAF kuyruğu bir izleme panelinin küçük bir modelidir.
      </p>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Senaryolar simülatörde yeniden üretilebilir. Arıza işaretleri <b>bir sonraki uygun işlemde bir kez</b> tetiklenir; Teknisyen sekmesindeki düğmeler yalnızca
        <b> bakım modunda</b> çalışır ve bakım moduna yalnızca ATM boştayken geçilebilir.
      </p>
      <Tabs
        label="Cihaz sürücüsü senaryoları"
        tabs={[
          {
            label: '1 · Sıkışma sonrası kurtarma',
            content: (
              <>
                <Sequence
                  label="Sıkışmadan hizmete dönüşe kadar"
                  actors={[ACT.tech, ACT.app, ACT.cdm]}
                  steps={[
                    { sep: 'Arıza' },
                    { from: 'cdm', to: 'app', label: 'ERR_CDM_CASHUNITERROR', sub: 'sıkışma', res: true, tone: 'bad' },
                    { note: 'CDM “sıkışma” durumuna alınır\nBanknotlar red sayacına işlenir · 0400 (22) gider', at: 'app', tone: 'bad' },
                    { sep: 'Teknisyen müdahalesi' },
                    { from: 'tech', to: 'app', label: 'Bakım moduna al', sub: 'ATM boştayken', tone: 'warn' },
                    { note: 'Kapak açılır, sıkışan banknot alınır,\nkutular ve kasetler fiziksel olarak sayılır', at: 'tech' },
                    { from: 'tech', to: 'app', label: 'Arızaları gider', tone: 'ok' },
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_RESET', sub: 'cihaz yeniden başlatılır', tone: 'ok' },
                    { from: 'cdm', to: 'app', label: 'durum: OK', res: true, tone: 'ok' },
                    { from: 'tech', to: 'app', label: 'Kutuları boşalt', sub: 'red kutusu sayılıp teslim', tone: 'ok' },
                    { from: 'tech', to: 'app', label: 'Hizmete aç', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Sıkışmada önce <b>müşteri tarafı</b> kapatılır (iptal, iade), cihaz tarafı sonra düzeltilir.</>,
                    <>Teknisyen <b>fiziksel durumu</b> kontrol eder: taşıma yolunda ne kaldı, kasetlerde kaç banknot var. Yazılımın sandığı değer bununla karşılaştırılır.</>,
                    <>“Arızaları gider” yalnızca yazılım durumunu sıfırlar (<code>WFS_CMD_CDM_RESET</code>). Fiziksel sorun giderilmeden yapılırsa cihaz yeniden arıza verir.</>,
                    <>Red kutusunun içeriği sayılıp <b>Kutuları boşalt</b> ile kayda geçer. Denkleştirmede “− Red” sütunu bu banknotları açıklar; fark kalmazsa sayım doğrudur.</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Para sıkışması”nı işaretleyin; Ayşe Yılmaz ile 500 TL çekin. İşlem bitip ATM boşa geçince Teknisyen sekmesinde Bakım moduna alın.
                  Önce Denkleştirme tablosuna bakın (Red sütunu), sonra “Arızaları gider”, “Kutuları boşalt” ve “Hizmete aç”ı sırayla uygulayın; Para Çekme düğmesinin
                  yeniden açıldığını görün.
                </TryInSim>
              </>
            ),
          },
          {
            label: '2 · PIN denemesi aşıldı',
            content: (
              <>
                <Sequence
                  label="Üçüncü hatalı PIN: kart alıkonur"
                  actors={[ACT.app, ACT.idc, ACT.host]}
                  steps={[
                    { from: 'app', to: 'host', label: '0100 · PIN doğrulama', sub: 'alan 52 = şifreli PIN bloğu', tone: 'ok' },
                    { from: 'host', to: 'app', label: '0110 · 39 = 55', sub: '1. ve 2. deneme · yanlış PIN', res: true, tone: 'bad' },
                    { from: 'app', to: 'host', label: '0100 · PIN doğrulama', sub: '3. deneme', tone: 'ok' },
                    { from: 'host', to: 'app', label: '0110 · 39 = 75', sub: 'deneme sayısı aşıldı', res: true, tone: 'bad' },
                    { from: 'app', to: 'idc', label: 'CMD_IDC_RETAIN_CARD', sub: 'kart alıkonma kutusuna', tone: 'bad' },
                    { from: 'idc', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
                    { note: 'Alıkonan kart sayacı +1 · EJ: “KART ALIKONDU · 75”\nEkran: “Kartınız alıkonuldu”', at: 'app', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Karar <b>host’tan</b> gelir (PIN deneme sayacı orada tutulur); ancak <b>fiziksel eylemi</b> IDC yapar. Uygulama iki dünyayı birleştirir.</>,
                    <>Alıkonan kartın hangi ATM’de, ne zaman alıkonduğu EJ’ye yazılır; kartın akıbeti bu kayıtlarla izlenir.</>,
                    <>Alıkonma kutusunun doluluk takibi bu yüzden önemlidir: kutu dolarsa kart okuyucu yeni kart kabul edemez.</>,
                    <>Simülatör, alıkonan kartı cüzdanda kullanılamaz hale getirir ve <b>Kutuları boşalt</b> ile geri verir. Gerçekte kart iade edilmez.</>,
                  ]}
                />
                <TryInSim>
                  Elif Demir’in Mastercard (Atlas Bank) kartını takın ve PIN yerine üç kez 1111 girin (PIN 0000 doğru). Günlükte 55, 55 ve 75 kodlarını, ardından
                  WFS_CMD_IDC_RETAIN_CARD’ı görün. Kartın cüzdanda artık kullanılamadığına dikkat edin; Teknisyen sekmesinde “Alıkonan kart” sayısına bakın, sonra Kutuları
                  boşaltın.
                </TryInSim>
              </>
            ),
          },
          {
            label: '3 · EPP: PIN bloğu',
            content: (
              <>
                <Sequence
                  label="PIN’in tuşa basılmasından host’a şifreli gidişi"
                  actors={[ACT.pin, ACT.app, ACT.host]}
                  steps={[
                    { from: 'app', to: 'pin', label: 'CMD_PIN_GET_PIN', sub: 'şifreli giriş modu', tone: 'ok' },
                    { note: 'Müşteri 1-2-3-4 tuşlarına basar\nEPP rakamları kendi içinde tutar', at: 'pin' },
                    { from: 'pin', to: 'app', label: 'EXEE_PIN_KEY ×4', sub: 'uygulama rakamı görmez', res: true },
                    { from: 'pin', to: 'app', label: 'EXECUTE_COMPLETE', sub: 'ONAY tuşu', res: true, tone: 'ok' },
                    { from: 'app', to: 'pin', label: 'CMD_PIN_GET_PINBLOCK', sub: 'ISO format 0 · PAN verilir', tone: 'ok' },
                    { note: 'EPP: PIN alanı XOR PAN alanı\nPIN anahtarıyla şifreler', at: 'pin', tone: 'ok' },
                    { from: 'pin', to: 'app', label: 'şifreli PIN bloğu (8 bayt)', res: true, tone: 'ok' },
                    { from: 'app', to: 'host', label: '0100 · alan 52 = PIN bloğu', sub: 'alan 2 = PAN', tone: 'ok' },
                    { note: 'Switch/HSM bloğu çözüp PIN’i doğrular ya da başka bir anahtarla yeniden şifreleyip iletir', at: 'host', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Uygulamanın belleğinde açık PIN <b>hiçbir zaman</b> oluşmaz. Yalnızca şifreli blok ve “kaç tuşa basıldı” bilgisi vardır.</>,
                    <>GET_PINBLOCK, PIN’in şifrelendiği anı temsil eder. PAN, bloğu karta bağlamak için kullanılır (format 0).</>,
                    <>Host’ta PIN’i HSM çözer. Başka bir bankanın kartıysa blok, ağ anahtarına <b>çevrilir</b> (PIN translation); PIN düz haliyle hiçbir yerde açılmaz.</>,
                    <>Simülatörde 0100 mesajının alan 52’si bir yer tutucudur (günlükteki alan listesini açın). Gerçek şifreleme yapılmaz.</>,
                  ]}
                />
                <TryInSim>
                  Ayşe Yılmaz’ın kartını takıp PIN girin. Günlükte WFS_CMD_PIN_GET_PIN, sonra PIN’i girip ONAY’a basınca WFS_CMD_PIN_GET_PINBLOCK satırlarını ve “→ 0100
                  Yetki isteği” satırının alanlarında 52’yi görün.
                </TryInSim>
              </>
            ),
          },
          {
            label: '4 · Fiş yazıcı arızası',
            content: (
              <>
                <Sequence
                  label="PTR arızası ve işlemin etkilenmemesi"
                  actors={[ACT.app, ACT.host, ACT.tech]}
                  steps={[
                    { from: 'app', to: 'host', label: '0200 · 100,00 TRY', tone: 'ok' },
                    { from: 'host', to: 'app', label: '0210 · 39 = 00', res: true, tone: 'ok' },
                    { note: 'Para verilir, fiş basılmak istenir', at: 'app' },
                    { note: 'WFS_CMD_PTR_PRINT_FORM → WFS_ERR_PTR_PAPEROUT\nFiş basılmaz, işlem geçerli kalır', at: 'app', tone: 'warn' },
                    { note: 'EJ: işlem VERİLDİ olarak kaydedilir', at: 'app', tone: 'ok' },
                    { sep: 'Yazıcı bakımı' },
                    { from: 'tech', to: 'app', label: 'Arızaları gider', sub: 'yeni rulo', tone: 'ok' },
                    { note: 'WFS_CMD_PTR_RESET → yazıcı hizmette', at: 'app', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Fiş hatası <b>finansal sonucu değiştirmez</b>; bu yüzden iptal (0400) gerekmez.</>,
                    <>Yazıcı durumu ana ekranda “Fiş verilemiyor” notuyla görünür; kurumun politikası ayrıca fişsiz çalışmayı yasaklayabilir.</>,
                    <>Fişin yerine <b>EJ</b> kaydı denetimi sağlar. Fiş olmadan müşteri itirazlarında EJ ve host kaydı esas alınır.</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Fiş kağıdı bitsin”e basın. Ayşe Yılmaz ile 100 TL çekin; günlükte WFS_ERR_PTR_PAPEROUT’u görün, fiş çıkmaz. EJ sekmesinde işlemin
                  kaydedildiğine bakın. Bakım moduna alıp “Arızaları gider”e basın ve tekrar çekin; bu kez fiş basılır.
                </TryInSim>
              </>
            ),
          },
          {
            label: '5 · Gün sonu: sayaç farkı',
            content: (
              <>
                <Sequence
                  label="Sıkışan işlem ve gün sonu denkleştirmesi"
                  actors={[ACT.tech, ACT.app, ACT.host]}
                  steps={[
                    { sep: 'Gün içi' },
                    { note: 'Sıkışan 500 TL çekim: host borçlandı,\niptal (0400) onaylandı, banknotlar red kutusunda', at: 'app', tone: 'warn' },
                    { sep: 'Gün sonu' },
                    { from: 'tech', to: 'app', label: 'Gün sonu (0500)', sub: 'bakım modunda', tone: 'ok' },
                    { from: 'app', to: 'host', label: '0500 · sayaçlar', sub: 'borç/alacak adet ve tutar', tone: 'ok' },
                    { from: 'host', to: 'app', label: '0510 · 39 = 00', sub: 'toplamlar tuttu', res: true, tone: 'ok' },
                    { note: 'Denkleştirme: Beklenen = Açılış + İkmal + Yatan − Verilen − Red − Geri\nSayılan ile karşılaştırılır; Fark 0 olmalı', at: 'app' },
                  ]}
                />
                <Notes
                  items={[
                    <>İki ayrı mutabakat vardır: <b>para</b> (host ↔ ATM toplamları, 0500) ve <b>banknot sayısı</b> (kaset sayacı ↔ fiziksel sayım).</>,
                    <>Sıkışan çekim: host borcu iptalle kapandığı için toplamlar tutar; banknot sayısı ise red kutusu sayesinde açıklanır.</>,
                    <>Zaman aşımı + SAF kuyruğunda bekleyen iptal varken gün sonu <b>fark verir (95)</b>; kuyruk gönderilip gün sonu tekrarlanır (ISO 8583 sayfası, senaryo 5).</>,
                    <>Başarılı gün sonunda dönem kapanır; ATM yeni dönemin açılış sayacı olarak güncel kaset sayısını alır.</>,
                  ]}
                />
                <TryInSim>
                  Önce Senaryo 1’i uygulayın (sıkışma, 500 TL), Arızaları gider’e basmadan önce Teknisyen sekmesinde Denkleştirme tablosuna bakın: Red sütunu 500 TL’lik
                  banknotları gösterir ve Fark 0’dır. Sonra Gün sonu (0500) alın; Takas &amp; Mutabakat sekmesinde ATM ile host satırlarının tuttuğunu görün (iptal edilen
                  çekim host tarafında sayılmaz, ATM de bu çekimi “verildi” saymaz). Dönem kapanınca sayaçlar sıfırlanır. Ardından Arızaları gider’e basıp aynı işlemi “Host
                  yanıtı kaybolur” ile yapın ve SAF kuyruğunu göndermeden gün sonu alın: bu kez 95 farkı çıkar.
                </TryInSim>
              </>
            ),
          },
        ]}
      />

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['Katmanlar', 'Uygulama → XFS Manager → SP → üretici sürücüsü → firmware → mekanik. “Sürücü” bunlardan birkaçını kastedebilir.'],
          ['Cihaz durumu', 'Online, offline, meşgul, kullanıcı hatası, donanım hatası, cihaz yok: uygulamanın karar verdiği temel bilgi.'],
          ['IDC', 'Şerit ve çip okur; kartı iade eder ya da alıkoyar; alıkonma kutusunun doluluğu izlenir.'],
          ['EPP (PIN)', 'PIN açık hiçbir yere çıkmaz; ISO format 0 blok, PIN anahtarıyla şifrelenir; anahtarlar TMK/KEK hiyerarşisiyle taşınır.'],
          ['CDM', 'Kasetten çeker, red ve geri çekme kutuları vardır; plan (denominate) tutarı kupürlere böler.'],
          ['Sayaçlar', 'Açılış + İkmal + Yatan − Verilen − Red − Geri = Beklenen; sayılanla tutmalı.'],
          ['CIM / recycler', 'Yatırılan banknot tanınır, kesinleşince kasete girer; şüpheli olanlar inceleme kutusuna.'],
          ['PTR', 'Fiş bir kolaylıktır; kağıt bitse bile işlem geçerlidir.'],
          ['Hata kuralı', 'Emin değilsen para verme; önce kart/müşteri güvenliği; her şeyi kaydet; yalnızca arızalı cihazı kapat.'],
          ['Firmware ve OS', 'Firmware, sürücü, SP ve uygulama bir matris olarak yönetilir; işletim sistemi geçişi hepsini yeniden test ettirir.'],
          ['Test', 'Simülatör, sahte SP ve arıza enjeksiyonu; gerçek donanım testi pilotta.'],
          ['İzleme', 'Olay, sayaç ve günlükler uzak izleme sistemine akar; uyarılar servis ve ikmal işlerini tetikler.'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/switch">Switch uygulaması: ATM’den gelen mesajı karşılayan katman →</a>
      </p>
    </>
  )
}
