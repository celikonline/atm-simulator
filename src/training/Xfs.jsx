import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

const ACT = {
  app: { id: 'app', label: 'ATM Uygulaması', sub: 'Giriş/çıkış kodu' },
  idc: { id: 'idc', label: 'IDC SP', sub: 'Kart okuyucu' },
  pin: { id: 'pin', label: 'PIN SP', sub: 'EPP tuş takımı' },
  cdm: { id: 'cdm', label: 'CDM SP', sub: 'Para verme' },
  cdm2: { id: 'cdm', label: 'CDM SP', sub: 'Para verme (sıkışma)' },
  ptr: { id: 'ptr', label: 'PTR SP', sub: 'Fiş yazıcı' },
  host: { id: 'host', label: 'Banka Host', sub: 'ISO 8583' },
  tech: { id: 'tech', label: 'Teknisyen', sub: 'Servis ekranı' },
}

export default function Xfs() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · ATM yazılımı"
        title="XFS ve versiyonları"
        lead="ATM uygulaması kartı nasıl okutur, parayı hangi komutla verir, fiş yazıcı bittiğinde nasıl haber alır? Cevap, her üreticinin donanımının üstünde duran ortak bir arayüzdür: CEN/XFS. Simülatörün olay günlüğündeki WFS_CMD_… ve WFS_ERR_… satırları bu arayüzün adlarını taşır."
      />

      <h2 id="giris">XFS nedir, neden var?</h2>
      <p>
        <b>XFS</b>, <i>eXtensions for Financial Services</i> sözcüklerinin kısaltmasıdır. Finansal cihazlarla (ATM, kiosk, EFTPOS, şube cihazları) konuşan
        uygulamalar için <b>üretici bağımsız bir programlama arayüzü (API)</b> tanımlar. Kökeni Microsoft’un <b>WOSA/XFS</b> (Windows Open Services
        Architecture) çalışmasıdır; sonradan Avrupa standardizasyon kuruluşu <b>CEN</b> bünyesindeki bir çalışma grubu (CEN/XFS Workshop) tarafından
        yürütülmeye başlandı. Sektörde hâlâ “WOSA/XFS”, “CEN/XFS” ya da kısaca “XFS” denir; hepsi aynı aile.
      </p>
      <p>
        Neden gerekti? Her ATM üreticisinin kart okuyucusu, para dağıtıcısı, tuş takımı farklı bir sürücü ve komut setiyle gelir. XFS olmasaydı bir banka
        uygulaması her donanım için ayrı kod yazmak zorunda kalırdı. XFS ile uygulama <i>“bir tutar için banknot dağıt”</i> der; bunun hangi motoru, hangi
        sensörü ve hangi kasetle yapılacağı üreticinin yazdığı <b>Service Provider (SP)</b> katmanının işidir.
      </p>
      <Table
        head={['', 'XFS olmadan', 'XFS ile']}
        rows={[
          ['Uygulama kodu', 'Her üretici/model için ayrı entegrasyon', 'Tek API; cihaza özgü fark SP’de'],
          ['Donanım değişimi', 'Uygulama yeniden yazılır/test edilir', 'Aynı sınıfın başka bir SP’si ile çoğunlukla uygulama değişmez'],
          ['Test', 'Gerçek cihaz şart', 'Sahte (simulator) SP ile masaüstünde test edilebilir'],
          ['Yetenek farkı', 'Koda gömülü varsayımlar', 'Uygulama yetenekleri sorgular (WFS_INF_…_CAPABILITIES)'],
        ]}
      />
      <Callout tone="warn" title="XFS bir ağ protokolü değildir">
        XFS, ATM ile banka arasındaki bir protokol değil, <b>ATM’nin içinde</b> uygulama ile cihazlar arasındaki arayüzdür. Banka ile konuşma ISO 8583 (ya
        da NDC/DDC gibi ATM–switch protokolleri) işidir. Simülatörde de iki dünya ayrıdır: <b>XFS</b> satırları cihazı, <b>ISO</b> satırları host’u gösterir.
      </Callout>

      <h2 id="mimari">Mimari: uygulamadan donanıma katmanlar</h2>
      <Flow
        items={[
          { title: 'ATM uygulaması', tag: 'müşteri ekranları · iş kuralları', text: 'Menüler, PIN ekranı, host mesajları. Yalnızca XFS API fonksiyonlarını (WFSOpen, WFSExecute, …) çağırır ve olay/tamamlanma mesajlarını dinler. Bazen bu katman doğrudan değil, bir ATM ara yazılımı (middleware) üzerinden kullanılır.' },
          { title: 'XFS Manager', tag: 'msxfs.dll', text: 'Uygulama ile SP’ler arasındaki aracı. Mantıksal servis adını (ör. “CardReader1”) kayıt defterinden çözüp doğru SP’ye yönlendirir; istek numaralarını (request ID) üretir; sonuçları ve olayları uygulamaya mesaj olarak iletir. Cihaza özgü bir şey bilmez.' },
          { title: 'Service Provider (SP)', tag: 'cihaz sınıfı başına bir DLL', text: 'XFS’nin cihaz tarafı (SPI). IDC, PIN, CDM, PTR gibi her sınıf için ayrı SP bulunur. XFS komutunu üreticinin sürücüsüne çevirir, yanıtı XFS sonucuna dönüştürür, cihazın durumunu izler ve olay üretir.' },
          { title: 'Üretici sürücüsü / SDK', tag: 'USB · seri · CAN · özel', text: 'SP’nin donanımla konuştuğu bağlantı katmanı. Çoğu zaman SP ile aynı üreticiden gelir; bu sayfanın kapsamı dışındadır, “ATM cihaz sürücüleri” sayfasında anlatılır.' },
          { title: 'Donanım ve firmware', tag: 'okuyucu · dağıtıcı · EPP', text: 'Gerçek mekanik ve elektronik. Firmware komutları işler, sensörlerden gelen veriyi sürücüye yükseltir.' },
        ]}
      />
      <h3>Mantıksal servisler ve kayıt defteri</h3>
      <p>
        Uygulama bir cihazı doğrudan “şu DLL” diye açmaz; <b>mantıksal servis adı</b> verir. Bu adın hangi SP’ye karşılık geldiği Windows kayıt defterinde,
        <code>HKEY_LOCAL_MACHINE\SOFTWARE\XFS</code> altında tutulur. Tipik düzen: <code>LOGICAL_SERVICES</code> altında her mantıksal ad için sınıf ve SP
        referansı, <code>SERVICE_PROVIDERS</code> altında her SP için DLL yolu. Alt anahtarların ve değer adlarının tam listesi için XFS Manager
        şartnamesine bakın (doğrulayın). Böylece cihaz değişince uygulama aynı mantıksal adı kullanmaya devam eder, yalnızca kayıt defteri girişi değişir.
      </p>
      <h3>Başlıca API fonksiyonları</h3>
      <Table
        head={['Fonksiyon', 'Görevi']}
        rows={[
          [<code key="1">WFSStartUp / WFSCleanUp</code>, 'XFS Manager’ı başlatır/kapatır; uygulamanın konuşabildiği sürüm aralığını bildirir (aşağıda “Sürüm müzakeresi”).'],
          [<code key="2">WFSOpen / WFSClose</code>, 'Mantıksal servise oturum açar/kapatır; bir servis tanıtıcısı (hService) döner.'],
          [<code key="3">WFSRegister / WFSDeregister</code>, 'Hangi olay sınıflarının (sistem, kullanıcı, servis, execute) uygulamaya iletileceğini belirler.'],
          [<code key="4">WFSGetInfo</code>, 'Durum ve yetenek sorgular. Komut kodları WFS_INF_… ile başlar. Cihazı hareket ettirmez.'],
          [<code key="5">WFSExecute</code>, 'Cihaza iş yaptırır. Komut kodları WFS_CMD_… ile başlar (okut, dağıt, yazdır).'],
          [<code key="6">WFSLock / WFSUnlock</code>, 'Servisi başka uygulamalara karşı özel kullanıma alır/bırakır.'],
          [<code key="7">WFSCancelAsyncRequest</code>, 'Bekleyen asenkron isteği iptal eder.'],
          [<code key="8">WFSFreeResult</code>, 'Sonuç yapısının belleğini serbest bırakır. Sonuç belleği XFS Manager’a aittir.'],
          [<code key="9">WFSAsyncOpen / WFSAsyncExecute / WFSAsyncGetInfo …</code>, 'Aynı işlerin asenkron biçimi: çağrı hemen döner, sonuç sonradan mesajla gelir. ATM kodunda asıl kullanılan biçim budur, çünkü kart bekleme gibi işler dakikalar sürebilir.'],
        ]}
      />

      <h2 id="mesaj">Mesaj modeli ve sonuç kodları</h2>
      <p>
        XFS’nin klasik biçimi Windows mesaj döngüsüne dayanır. Asenkron bir çağrı, çağırana bir <b>istek numarası (RequestID)</b> verir. İş bitince XFS Manager
        uygulamanın penceresine bir <b>tamamlanma mesajı</b> gönderir; mesajın içinde bir <code>WFSRESULT</code> yapısı vardır: istek numarası, hangi servis,
        zaman damgası, <code>hResult</code> (sonuç kodu) ve komuta özgü veri.
      </p>
      <Table
        head={['Mesaj', 'Ne zaman gelir?']}
        rows={[
          [<code key="1">WFS_EXECUTE_COMPLETE</code>, 'Bir WFSAsyncExecute bitti (başarıyla ya da hatayla). Aynı biçimde WFS_OPEN_COMPLETE, WFS_GETINFO_COMPLETE, WFS_LOCK_COMPLETE… vardır.'],
          [<code key="2">WFS_EXECUTE_EVENT</code>, 'Komut sürerken ara olay: ör. PIN girerken her tuşa basıldığında.'],
          [<code key="3">WFS_SERVICE_EVENT</code>, 'Servisle ilgili olay: kart takıldı, kart alındı, banknotlar alındı.'],
          [<code key="4">WFS_USER_EVENT</code>, 'İnsan müdahalesi gerektiren durum: kaset azaldı, kağıt azalıyor.'],
          [<code key="5">WFS_SYSTEM_EVENT</code>, 'Cihaz/yazılım düzeyi: cihaz durumu değişti, donanım hatası, yazılım hatası.'],
        ]}
      />
      <p>
        Bir WFSRegister çağrısıyla hangi olay sınıflarını isteyeceğinizi (<code>SYSTEM_EVENTS</code>, <code>USER_EVENTS</code>, <code>SERVICE_EVENTS</code>,{' '}
        <code>EXECUTE_EVENTS</code>) seçersiniz. Tamamlanma mesajları için kayıt gerekmez; onları isteği veren zaten alır.
      </p>
      <h3>Sonuç kodu: hResult</h3>
      <p>
        Başarı <code>WFS_SUCCESS</code> (0) ile bildirilir. Hatalar <code>WFS_ERR_…</code> adıyla gelir. Genel olanlar her sınıfta bulunur, sınıfa özel olanlar
        sınıf adı taşır:
      </p>
      <Table
        head={['Kod', 'Anlamı']}
        rows={[
          [<code key="1">WFS_ERR_CANCELED</code>, 'İstek WFSCancelAsyncRequest ile iptal edildi.'],
          [<code key="2">WFS_ERR_TIMEOUT</code>, 'Verilen süre içinde iş bitmedi (ör. müşteri kartı almadı).'],
          [<code key="3">WFS_ERR_DEV_NOT_READY</code>, 'Cihaz şu anda komutu işleyemiyor.'],
          [<code key="4">WFS_ERR_HARDWARE_ERROR</code>, 'Donanım hatası bildirildi.'],
          [<code key="5">WFS_ERR_USER_ERROR</code>, 'İnsan müdahalesiyle düzelecek durum (kağıt, sıkışma, kaset).'],
          [<code key="6">WFS_ERR_LOCKED</code>, 'Servis başka bir uygulama tarafından kilitli.'],
          [<code key="7">WFS_ERR_UNSUPP_COMMAND</code>, 'Bu SP bu komutu desteklemiyor (sürüm ya da model farkı).'],
          [<code key="8">WFS_ERR_CDM_CASHUNITERROR</code>, 'Para dağıtıcıda bir kaset/birim hatası. Simülatör sıkışma için bunu yazar.'],
          [<code key="9">WFS_ERR_IDC_MEDIAJAM</code>, 'Kart okuyucuda kart sıkıştı.'],
          [<code key="10">WFS_ERR_PTR_PAPEROUT</code>, 'Yazıcıda kağıt yok.'],
        ]}
      />
      <Callout title="Kod listesi bir referans değildir">
        Yukarıdaki adlar gerçek XFS adlarıdır ama listede yalnızca öğretici olanlar yer alıyor. Tam ve güncel liste, kullandığınız sürümün ilgili bölüm
        şartnamesindedir. Hangi hatanın hangi komutta döndüğü de oradan okunur.
      </Callout>

      <h2 id="siniflar">Cihaz sınıfları</h2>
      <p>
        XFS, cihazları <b>sınıflara</b> böler. Her sınıfın kendi şartname bölümü, komut ve olay adları ve (üç harfli) öneki vardır: kart okuyucunun
        komutları <code>WFS_CMD_IDC_…</code>, para dağıtıcınınki <code>WFS_CMD_CDM_…</code> gibi. Sınıf sayısı sürümle değişmiştir (aşağıda “Sürümler”); aşağıdaki
        liste güncel 3.x ailesindeki 17 sınıftır. Hangi sınıfın hangi sürümde eklendiği için ilgili şartnameye bakın (doğrulayın).
      </p>
      <Table
        head={['Önek', 'Sınıf', 'Ne yapar?', 'Simülatörde']}
        rows={[
          [<b key="1">IDC</b>, 'Identification Card (kart okuyucu)', 'Manyetik şerit ve çipli kartı okur/yazar, kartı iade eder ya da alıkoyar.', <Sim key="s">sim</Sim>],
          [<b key="2">PIN</b>, 'PIN Keypad (EPP)', 'Güvenli PIN girişi, PIN bloğu şifreleme, anahtar yönetimi.', <Sim key="s">sim</Sim>],
          [<b key="3">CDM</b>, 'Cash Dispenser Module', 'Banknot dağıtır, sunar, geri çeker; kaset sayaçlarını yönetir.', <Sim key="s">sim</Sim>],
          [<b key="4">CIM</b>, 'Cash-In Module', 'Para yatırma: banknotları alır, tanır, kasete/recycler’a yerleştirir.', <Sim key="s">sim</Sim>],
          [<b key="5">PTR</b>, 'Printer (ve tarama)', 'Fiş, dekont, günlük yazıcıları.', <Sim key="s">sim</Sim>],
          [<b key="6">IPM</b>, 'Item Processing Module', 'Çek ve benzeri belgeleri alır, görüntüler, MICR okur.', <Sim key="s">sim</Sim>],
          [<b key="7">SIU</b>, 'Sensors and Indicators Unit', 'Kapı/kabin sensörleri, gösterge ve ışıklar, sinyal.', 'Yok (ekrandaki LED’ler yalnızca etkinlik göstergesi)'],
          [<b key="8">TTU</b>, 'Text Terminal Unit', 'Ekran ve tuş takımı (metin tabanlı terminal).', 'Yok'],
          [<b key="9">VDM</b>, 'Vendor Dependent Mode', 'Üreticiye özel bakım/servis moduna geçiş.', 'Yalnızca benzeri: Bakım modu, ama XFS komutu yazılmaz'],
          [<b key="10">CAM</b>, 'Camera', 'Güvenlik kamerası kaydı.', 'Yok'],
          [<b key="11">ALM</b>, 'Alarm', 'Alarm kurma/susturma.', 'Yok'],
          [<b key="12">CHK</b>, 'Check Reader/Scanner', 'Çek okuma/tarama (IPM ile görev kesişir).', 'Yok'],
          [<b key="13">DEP</b>, 'Depository', 'Zarf/belge yatırma kutusu.', 'Yok'],
          [<b key="14">BCR</b>, 'Barcode Reader', 'Barkod/QR okuyucu.', 'Yok (QR akışı telefon taklidiyle yapılır)'],
          [<b key="15">CRD</b>, 'Card Dispenser', 'Boş/kişisel kart dağıtımı.', 'Yok'],
          [<b key="16">CEU</b>, 'Card Embossing Unit', 'Kart kabartma/basma birimi.', 'Yok'],
          [<b key="17">BIO</b>, 'Biometrics', 'Biyometrik doğrulama.', 'Yok'],
        ]}
      />
      <p className="tr-muted">
        Sınıf adları ve önekler xfs4iot.com’un 17 sınıflık listesine göre derlendi (bağımsız bir site; resmî kaynak CEN’in şartname dosyalarıdır).
      </p>

      <h2 id="komutlar">Komut ve olay adları nasıl okunur?</h2>
      <p>
        XFS adları bir kalıba uyar: <code>WFS_</code> + <b>kategori</b> + <code>_</code> + <b>sınıf</b> + <code>_</code> + <b>ad</b>. Kategoriye bakmak, adın ne
        olduğunu söylemeye yeter:
      </p>
      <Table
        head={['Önek', 'Kategori', 'Örnek', 'Hangi çağrıyla']}
        rows={[
          [<code key="1">WFS_INF_</code>, 'Bilgi sorgusu', 'WFS_INF_CDM_STATUS · WFS_INF_PTR_CAPABILITIES', 'WFSGetInfo'],
          [<code key="2">WFS_CMD_</code>, 'Komut (iş yaptırır)', 'WFS_CMD_CDM_DISPENSE · WFS_CMD_IDC_EJECT_CARD', 'WFSExecute'],
          [<code key="3">WFS_EXEE_</code>, 'Execute olayı (komut sürerken)', 'WFS_EXEE_PIN_KEY', 'WFS_EXECUTE_EVENT mesajı'],
          [<code key="4">WFS_SRVE_</code>, 'Servis olayı', 'WFS_SRVE_CDM_ITEMSTAKEN · WFS_SRVE_IDC_MEDIAREMOVED', 'WFS_SERVICE_EVENT mesajı'],
          [<code key="5">WFS_USRE_</code>, 'Kullanıcı olayı', 'WFS_USRE_CDM_CASHUNITTHRESHOLD', 'WFS_USER_EVENT mesajı'],
          [<code key="6">WFS_SYSE_</code>, 'Sistem olayı', 'WFS_SYSE_DEVICE_STATUS · WFS_SYSE_HARDWARE_ERROR', 'WFS_SYSTEM_EVENT mesajı'],
          [<code key="7">WFS_ERR_</code>, 'Hata (hResult)', 'WFS_ERR_CDM_CASHUNITERROR', 'Tamamlanma mesajının içinde'],
        ]}
      />
      <p>
        Durum bilgisinde (<code>WFS_INF_…_STATUS</code>) her sınıf, cihaz durumunu bir sabit kümesiyle verir: çevrimiçi, çevrimdışı, güç kapalı, cihaz yok,
        donanım hatası, kullanıcı hatası, meşgul gibi (adlar <code>WFS_IDC_DEVONLINE</code>, <code>WFS_IDC_DEVHWERROR</code> gibi sınıfa özgüdür; tam küme
        sürüme göre değişir, doğrulayın). Bu durum makinesini “ATM cihaz sürücüleri” sayfasında uygulamanın bakış açısıyla ele alıyoruz.
      </p>

      <h2 id="akis">Tipik nakit çekim komut akışı</h2>
      <p>
        Aşağıdaki akış, simülatörün olay günlüğünde sırayla gördüğünüz XFS komutlarının gerçek karşılığıdır. Diyagram sadeleştirilmiştir: her çağrı gerçekte
        XFS Manager’dan geçer ve her asenkron çağrının sonunda bir <code>WFS_EXECUTE_COMPLETE</code> gelir; kalabalık olmasın diye başarı durumlarında
        yalnızca anlamlı olanları çizdik. Dört sütun: uygulama ve üç SP (IDC, PIN, CDM). XFS Manager araya girdiği için çizilmedi.
      </p>
      <Sequence
        label="Nakit çekim: açılıştan banknotların alınmasına"
        actors={[ACT.app, ACT.idc, ACT.pin, ACT.cdm]}
        steps={[
          { sep: 'Açılışta (bir kez)' },
          { note: 'WFSStartUp(sürüm aralığı) · WFSOpen("Kart1", "Pin1", "Dagitici1", "Yazici1")\nWFSRegister(sistem + servis + execute olayları)', span: ['app', 'cdm'] },
          { sep: 'Kart ve PIN' },
          { from: 'app', to: 'idc', label: 'CMD_IDC_READ_RAW_DATA', sub: 'asenkron · kart beklenir', tone: 'ok' },
          { from: 'idc', to: 'app', label: 'SRVE_IDC_MEDIAINSERTED', sub: 'kart girdi', res: true },
          { from: 'idc', to: 'app', label: 'EXECUTE_COMPLETE · izler', sub: 'şerit verisi döner', res: true, tone: 'ok' },
          { from: 'app', to: 'idc', label: 'CMD_IDC_CHIP_IO', sub: 'APDU: çip uygulaması', tone: 'ok' },
          { from: 'idc', to: 'app', label: 'EXECUTE_COMPLETE · yanıt', res: true, tone: 'ok' },
          { from: 'app', to: 'pin', label: 'CMD_PIN_GET_PIN', sub: 'EPP şifreli giriş modu', tone: 'ok' },
          { from: 'pin', to: 'app', label: 'EXEE_PIN_KEY (her tuş)', sub: 'rakam değil, “tuşa basıldı”', res: true },
          { from: 'pin', to: 'app', label: 'EXECUTE_COMPLETE', sub: 'ENTER ile bitti', res: true, tone: 'ok' },
          { from: 'app', to: 'pin', label: 'CMD_PIN_GET_PINBLOCK', sub: 'ISO-0 · PIN anahtarıyla', tone: 'ok' },
          { from: 'pin', to: 'app', label: 'şifreli PIN bloğu', res: true, tone: 'ok' },
          { note: 'Uygulama bloğu ISO 8583 alan 52’ye koyar ve host’a gönderir\nHost onayı (alan 39 = 00) gelmeden banknot dağıtılmaz', at: 'app', tone: 'warn' },
          { sep: 'Para' },
          { from: 'app', to: 'cdm', label: 'CMD_CDM_DENOMINATE', sub: 'kupür planı (karışım) hesaplanır', tone: 'ok' },
          { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE · plan', sub: 'ör. 2×200 + 1×100', res: true, tone: 'ok' },
          { from: 'app', to: 'cdm', label: 'CMD_CDM_DISPENSE', sub: 'banknotlar kasetten çekilir', tone: 'ok' },
          { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE', sub: 'hazır, henüz müşteride değil', res: true, tone: 'ok' },
          { from: 'app', to: 'idc', label: 'CMD_IDC_EJECT_CARD', sub: 'önce kart (card-before-cash)', tone: 'ok' },
          { from: 'idc', to: 'app', label: 'SRVE_IDC_MEDIAREMOVED', sub: 'müşteri kartı aldı', res: true, tone: 'ok' },
          { from: 'app', to: 'cdm', label: 'CMD_CDM_PRESENT', sub: 'shutter açılır', tone: 'ok' },
          { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
          { from: 'cdm', to: 'app', label: 'SRVE_CDM_ITEMSTAKEN', sub: 'banknotlar alındı', res: true, tone: 'ok' },
          { note: 'Ardından PTR: CMD_PTR_PRINT_FORM ile fiş basılır', at: 'app' },
        ]}
      />
      <Notes
        items={[
          <>
            <b>Açılış tek seferliktir.</b> WFSStartUp ve WFSOpen müşteri işlemi başında değil, uygulama başlarken yapılır. Simülatörün günlüğünde bu adımlar
            yoktur (aşağıya bakın).
          </>,
          <>
            <b>Kart ve çip.</b> <code>READ_RAW_DATA</code> bir komuttur; müşteri kartı takana kadar bekler. Çip uygulaması (EMV) için ayrı bir komutla,{' '}
            <code>CHIP_IO</code>, APDU’lar iletilir. EMV ayrıntısı için EMV sayfasına bakın.
          </>,
          <>
            <b>PIN uygulamaya hiç gelmez.</b> EPP, tuşlara basıldığını bildirir ama rakamı değil; PIN bloğu EPP içinde şifrelenir ve şifreli halde döner.
            Açık PIN ağa ve uygulamanın belleğine çıkmaz (ISO 8583 sayfasında alan 52).
          </>,
          <>
            <b>DENOMINATE ve DISPENSE ayrıdır.</b> İlki yalnızca “bu tutar hangi banknotlarla verilir?” sorusunun cevabı; ikincisi fiziksel çekimdir. Gerçekte
            DISPENSE dağıtıcı içindeki bir ara birime (istifleyici) çekmeyi, PRESENT ise müşteriye sunmayı yapar; simülatörün günlüğü de bu sırayı izler.
          </>,
          <>
            <b>Kart önce, para sonra.</b> Müşteri parayı alıp kartı unutmasın diye kart iade edilir, alınır; ancak ondan sonra shutter açılır. Bu sıra
            uygulama kodundadır, XFS dayatmaz.
          </>,
          <>
            <b>İki sonuç yolu:</b> PRESENT sonrası ya <code>SRVE_CDM_ITEMSTAKEN</code> gelir ya da süre dolar ve uygulama <code>CMD_CDM_RETRACT</code> verir
            (Senaryo 2).
          </>,
        ]}
      />

      <h2 id="surumler">Sürümler</h2>
      <p>
        XFS’nin sürüm numarası, API’nin ve cihaz sınıfı şartnamelerinin birlikte etiketlendiği bir sürümdür. Aşağıdaki tablo CEN’in çalışma grubu sayfaları,
        Wikipedia ve xfs4iot.com’un “editions” sayfasından derlendi. <b>Kaynaklar yıl konusunda zaman zaman ayrışıyor</b> (onay tarihi ile yayın tarihi farklı
        olabiliyor); ayrışan yerleri açıkça belirttik.
      </p>
      <Table
        head={['Sürüm', 'Yayın / yıl', 'Doküman', 'Bilinenler']}
        rows={[
          [<b key="1">1.x (WOSA/XFS)</b>, '1995 (1.11)', 'Microsoft', 'Wikipedia’ya göre WOSA/XFS 1.11, 1995’te çıktı. Bu aşamada CEN değil Microsoft önderliğindeki bir sektör çalışmasıydı.'],
          [<b key="2">2.00</b>, 'Aralık 1998 (CEN)', 'CWA 13449', 'CEN’in ilk yayını; 10 sınıf: dağıtıcı, kart okuyucu, PIN, yazıcı, depository, çek okuyucu, sensörler, metin terminali, kamera, VDM. Wikipedia WOSA/XFS 2.0’ı 1997 olarak, CEN’in benimsemesini 1998 olarak yazıyor: 24 saat gözetimsiz çalışma desteği bu dönemde.'],
          [<b key="3">3.00</b>, 'Kasım 2000', 'CWA 14050', '13 sınıf. 3.00’dan 3.10’a bölüm numaralaması yeniden yapılmış (xfs4iot.com).'],
          [<b key="4">3.10</b>, 'Kasım 2007 onay · 2008 yayın (kaynaklar farklı)', 'CWA 15748', '16 sınıf. CEN sayfasına göre yeni komutlar, özellikler ve yeni cihaz sınıfları getirdi; yeni sınıflar arasında IPM (Item Processing Module) var. EMV/PIN gibi ayrıntıları bu sürüme bağlayan bir kaynak bulamadım: doğrulayın.'],
          [<b key="5">3.20</b>, 'Aralık 2011', 'CWA 16374', 'Yeni sınıf yok; mevcut cihazların işlev ve yeteneklerini genişletti. Hangi komutların eklendiği için ilgili migration (3.10 → 3.20) dokümanlarına bakın.'],
          [<b key="6">3.30</b>, 'Mart 2015 (CEN sayfası) · Ağustos 2015 (xfs4iot.com)', 'CWA 16926', 'Yeni sınıf yok. CEN sayfasına göre EMV akıllı temassız okuyucu desteği, TR-34 (uzaktan anahtar yükleme), şifreleyen dokunmatik ekran, çeşitli cihazlarda shutter sıkışma durumunun daha iyi raporlanması ve Asya pazarına yönelik bazı komutlar. Yazıcı bölümü büyüdü: eskiden üreticiye bırakılan davranışlar tanımlandı.'],
          [<b key="7">3.40</b>, 'Onay Aralık 2019 · yayın Şubat 2020', 'CWA 16926', '17 sınıf (bir sınıf eklendi; hangisi olduğunu doğrulayın). CEN sayfasına göre önceki 3.x’ten geçiş, geriye uyumluluk gözetilerek tasarlandığı için yönetilebilir bir işti.'],
          [<b key="8">3.50</b>, 'Aralık 2022', 'CWA 16926', 'Yalnızca ikincil kaynaklarda (Wikipedia, xfs4iot.com) gördüm; CEN’den doğrulayamadım. 17 sınıf: 3.40 ile aynı. Ayrıntı için doğrulayın.'],
        ]}
      />
      <Callout tone="warn" title="Yıl konusunda dikkat">
        CEN çalışma grubunun sayfaları bir sürümü bazen <i>onay</i> yılıyla, Wikipedia gibi ikincil kaynaklar <i>yayın</i> yılıyla verir. Yazışmada ya da
        belgede sürüm tarihi vermeniz gerekiyorsa CWA numarasını ve CEN’in kendi sayfasını esas alın.
      </Callout>

      <h3>XFS4IoT: yeni nesil</h3>
      <p>
        XFS 3.x, <b>Windows’a bağlı C arayüzü</b> üzerine kuruludur: uygulama ve SP’ler aynı Windows makinede çalışır, mesaj döngüsü Windows’tur. Bunun yerine
        <b> XFS4IoT</b> cihazlara <b>güvenli WebSocket</b> bağlantısı üzerinden <b>JSON</b> mesajlarıyla erişir; uygulama ile cihaz yazılımının aynı Windows PC’de
        olması gerekmez. XFS4IoT, CEN tarafından <b>CWA 17852</b> numarasıyla yayımlanır.
      </p>
      <Table
        head={['Konu', 'Bildiklerim', 'Notlar']}
        rows={[
          ['İlk sürüm', '2021 (KAL’a göre Aralık 2020’de önizleme olarak yayımlandı)', 'Önizleme ile “resmî” yayın ayrı tarihler olabilir.'],
          ['Sonraki sürümler', 'xfs4iot.com: 2021-01, 2023-02, 2024-03 (ayrıca ileri tarihli bir önizleme listeliyor)', 'Bağımsız site; CEN’in dosya adlarında 2021-1 ve 2024-03 gibi adlar geçiyor. Güncel durumu CEN’den doğrulayın.'],
          ['Taşıma ve biçim', 'Güvenli WebSocket + JSON', 'İşletim sistemi bağımsız, bulutla konuşmaya uygun olacak şekilde tasarlandığı anlatılıyor.'],
          ['XFS 3.x ile ilişki', 'Geriye dönük uyumlu değil', 'KAL’ın 2023 ATMIA sunumu bunu açıkça söylüyor. İki nesil sahada birlikte yaşıyor; eski ATM’ler XFS 3.x çalıştırıyor.'],
          ['Açık kaynak', 'KAL’ın başlattığı SP-Dev çalışma grubu açık kaynaklı bir çerçeve geliştiriyor; kod GitHub’da', 'Üyelik sayıları kaynaktan kaynağa değişiyor, rakam vermiyorum.'],
          ['ATMIA', 'ATMIA konferanslarında sunumlar yapılıyor', 'Standardı yöneten kuruluş CEN XFS Workshop’tur; ATMIA’nın sahipliği olduğunu doğrulayamadım.'],
        ]}
      />
      <p className="tr-muted">
        Not: “CEN/TS 17724” gibi bir numara duyduysanız, doğrulayamadım; doğrulayabildiğim yayın numarası CWA 17852’dir.
      </p>

      <h2 id="uyum">Sürüm müzakeresi ve uyumluluk</h2>
      <p>
        XFS’de uygulama “ben tam şu sürümü konuşuyorum” demez; <b>konuşabildiği aralığı</b> bildirir ve XFS Manager ile SP bunun içinden ortak bir sürüm
        seçer. Bu iki yerde olur:
      </p>
      <Flow
        items={[
          { title: 'WFSStartUp', tag: 'dwVersionsRequired → WFSVERSION', text: 'Uygulama kabul edeceği alt ve üst API sürümünü verir; XFS Manager seçtiği sürümü, kendi desteklediği aralığı ve açıklama metnini bir WFSVERSION yapısında döndürür. Ortak sürüm yoksa API sürümüyle ilgili bir hata gelir (WFS_ERR_API_VER_TOO_LOW / TOO_HIGH).' },
          { title: 'WFSOpen', tag: 'dwSrvcVersionsRequired · lpSrvcVersion · lpSPIVersion', text: 'Her servis için ayrıca: cihaz sınıfı şartnamesinin (servis) sürümü ve SP arayüzü (SPI) sürümü müzakere edilir. Aynı ATM’de IDC SP 3.10, CDM SP 3.30 olabilir.' },
          { title: 'Yetenek sorgusu', tag: 'WFS_INF_…_CAPABILITIES', text: 'Sürüm eşleşmesi “komut var mı?” sorusunu çözmez. Uygulama, cihazın gerçekte neyi yapabildiğini yetenek sorgusuyla öğrenir ve ona göre dallanır (ör. “bu yazıcı resim basabilir mi?”).' },
          { decision: true, title: 'Komut desteklenmiyor mu?', branches: [{ label: 'WFS_ERR_UNSUPP_COMMAND', text: 'SP bu komutu bilmiyor: yedek yol kullan ya da özelliği kapat.', tone: 'warn' }, { label: 'Başarı', text: 'Devam.', tone: 'ok' }] },
        ]}
      />
      <ul>
        <li>
          <b>Sürüm kodlaması:</b> sürüm numarası bir sözcüğe sığdırılır; düşük bayt ana sürümü, yüksek bayt alt sürümü taşır (3.10 için ana 3, alt 10 → 0x0A03).
          Bu biçimi uygulamadan önce şartnameden doğrulayın.
        </li>
        <li>
          <b>Geriye uyumluluk:</b> 3.x ailesi içinde yeni sürümlerin geriye uyumlu olması hedeflenmiştir; CEN’in 3.40 sayfası migration’ın geriye uyumluluk
          gözetilerek tasarlandığını söyler. Yine de “hedeflenmiş” demek “garantili” demek değildir: davranışı belirsiz bırakılmış yerleri farklı SP’ler farklı
          yorumlayabilir. 3.30 yazıcı bölümünün büyümesi (eskiden üreticiye bırakılanları tanımlaması) bu yüzdendir.
        </li>
        <li>
          <b>XFS4IoT ile XFS 3.x</b> arasında ikili uyumluluk yoktur; ara katman veya yeniden yazım gerekir. KAL’ın SP-Dev çerçevesinin XFS3 uygulamalarının
          taşınmasına yardım edebildiği anlatılıyor, ayrıntıyı doğrulayın.
        </li>
      </ul>

      <h2 id="satici">Satıcılar ve SP’ler</h2>
      <p>
        XFS standarttır ama SP’yi yazan çoğunlukla <b>cihazı üreten şirkettir</b>, ve bu SP’lerin üstüne oturan bir ATM uygulama/ara yazılım ailesi vardır.
        Aşağıdaki eşleşmeyi bildiğim kadarıyla veriyorum; ürün adları ve sahiplikler (satın almalar, ayrılmalar) zamanla değişir, doğrulayın.
      </p>
      <Table
        head={['Taraf', 'Bilinen yazılım adları', 'Not']}
        rows={[
          ['NCR (ATM işi NCR Atleos)', 'APTRA XFS, APTRA Activate', 'APTRA XFS, NCR cihazları için SP paketidir. Şirket yapısı değişti (doğrulayın).'],
          ['Diebold Nixdorf', 'Agilis; Wincor kökenli ProTopas, ProBase', 'Wincor Nixdorf’un ürün adları. Hangisinin sürücü, hangisinin uygulama katmanı olduğu sürüme göre değişir (doğrulayın).'],
          ['KAL', 'Kalignite', 'ATM yazılımı üreticisi; XFS4IoT SP-Dev çalışma grubunu yürütüyor (ürün ayrıntısını doğrulayın).'],
          ['Hyosung, GRG ve diğerleri', 'Kendi SP paketleri', 'Ürün adlarından emin değilim, yazmıyorum.'],
        ]}
      />
      <Callout title="“XFS uyumlu” yeterli bir cümle değildir">
        Aynı sınıf ve sürümde iki farklı SP, şartnamenin boş bıraktığı noktalarda farklı davranabilir: olayların sırası, ara durumlar, hata kodu seçimi.
        Çok üreticili bir filoda uygulama her SP için sahada test edilmelidir.
      </Callout>

      <h2 id="tuzaklar">Sık düşülen tuzaklar</h2>
      <Table
        head={['Tuzak', 'Neden bir sorun', 'Ne yapmalı?']}
        rows={[
          [<b key="1">İptal sandığınız şey</b>, 'WFSCancelAsyncRequest isteği iptal eder ama donanımda başlamış bir işlem geri alınmaz. İptal edilen DISPENSE’in bir kısmı çıkmış olabilir.', 'İptalden sonra durum sorgusu (STATUS / sayaçlar) ile gerçek hali okuyun.'],
          [<b key="2">Zaman aşımı ≠ başarısızlık</b>, 'Verilen süre dolduğunda cihazda eylem hâlâ sürüyor ya da tamamlanmış olabilir (ör. banknotlar sunulmuş ama alınmamış).', 'Zaman aşımından sonra cihazın durumunu okuyun; ardından RETRACT/RESET gibi temizlik komutunu açıkça verin.'],
          [<b key="3">Kilitleme</b>, 'WFSLock ile alınan kilit bırakılmazsa başka uygulamalar WFS_ERR_LOCKED alır.', 'Her kilidi try/finally ile bırakın; kilit isteği olayına (lock requested) saygı gösterin.'],
          [<b key="4">Olay sırası</b>, 'Execute olayları tamamlanma mesajından önce gelir; farklı servislerin olayları arasında sıra garantisi yoktur.', 'Durum makinenizi “tamamlanma + olay” birleşimine göre kurun; tek bir olaya güvenmeyin.'],
          [<b key="5">Başka iş parçacığında tamamlanma</b>, 'Asenkron sonuç, çağrıyı yapandan farklı bir iş parçacığı/mesaj döngüsünde gelir.', 'Sonucu hemen kendi yapınıza kopyalayıp WFSFreeResult çağırın; UI işini doğru iş parçacığına yönlendirin.'],
          [<b key="6">Yetenekleri varsaymak</b>, 'Bir model yazıcıda resim basar, diğeri basmaz.', 'WFS_INF_…_CAPABILITIES ile yeteneği okuyup dallanın.'],
          [<b key="7">Hata sonrası eski durum</b>, 'Hata sonrası cihaz yarım kalmış durumda olabilir; sonraki komut yanlış sonuç verir.', 'Her hatada STATUS okuyun, gerekiyorsa RESET gönderin, ancak sonra yeni işleme başlayın.'],
        ]}
      />

      <h2 id="simulator">Simülatörde XFS</h2>
      <p>
        Simülatör, olay günlüğüne <b>XFS katmanı</b> satırları yazar ve cihazların etkinliğini ATM’nin üzerindeki ışıklarla gösterir. Gerçek bir XFS yığını
        çalıştırmaz; yalnızca komut/olay adlarını ve sıralarını gerçekçi biçimde üretir. Normal bir çekimde günlükte sırayla şunları görürsünüz:
      </p>
      <Table
        head={['Sıra', 'Günlükteki ad', 'Ne zaman?']}
        rows={[
          ['1', <code key="a">WFS_CMD_IDC_READ_RAW_DATA</code>, 'Cüzdandan kart takılınca'],
          ['2', <code key="b">WFS_CMD_IDC_CHIP_IO</code>, 'Çip okunur; AID gösterilir (EMV sayfası)'],
          ['3', <code key="c">WFS_CMD_PIN_GET_PIN</code>, 'PIN ekranı açılırken'],
          ['4', <code key="d">WFS_CMD_PIN_GET_PINBLOCK</code>, 'PIN’i girip ONAY’a basınca'],
          ['5', <code key="e">WFS_CMD_CDM_DENOMINATE</code>, 'Para çekme tutarı istenince, host’a gitmeden hemen önce'],
          ['6', <code key="f">WFS_CMD_CDM_DISPENSE</code>, 'Host onayladıktan sonra'],
          ['7', <code key="g">WFS_CMD_IDC_EJECT_CARD</code>, 'Kart iade edilir (para henüz yok)'],
          ['8', <code key="h">WFS_SRVE_IDC_MEDIAREMOVED</code>, 'Karta tıklayıp alınca'],
          ['9', <code key="i">WFS_CMD_CDM_PRESENT</code>, 'Shutter açılır, banknotlar görünür'],
          ['10', <code key="j">WFS_SRVE_CDM_ITEMSTAKEN</code>, 'Banknotlara tıklayınca'],
          ['11', <code key="k">WFS_CMD_PTR_PRINT_FORM</code>, 'Fiş basılır'],
        ]}
      />
      <Callout tone="warn" title="Simülatör neyi basitleştiriyor?">
        Günlükte <b>yalnızca komut ve bazı olay adları</b> yazılır. WFSStartUp/WFSOpen/WFSRegister, istek numaraları, <code>WFS_EXECUTE_COMPLETE</code>,{' '}
        <code>hResult</code> değerleri, sistem olayları, kilitleme ve sürüm müzakeresi yoktur. PIN gerçek bir EPP’de şifrelenmez: demo için doğrulama
        isteğiyle host’a iletilir; günlükteki “ISO-0 formatında şifrelendi” açıklaması bir anlatımdır. Kart takılırken <code>SRVE_IDC_MEDIAINSERTED</code> yazılmaz.
        Paper-out eşiği için günlük <code>WFS_SRVE_PTR_PAPERTHRESHOLD</code> adını kullanır; gerçek şartnamede eşik olayları kullanıcı olayı (<code>USRE</code>)
        sınıfındadır, doğrulayın. Sıkışma da gerçekte sıkışmanın yerine göre farklı kodlarla bildirilebilir; simülatör tek bir kod yazar.
      </Callout>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Her senaryo simülatörde yeniden üretilebilir. Arıza sekmesindeki işaret <b>bir sonraki uygun işlemde bir kez</b> tetiklenir. Teknisyen sekmesindeki
        düğmeler yalnızca <b>bakım modunda</b> çalışır ve bakım moduna ancak ATM boştayken (ekran “Hoş geldiniz”) geçilir.
      </p>
      <Tabs
        label="XFS senaryoları"
        tabs={[
          {
            label: '1 · Para sıkışması',
            content: (
              <>
                <Sequence
                  label="Host onayladı, banknotlar taşıma yolunda sıkıştı"
                  actors={[ACT.cdm2, ACT.app, ACT.host]}
                  steps={[
                    { from: 'app', to: 'host', label: '0200 · 500,00 TRY', tone: 'ok' },
                    { from: 'host', to: 'app', label: '0210 · 39 = 00', sub: 'hesap borçlandı', res: true, tone: 'ok' },
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_DISPENSE', sub: 'banknotlar çekiliyor', tone: 'ok' },
                    { from: 'cdm', to: 'app', label: 'ERR_CDM_CASHUNITERROR', sub: 'taşıma yolunda sıkışma', res: true, tone: 'bad' },
                    { note: 'Banknotlar red kutusuna alınır\nCDM devre dışı kalır', at: 'cdm', tone: 'bad' },
                    { from: 'app', to: 'host', label: '0400 · iptal · 39 = 22', sub: 'cihaz arızası', tone: 'warn' },
                    { from: 'host', to: 'app', label: '0410 · 39 = 00', sub: 'borç iade edildi', res: true, tone: 'ok' },
                    { note: 'Ekran: “Teknik arıza”\nPara verilemedi, tutar iade edildi', at: 'app', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Host parayı düşmüştür; ancak <b>fiziksel teslim</b> olmamıştır. Uygulama bu uyuşmazlığı hemen kapatmak zorundadır: <b>0400 iptal</b>.</>,
                    <>Dağıtılamayan banknotlar <b>red kutusuna</b> gider; kasetten çıktıkları için kaset sayaçları azalır. Gün sonu denkleştirmede “− Red” sütununda görünür.</>,
                    <>CDM “sıkışma” durumuna alınır: menüde “Para çekme” kapanır, ekranda “Para verme geçici olarak hizmet dışı” notu çıkar. Diğer işlemler (bakiye, yatırma) çalışır.</>,
                    <>Düzeltme teknisyenin işidir: Teknisyen sekmesinde <b>Arızaları gider</b> <code>WFS_CMD_CDM_RESET</code> yazar ve CDM yeniden hizmete girer.</>,
                    <>Gerçekte sıkışmanın yerine göre farklı hata kodları ve olaylar gelebilir; simülatör <code>WFS_ERR_CDM_CASHUNITERROR</code>’u temsil olarak kullanır.</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Para sıkışması”nı işaretleyin. Ayşe Yılmaz’ın Visa kartını (PIN 1234) takın, Para Çekme → 500 TL seçin. Günlükte DISPENSE, sonra
                  ERR_CDM_CASHUNITERROR ve 0400 (39 = 22) satırlarını görün. “Kartımı Ver”e basıp kartı alın; ATM boşa geçince Teknisyen sekmesinde Bakım moduna
                  alın. Denkleştirme tablosunda Red sütunundaki banknotlara bakın, sonra “Arızaları gider” ve “Kutuları boşalt” deneyin.
                </TryInSim>
              </>
            ),
          },
          {
            label: '2 · Para alınmadı',
            content: (
              <>
                <Sequence
                  label="Banknotlar sunuldu, müşteri almadı: geri çekme"
                  actors={[ACT.app, ACT.cdm, ACT.host]}
                  steps={[
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_PRESENT', sub: 'shutter açık, banknotlar dışarıda', tone: 'ok' },
                    { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
                    { note: 'Uygulama bir süre sayacı başlatır: 6 sn', at: 'app', tone: 'warn' },
                    { note: 'Müşteri banknotlara dokunmaz → ITEMSTAKEN gelmez', at: 'cdm', tone: 'warn' },
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_RETRACT', sub: 'banknotlar geri çekme kutusuna', tone: 'warn' },
                    { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
                    { from: 'app', to: 'host', label: '0400 · iptal · 39 = 17', sub: 'müşteri parayı almadı', tone: 'warn' },
                    { from: 'host', to: 'app', label: '0410 · 39 = 00', sub: 'borç iade edildi', res: true, tone: 'ok' },
                    { note: 'Ekran: “Paranız geri çekildi”', at: 'app', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Sunulan banknotlar bir süre müşteriyi bekler. Süreyi <b>uygulama</b> koyar (simülatörde 6 sn). Gerçek sistemlerde bu süre uygulamanın/işletmecinin yapılandırmasına bağlıdır.</>,
                    <>Süre dolunca uygulama <code>CMD_CDM_RETRACT</code> verir. Banknotlar <b>geri çekme kutusuna</b> (retract bin) gider: bu kutu red kutusundan ayrıdır, çünkü banknotlar fiziksel olarak sorunsuzdur ama müşteriye ulaşmamıştır.</>,
                    <>Hesap host tarafında düşmüştür: <b>0400 (39 = 17)</b> ile iade edilir. Kaset sayaçları azalmıştır, geri çekme kutusunda artış görülür; Denkleştirmede “− Geri” sütunu.</>,
                    <>Gerçek ATM’de müşteri banknotları alırsa <code>SRVE_CDM_ITEMSTAKEN</code> geri sayımı durdurur (Normal akış).</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Para alınmaz”ı işaretleyin. Ayşe Yılmaz’ın Visa kartıyla (PIN 1234) 200 TL çekin. Önce karta tıklayıp kartı alın; sonra
                  banknotlara dokunmayın, ekrandaki 6 saniyelik geri sayımı izleyin. Günlükte WFS_CMD_CDM_RETRACT ve 0400 (39 = 17) çıkar. Teknisyen sekmesinde geri çekme
                  kutusunun sayısını görün.
                </TryInSim>
              </>
            ),
          },
          {
            label: '3 · Kart sıkışması',
            content: (
              <>
                <Sequence
                  label="Kart iade edilirken okuyucuda sıkıştı"
                  actors={[ACT.app, ACT.idc]}
                  steps={[
                    { from: 'app', to: 'idc', label: 'CMD_IDC_EJECT_CARD', tone: 'ok' },
                    { from: 'idc', to: 'app', label: 'ERR_IDC_MEDIAJAM', sub: 'kart okuyucuda sıkıştı', res: true, tone: 'bad' },
                    { from: 'app', to: 'idc', label: 'CMD_IDC_RETAIN_CARD', sub: 'kart alıkonma kutusuna', tone: 'warn' },
                    { from: 'idc', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
                    { note: 'Ekran: “Kartınız alıkonuldu”\nKart cüzdandan kullanılamaz', at: 'app', tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Kart iade edilirken mekanik sorun çıkarsa uygulama <b>kartı güvenli tarafta tutar</b>: bırakmak yerine alıkonma kutusuna alır.</>,
                    <>Simülatör alıkonan kartı sayar (Teknisyen sekmesinde “Alıkonan kart”) ve cüzdanda o kartı kullanılamaz hale getirir.</>,
                    <>Kartı geri vermenin yolu teknisyendir: <b>Kutuları boşalt</b> alıkonan kartları “şubeye teslim eder”; demo kolaylığı için kartlar cüzdana geri döner.</>,
                    <>Aynı alıkonma komutu <b>PIN 3 kez yanlış</b> girildiğinde de kullanılır (ISO 8583 sayfasında alan 39 = 75). İki durum farklı nedenlerle aynı komuta varır.</>,
                    <>Gerçekte kartı alıkoyma kararı SP’nin durumuna da bağlıdır (kart okuyucunun hangi aşamada sıkıştığı). Simülatör tek bir yol gösterir.</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Kart sıkışması”nı işaretleyin. Ayşe Yılmaz’ın Visa kartını (PIN 1234) takıp PIN ile girin; menüde “Kartımı Ver”e
                  basın. Günlükte WFS_ERR_IDC_MEDIAJAM ve WFS_CMD_IDC_RETAIN_CARD’ı görün. Not: sıkışma yalnızca “Kartımı Ver” yolunda tetiklenir, para çekimdeki
                  kart-önce-para iadesinde tetiklenmez. Sonra Teknisyen sekmesinden Kutuları boşaltarak kartı geri alın.
                </TryInSim>
              </>
            ),
          },
          {
            label: '4 · Fiş kağıdı bitti',
            content: (
              <>
                <Sequence
                  label="Yazıcı kağıdı biter; işlem fişsiz tamamlanır"
                  actors={[ACT.app, ACT.ptr, ACT.tech]}
                  steps={[
                    { from: 'ptr', to: 'app', label: 'PTR eşik/bitiş bildirimi', sub: 'simülatör: SRVE_PTR_PAPERTHRESHOLD', res: true, tone: 'warn' },
                    { note: 'Para çekme başarılı\nfiş basılmak istenir', at: 'app' },
                    { from: 'app', to: 'ptr', label: 'CMD_PTR_PRINT_FORM', tone: 'ok' },
                    { from: 'ptr', to: 'app', label: 'ERR_PTR_PAPEROUT', sub: 'kağıt yok', res: true, tone: 'bad' },
                    { note: 'Para yine verilir, fiş yok\nEkranda: “Fiş verilemiyor”', at: 'app', tone: 'warn' },
                    { sep: 'Teknisyen' },
                    { from: 'tech', to: 'app', label: 'Arızaları gider', sub: 'yeni rulo takıldı', tone: 'ok' },
                    { from: 'app', to: 'ptr', label: 'CMD_PTR_RESET', sub: 'yazıcı hizmette', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Fiş hatası <b>bir finansal işlemi bozmaz</b>: para verilir, ama fiş basılamaz. Müşteriye bu söylenir (ana ekranda “Fiş verilemiyor” notu).</>,
                    <>Denetim izi yine tutulur: ATM’nin <b>elektronik günlüğü (EJ)</b> işlemi kaydeder; fişin olmaması kaydı etkilemez.</>,
                    <>Gerçekte yazıcı kağıdı bitmeden önce bir <b>eşik uyarısı</b> verir (“kağıt azalıyor”), böylece teknisyen önceden müdahale edebilir. Simülatörde bunu tek düğme (“Fiş kağıdı bitsin”) temsil eder.</>,
                    <>Düzeltme: Teknisyen sekmesinde <b>Arızaları gider</b> yazıcıyı (<code>WFS_CMD_PTR_RESET</code>) hizmete döndürür.</>,
                  ]}
                />
                <TryInSim>
                  Arıza sekmesinde “Fiş kağıdı bitsin”e basın. Ayşe Yılmaz ile 100 TL çekin: günlükte WFS_ERR_PTR_PAPEROUT çıkar, fiş verilmez. Bakım moduna alıp “Arızaları
                  gider”e basın ve tekrar deneyin. Elektronik günlük (EJ) sekmesinde işlemin yine de kaydedildiğini görün.
                </TryInSim>
              </>
            ),
          },
          {
            label: '5 · Zaman aşımı ve iptal',
            content: (
              <>
                <Sequence
                  label="Müşteri PIN girmedi: asenkron istek ve iptal"
                  actors={[ACT.app, ACT.pin]}
                  steps={[
                    { from: 'app', to: 'pin', label: 'WFSAsyncExecute(GET_PIN)', sub: 'dwTimeOut = 30 sn · RequestID = 17', tone: 'ok' },
                    { note: 'Müşteri tuşlara dokunmaz…', at: 'pin', tone: 'warn' },
                    { from: 'pin', to: 'app', label: 'EXECUTE_COMPLETE', sub: 'hResult = ERR_TIMEOUT · RequestID = 17', res: true, tone: 'bad' },
                    { note: 'Uygulama oturumu kapatır: kartı iade eder', at: 'app', tone: 'warn' },
                    { sep: 'Alternatif: müşteri İPTAL’e basar' },
                    { from: 'app', to: 'pin', label: 'WFSAsyncExecute(GET_PIN)', sub: 'RequestID = 18', tone: 'ok' },
                    { from: 'app', to: 'pin', label: 'WFSCancelAsyncRequest(18)', tone: 'warn' },
                    { from: 'pin', to: 'app', label: 'EXECUTE_COMPLETE', sub: 'hResult = ERR_CANCELED · RequestID = 18', res: true, tone: 'warn' },
                  ]}
                />
                <Notes
                  items={[
                    <>Her asenkron çağrı bir <b>istek numarası</b> alır; tamamlanma mesajı aynı numarayı taşır. Eşleştirmenin anahtarı budur (ISO 8583’teki STAN’a benzer bir rol).</>,
                    <>Süre <b>çağrı başına</b> verilir (<code>dwTimeOut</code>). Süre dolunca XFS <code>WFS_ERR_TIMEOUT</code> ile tamamlar; uygulama bundan sonra ne yapacağına kendisi karar verir.</>,
                    <>İptal <b>istek tarafından</b> verilen bir karardır ve istek numarasına bağlıdır; iptal edilen isteğin tamamlanma mesajı da <b>yine gelir</b> (ERR_CANCELED).</>,
                    <>Bu sayfadaki akış <b>soyuttur</b>; simülatörde PIN, kart bekleme gibi cihaz zaman aşımları yoktur. Simülatörde zaman aşımına en yakın şey para alma süresidir (Senaryo 2); host yanıtının kaybolması ise XFS değil ISO 8583 konusudur.</>,
                  ]}
                />
                <TryInSim>
                  Simülatörde cihaz zaman aşımı yok. Yakın olanı: Arıza sekmesinde “Para alınmaz” ile 6 saniyelik sayacı izleyin (Senaryo 2). Host zaman aşımı için “Host yanıtı
                  kaybolur”u seçip para çekin: bu ISO 8583 sayfasındaki “Zaman aşımı ve iptal” senaryosudur.
                </TryInSim>
              </>
            ),
          },
          {
            label: '6 · Kaset değişimi',
            content: (
              <>
                <Sequence
                  label="Teknisyen kasetleri doldurur: exchange oturumu"
                  actors={[ACT.tech, ACT.app, ACT.cdm]}
                  steps={[
                    { from: 'tech', to: 'app', label: 'Bakım moduna al', sub: 'ATM hizmet dışı', tone: 'warn' },
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_START_EXCHANGE', sub: 'kaset değişimi başlıyor', tone: 'ok' },
                    { note: 'Kasetler fiziksel olarak çıkarılır, doldurulur,\nyerine takılır', at: 'cdm' },
                    { from: 'app', to: 'cdm', label: 'CMD_CDM_END_EXCHANGE', sub: 'yeni sayılar bildirilir', tone: 'ok' },
                    { from: 'cdm', to: 'app', label: 'EXECUTE_COMPLETE', res: true, tone: 'ok' },
                    { note: 'EJ’ye “KASET İKMALİ” yazılır', at: 'app' },
                    { from: 'tech', to: 'app', label: 'Hizmete aç', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <><b>Exchange</b> oturumu, kaset bilgisinin elle değiştirileceğini CDM’e bildirir. Aksi halde yazılımın sayaçları ile kasetteki gerçek banknot sayısı ayrışır.</>,
                    <>Simülatörde <b>Kasetleri doldur</b> kasetleri kapasiteye tamamlar (200 TL → 60, 100 TL → 80, 50 TL → 100, 20 TL → 60) ve günlüğe START_EXCHANGE, sonra eklenen tutarla END_EXCHANGE yazar.</>,
                    <>Eklenen banknotlar Denkleştirme tablosunun “+ İkmal” sütununa girer; böylece beklenen ile sayılan değer tutar.</>,
                    <>Gerçekte kaset değişimi sırasında CDM güvenlik kurallarına bağlıdır (kapı kilitleri, SIU sensörleri); simülatör bunları göstermez.</>,
                  ]}
                />
                <TryInSim>
                  Teknisyen sekmesinde ATM boştayken Bakım moduna alın, “Kasetleri doldur”a basın. Günlükte START_EXCHANGE / END_EXCHANGE’i, sol paneldeki Kasetler
                  çubuklarının dolduğunu ve Denkleştirme tablosunda “+ İkmal”i görün.
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
          ['XFS', 'Finansal cihazlar için üretici bağımsız API (CEN/XFS, kökeni WOSA/XFS).'],
          ['XFS Manager', 'msxfs.dll: mantıksal servisi çözer, istekleri SP’ye, sonuçları uygulamaya iletir.'],
          ['Service Provider', 'Cihaz sınıfına özel DLL; XFS komutunu üretici sürücüsüne çevirir.'],
          ['WFSExecute / WFSGetInfo', 'Komut (WFS_CMD_…) çalıştırır / durum ve yetenek (WFS_INF_…) okur.'],
          ['Mesajlar', 'EXECUTE_COMPLETE, EXECUTE_EVENT, SERVICE/USER/SYSTEM_EVENT: iş bitti ya da bir şey oldu.'],
          ['hResult', 'WFS_SUCCESS ya da WFS_ERR_…; hata sınıfa özel kodlar da içerir.'],
          ['Sınıflar', 'IDC, PIN, CDM, CIM, PTR, IPM, SIU, TTU, VDM, CAM, ALM, CHK, DEP, BCR, CRD, CEU, BIO.'],
          ['Sürümler', '2.00 (1998) → 3.00 (2000) → 3.10 → 3.20 (2011) → 3.30 (2015) → 3.40 (2019/2020) → 3.50 (2022, doğrulayın); yıllar kaynaklara göre değişebilir.'],
          ['XFS4IoT', 'WebSocket + JSON, Windows’tan bağımsız yeni nesil (CWA 17852); XFS 3.x ile ikili uyumlu değil.'],
          ['Sürüm müzakeresi', 'WFSStartUp ve WFSOpen’da aralık verilir, ortak sürüm seçilir; yeteneği her zaman CAPABILITIES ile sorgulayın.'],
          ['Tuzaklar', 'İptal geri almaz, zaman aşımı başarısızlık demek değildir, kilidi bırakın, olay sırasına güvenmeyin.'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/suruculer">ATM cihaz sürücüleri: SP’nin altında neler var? →</a>
      </p>
    </>
  )
}
