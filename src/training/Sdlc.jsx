import { useState } from 'react'
import { Callout, Flow, Notes, PageHead, Sequence, Sim, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- etkileşimli: süreç modeli seçici
// Ağırlıklar öğretici bir sezgidir, ölçüm değildir: her özellik bir modeli öne ya da geriye iter.
const TRAITS = [
  ['fixed', 'Gereksinimler büyük ölçüde sabit ve dışarıdan dayatılıyor (şema/düzenleme metni)'],
  ['deadline', 'Sabit bir yürürlük tarihi var (genelge, düzenleme, şema sürümü)'],
  ['hardware', 'Donanım, cihaz sürücüsü veya sertifikasyon bağımlılığı var'],
  ['unclear', 'Ne istendiği belirsiz; kullanıcı geri bildirimiyle keşfedilecek'],
  ['frequent', 'Sık ve küçük sürümler isteniyor (haftalık / günlük)'],
  ['audit', 'Her değişiklik için denetim kanıtı gerekiyor'],
  ['small', 'Küçük, aynı yerde çalışan bir ekip'],
]
const MODELS = [
  { id: 'waterfall', name: 'Şelale', w: { fixed: 2, deadline: 1, hardware: 1, unclear: -2, frequent: -2, audit: 1, small: 0 }, note: 'Kapsam gerçekten sabitse ve geri dönüş pahalıysa işe yarar; belirsizlikte pahalıya patlar.' },
  { id: 'vmodel', name: 'V-model', w: { fixed: 3, deadline: 2, hardware: 3, unclear: -1, frequent: -1, audit: 2, small: 0 }, note: 'Her tasarım katmanının karşısında bir test seviyesi ister; sertifikasyonlu, donanımlı işlerde doğal uyum.' },
  { id: 'iter', name: 'Yinelemeli / artımlı', w: { fixed: 1, deadline: 1, hardware: 1, unclear: 2, frequent: 1, audit: 0, small: 1 }, note: 'Ürünü dilimler hâlinde büyütür; her dilimde bir miktar öğrenme ve yeniden planlama payı bırakır.' },
  { id: 'agile', name: 'Agile (Scrum / Kanban)', w: { fixed: 0, deadline: 0, hardware: 0, unclear: 3, frequent: 2, audit: 0, small: 2 }, note: 'Belirsizlik ve hızlı geri bildirim için en iyisi; denetim kanıtı ve harici tarihler için ek disiplin gerekir.' },
  { id: 'devops', name: 'DevOps / CI-CD', w: { fixed: 0, deadline: 0, hardware: -1, unclear: 1, frequent: 3, audit: 1, small: 2 }, note: 'Yayını sıradan ve otomatik kılar; kanıtı pipeline üretir. Cihaz filosu ve sertifikasyon bu hızı sınırlar.' },
]

function ModelLab() {
  const [on, setOn] = useState({})
  const picked = TRAITS.filter(([k]) => on[k])
  const ranked = MODELS.map((m) => ({ ...m, score: picked.reduce((s, [k]) => s + m.w[k], 0) })).sort((a, b) => b.score - a.score)
  const top = ranked.filter((m) => m.score === ranked[0].score)
  return (
    <div className="tr-lab">
      <fieldset className="tr-fieldset">
        <legend>Projenizin özellikleri</legend>
        {TRAITS.map(([k, text]) => (
          <label key={k} className="tr-check">
            <input type="checkbox" checked={!!on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
            {text}
          </label>
        ))}
      </fieldset>
      <div className={`tr-verdict ${picked.length ? 'ok' : ''}`} role="status">
        <span>Öne çıkan model</span>
        <b>{picked.length ? top.map((m) => m.name).join(' + ') : 'Önce özellik seçin'}</b>
      </div>
      {picked.length > 0 && (
        <ol className="tr-notes compact">
          {ranked.map((m) => (
            <li key={m.id}>
              <b>{m.name}</b> ({m.score > 0 ? '+' : ''}
              {m.score}): {m.note}
            </li>
          ))}
        </ol>
      )}
      <p className="tr-muted">
        Puanlar öğretici bir sezgidir. Gerçekte bu modeller tek başına seçilmez; bankalar çoğunlukla bunları karıştırır (aşağıdaki “wagile” notuna bakın).
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- V-model diyagramı
const VLEFT = [
  ['İş ve şema gereksinimleri', 'genelge, düzenleme, ürün'],
  ['Sistem gereksinimleri', 'mesaj şartnamesi, SLA'],
  ['Mimari ve arayüz tasarımı', 'ISO 8583, XFS, API sözleşmesi'],
  ['Modül tasarımı', 'durum makinesi, kurallar'],
]
const VRIGHT = [
  ['Kabul ve sertifikasyon', 'UAT, uçtan uca, ağ, EMV, PTS'],
  ['Sistem testi', 'HIL, regresyon, performans'],
  ['Entegrasyon testi', 'simülatör: switch, host, HSM'],
  ['Birim testi', 'kural ve hesap fonksiyonları'],
]
const VLINK = ['kabul kriterleri', 'sistem şartnamesi', 'arayüz sözleşmeleri', 'birim sözleşmeleri']

function VBox({ x, y, label, sub, soft }) {
  return (
    <g className="seq-actor">
      <rect x={x} y={y} width={214} height={46} rx="8" style={soft ? { fill: 'var(--panel)' } : undefined} />
      <text x={x + 107} y={y + 20} textAnchor="middle" className="a-label">
        {label}
      </text>
      <text x={x + 107} y={y + 36} textAnchor="middle" className="a-sub">
        {sub}
      </text>
    </g>
  )
}

function VModel() {
  const ys = [8, 66, 124, 182]
  return (
    <figure className="seq">
      <div className="seq-scroll">
        <svg viewBox="0 0 780 310" className="seq-svg" style={{ minWidth: 620 }} role="img" aria-label="V-model: soldaki her tasarım katmanı sağdaki bir test seviyesine karşılık gelir">
          {ys.map((y, i) => (
            <g key={y}>
              <line x1={10 + i * 30 + 214} x2={556 - i * 30} y1={y + 23} y2={y + 23} className="seq-life" />
              <text x={390} y={y + 17} textAnchor="middle" className="seq-sub">
                {VLINK[i]}
              </text>
              <VBox x={10 + i * 30} y={y} label={VLEFT[i][0]} sub={VLEFT[i][1]} />
              <VBox x={556 - i * 30} y={y} label={VRIGHT[i][0]} sub={VRIGHT[i][1]} soft />
            </g>
          ))}
          <VBox x={283} y={250} label="Kodlama" sub="kod incelemesi, SAST" />
          <path d="M207,228 L283,273" className="seq-msg" />
          <path d="M497,273 L573,228" className="seq-msg" />
        </svg>
      </div>
      <figcaption>Sol kol: ne istendiğini daha da somutlaştırır. Sağ kol: aynı seviyede doğrular. Kesikli çizgi: karşılıklı olarak hangi belgeye karşı sınandığı.</figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------- sahneler
const A = {
  uyum: { id: 'uyum', label: 'Ürün / Uyum', sub: 'iş sahibi' },
  dev: { id: 'dev', label: 'Geliştirme', sub: 'ekip' },
  qa: { id: 'qa', label: 'CI / Test', sub: 'pipeline + QA' },
  rel: { id: 'rel', label: 'Yayın / CAB', sub: 'değişiklik kurulu' },
  ops: { id: 'ops', label: 'İzleme / Ops', sub: 'operasyon, 7/24' },
}

export default function Sdlc() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Yazılım geliştirme yaşam döngüsü"
        title="SDLC"
        lead="Bir yazılım değişikliği isteğin gelmesinden üretimde sorunsuz çalışmasına kadar hangi yoldan geçer? Ödeme ve ATM yazılımında bu yol uzundur, çünkü hata yalnızca bir ekran bozmaz; birinin hesabına yanlış para yazabilir ya da bir ATM filosunu durdurabilir. Bu sayfa süreci, modelleri ve bu simülatörün kendi yaşam döngüsünü anlatır."
      />

      <h2 id="giris">SDLC nedir?</h2>
      <p>
        <b>SDLC</b> (Software Development Life Cycle), yazılımın fikirden emekliliğe kadar geçtiği aşamaların ortak adıdır: ne yapılacağı anlaşılır,
        tasarlanır, yazılır, sınanır, yayınlanır ve işletilir. Bir “süreç modeli” bu aşamaların <b>hangi sırayla, ne sıklıkla ve hangi onaylarla</b> yapılacağını
        söyler. Model bir kalıp değil, risk ile hız arasındaki dengenin yazılı hâlidir.
      </p>
      <p>
        Aşamaların kendisi neredeyse her yerde aynıdır. Farkı yaratan, her aşamada <b>ne kadar kanıt toplandığı</b> ve bir aşamadaki hatanın sonraki aşamada
        ne kadar pahalıya geldiğidir.
      </p>

      <h2 id="neden-farkli">Bankacılık, ödeme ve ATM yazılımı neden farklı?</h2>
      <Table
        head={['Özellik', 'Sıradan bir web uygulaması', 'Ödeme / ATM yazılımı']}
        rows={[
          [<b key="a">Hatanın bedeli</b>, 'Bozuk sayfa, geri alınabilir', 'Yanlış borçlandırma, çift işlem, kayıp banknot; düzeltmek iptal, mutabakat ve bazen müşteri ile uğraşmak demek'],
          [<b key="b">Düzenleme</b>, 'Genelde KVKK/GDPR gibi veri kuralları', 'Ek olarak merkez bankası/denetleyici kuralları, kart şeması kuralları, PCI standartları ve iç denetim'],
          [<b key="c">Kesintisiz çalışma</b>, 'Bakım penceresi bulunabilir', 'ATM ve switch 7/24 çalışır; “yarın yayınlarız” demek için bile bir pencere ve geri dönüş planı gerekir'],
          [<b key="d">Donanım ve saha</b>, 'Sunucu ve tarayıcı', 'Dağınık bir terminal filosu: farklı modeller, sürücüler, işletim sistemi sürümleri, kaset ve EPP; güncelleme sahaya fiziksel olarak da ulaşır'],
          [<b key="e">Sertifikasyon</b>, 'Yok ya da basit', 'Kart şeması, ulusal ağ, EMV ve cihaz güvenlik onayları yayın takvimini dışarıdan belirler'],
          [<b key="f">Çok taraflı zincir</b>, 'Kendi sistemin', 'ATM → switch → issuer; sizin hatanız başkasının defterinde görünür. Bu yüzden sözleşme (mesaj şartnamesi) ve mutabakat vazgeçilmezdir'],
          [<b key="g">Uzun ömür</b>, 'Sürüm hızlı eskir', 'Terminaller yıllarca sahada kalır; yeni host eski ATM sürümüyle de konuşabilmelidir'],
        ]}
      />
      <Callout title="Sonuç">
        Bu tablo “yavaş olun” demez; <b>“geri dönüşü ucuz olmayan yerde önceden kanıt toplayın”</b> der. İyi bir ödeme SDLC’si bunu otomasyonla hızlı, denetlenebilir hâle getirir.
      </Callout>

      <h2 id="fazlar">Aşamalar</h2>
      <p>Her aşama bir <b>çıktı</b> üretir ve sonraki aşama bunu girdi olarak kullanır. Aşağıdaki akış, ödeme yazılımına uyarlanmış hâliyle altı aşamayı gösterir. Gerçek hayatta bu bir kez değil, her değişiklik için döngü olarak yürür.</p>
      <Flow
        items={[
          { title: 'Gereksinim ve analiz', tag: 'çıktı: gereksinim listesi, kabul kriterleri', text: 'Ne gerekiyor ve neden? Kaynak bir müşteri isteği, bir şema genelgesi ya da düzenleme olabilir. Burada “kabul edilmiş” demek, sınanabilir bir kriterin yazılmış olmasıdır. Mesaj alanları, yanıt kodları ve limitler bu aşamada belirlenir.' },
          { title: 'Tasarım', tag: 'çıktı: mimari, arayüz sözleşmeleri, tehdit modeli, ADR', text: 'Bileşenler ve aralarındaki sözleşmeler (ISO 8583 alanları, XFS komutları, API’ler) çizilir. Hata durumları ve iptal/mutabakat yolu mutlu yolla birlikte tasarlanır.' },
          { title: 'Gerçekleme (kodlama)', tag: 'çıktı: kod, birim testleri, kod incelemesi', text: 'Kod yazılır, her değişiklik başka bir kişinin incelemesinden geçer. Gizli bilgiler koda girmez, PAN ve PIN günlüğe yazılmaz.' },
          { title: 'Test ve doğrulama', tag: 'çıktı: test raporu, kanıt paketi', text: 'Birimden uçtan uca seviyelere kadar ve gerektiğinde donanım ve sertifikasyon testleriyle doğrulanır. Başarısızlık senaryoları (zaman aşımı, para sıkışması) başarı senaryoları kadar önemlidir.' },
          { title: 'Dağıtım (yayın)', tag: 'çıktı: sürüm kaydı, onaylı değişiklik', text: 'Ortamlar boyunca ilerler, değişiklik kurulu onaylar, kademeli açılır ve geri alma planı hazır tutulur. ATM filosu için bu, aşamalı dalgalarla yazılım dağıtımıdır.' },
          { title: 'İşletme ve bakım', tag: 'çıktı: izleme, olay kayıtları, hotfix', text: 'Üretim izlenir, olaylar yönetilir, ders çıkarılır. Hata düzeltmeleri ve yeni gereksinimler yeniden ilk aşamaya döner: döngü kapanır.' },
        ]}
      />

      <h2 id="modeller">Süreç modelleri</h2>
      <Table
        head={['Model', 'Fikir', 'Güçlü yanı', 'Zayıf yanı', 'Ne zaman uyar?']}
        rows={[
          [<b key="1">Şelale</b>, 'Aşamalar sırayla, geri dönüş yok', 'Net belge, net sorumluluk, öngörülebilir', 'Geri bildirim sona kalır; geç keşfedilen hata pahalıdır', 'Kapsamı ve tarihi dışarıdan sabitlenmiş, küçük ve iyi anlaşılmış işler'],
          [<b key="2">V-model</b>, 'Her tasarım katmanının karşısında bir test seviyesi', 'Doğrulama planı baştan yapılır; izlenebilirlik doğal', 'Değişime ağır tepki verir', 'Donanım, sertifikasyon ve güvenlik kritik bileşenler (EPP, EMV kernel, ATM sürücü katmanı)'],
          [<b key="3">Yinelemeli / artımlı</b>, 'Ürünü dilimler hâlinde büyütür', 'Erken çalışan sürüm, öğrenme fırsatı', 'Mimariyi baştan düşünmezseniz dilimler birbirine uymaz', 'Büyük, kısmen belirsiz sistemler'],
          [<b key="4">Agile (Scrum, Kanban)</b>, 'Kısa döngüler, sürekli önceliklendirme', 'Hızlı geri bildirim, değişime uyum', 'Denetim kanıtı ve dış tarihler için ek disiplin ister', 'Müşteri yüzü uygulamalar, mobil bankacılık, keşif işleri'],
          [<b key="5">DevOps / CI-CD</b>, 'Entegrasyon, test ve dağıtımı otomatikleştirir', 'Yayın sıradanlaşır, kanıt otomatik üretilir', 'Cihaz filosu ve sertifikasyon hızı sınırlar; kültür ve altyapı yatırımı ister', 'Host/switch hizmetleri, API’ler, web ve mobil arka uç'],
        ]}
      />
      <h3>Bankalar gerçekte ne yapar? “Wagile”</h3>
      <p>
        Çoğu banka ve ödeme kuruluşu modelleri karıştırır. Çok görülen biçim: ekipler <b>Scrum</b> ile çalışır, ama yayın üç ayda bir bir <b>yayın treni</b> ile,
        değişiklik kurulu onayı ve ayrı bir test/sertifikasyon dönemiyle çıkar. Buna alaycı bir adla “wagile” (waterfall + agile) denir.
      </p>
      <Callout tone="warn" title="Dürüst değerlendirme">
        “Sprint’te bitti” ile “üretimde çalışıyor” aynı şey değildir. Wagile’ın bilinen tuzakları: sprint içinde mini şelale (analiz, kod, test sırayla), sprint sonrası “sertleştirme”
        dönemi, ayrı bir sertifikasyon birikimi ve iki ayrı backlog. Daha sağlıklı biçim: <b>kodlama ve doğrulamayı sürekli</b> yapmak, yayını
        <b> özellik bayraklarıyla</b> koddan ayırmak, onay ve kanıtı pipeline’a taşımak. Zorunlu şema tarihleri ve cihaz sertifikasyonu ise gerçek kısıtlardır, plana dürüstçe yazılmalıdır.
      </Callout>

      <h2 id="model-secici">Etkileşimli: hangi model uyar?</h2>
      <p>Projenizin özelliklerini işaretleyin; sayfa hangi modelin öne çıktığını ve nedenini gösterir.</p>
      <ModelLab />

      <h2 id="v-model">V-model ve ATM / ödeme test seviyeleri</h2>
      <p>
        V-model’in değeri, her test seviyesinin <b>hangi belgeye karşı</b> sınadığını netleştirmesidir. Ödeme yazılımında bu, kabaca aşağıdaki sıradır.
      </p>
      <VModel />
      <Table
        head={['Seviye', 'Ne sınanır?', 'Nasıl?', 'Bu projede']}
        rows={[
          [<b key="1">Birim</b>, 'Tek bir kuralın ya da hesabın doğruluğu: kaset planı, IBAN kontrolü, transfer yöntemi seçimi', 'Hızlı, bağımlılıksız testler', <><code key="a">test_iban_checksum</code>, <code key="b">test_dispense_needs_backtracking</code></>],
          [<b key="2">Entegrasyon (simülatörlerle)</b>, 'Bileşenlerin sözleşmeye uygun konuşması: ATM ↔ switch ↔ host ↔ HSM, bakiye, limit, rota', 'Host, HSM ve switch simülatörleri; gerçek ağ yok', 'Flask test istemcisiyle API uçları (36 testin çoğu); burada simülatörün kendisi host’u temsil eder'],
          [<b key="3">Sistem</b>, 'Tüm uygulamanın kabul kriterlerine uyması: tüm işlem türleri, hata yolları, mutabakat', 'Test ortamında gerçekçi veriyle', 'Otomatik sistem testi yok (aşağıdaki dürüst değerlendirmeye bakın)'],
          [<b key="4">Donanım-döngüde (HIL)</b>, 'ATM uygulamasının gerçek ya da emüle edilmiş cihazla (CDM, IDC, PIN pad) çalışması; XFS olay ve hata kodları', 'Laboratuvarda gerçek ATM ya da cihaz emülatörü; sıkışma, kağıt bitişi gibi arızalar zorlanır', 'Yok. Cihaz davranışı arayüzde simüle edilir (Arıza paneli)'],
          [<b key="5">Uçtan uca (host/switch ile)</b>, 'Gerçek switch ve issuer test ortamıyla tam akış, ISO 8583 mesajları, imzalar, anahtarlar', 'Karşı tarafın test ortamı; test kartlarıyla', 'Yok (gerçek bir karşı taraf yok)'],
          [<b key="6">Kullanıcı kabul (UAT)</b>, 'İş sahibinin “istediğim buydu” demesi', 'Kabul kriterlerine göre elle ve otomatik', 'Yok'],
          [<b key="7">Ağ ve cihaz sertifikasyonu</b>, 'Kart şeması / ulusal ağ (ör. Visa, Mastercard, BKM) için uçtan uca onay; EMV L2/L3; cihazlar için PCI PTS gibi onaylar', 'Karşı tarafın kendi test programı ve laboratuvarları', 'Yok. Kapsam ve prosedürü ilgili kurumdan doğrulayın'],
          [<b key="8">Regresyon</b>, 'Yeni değişikliğin eskisini bozmaması', 'Her değişiklikte otomatik koşan paket', 'CI’da her push ve PR’da pytest çalışır'],
        ]}
      />
      <Callout title="Sertifikasyonlar hakkında">
        EMV Level 1/2 (çip arayüzü ve kernel), Level 3 (terminal uygulaması + acquirer ağı), PCI PTS (PIN giriş cihazları) ve kart şeması/ulusal ağ onayları farklı kurumların, farklı kapsamlarda
        yaptığı doğrulamalardır. Bu sayfa yalnızca genel kavramı anlatır; güncel kapsam, sürüm ve prosedür için ilgili kurumun belgelerini <b>doğrulayın</b>. EMV ayrıntısı için EMV sayfasına bakın.
      </Callout>

      <h2 id="gereksinim">Gereksinimler ve izlenebilirlik</h2>
      <p>Ödeme yazılımında gereksinimler çoğunlukla bir müşteri toplantısından değil, <b>dışarıdan</b> gelir:</p>
      <Table
        head={['Kaynak', 'Örnek', 'Özellik']}
        rows={[
          [<b key="1">Kart şeması / ulusal ağ</b>, 'Mesaj alanı değişikliği, yeni yanıt kodu, ücret kuralı, zorunlu sürüm', 'Yürürlük tarihi sabittir; genelde belirli sürüm dönemleri vardır (güncel takvimi ilgili şemadan doğrulayın). Kaçırılırsa ceza ya da bağlantı riski'],
          [<b key="2">Düzenleyici</b>, 'Merkez bankası ve denetleyici kuralları, ödeme sistemleri mevzuatı, veri koruma', 'Gereksinim metni hukuki dildedir; çevirisi için uyum birimi gerekir'],
          [<b key="3">Güvenlik standartları</b>, 'PCI DSS, PCI PTS', 'Denetimle doğrulanır; kanıt gerekir'],
          [<b key="4">İç ürün istekleri</b>, 'Yeni işlem türü, yeni kanal', 'Esnektir, ama diğerleriyle yarışır'],
        ]}
      />
      <h3>İzlenebilirlik matrisi</h3>
      <p>
        İzlenebilirlik, her gereksinimden <b>tasarıma, koda, teste ve yayına</b> bir çizgi çekebilmektir. Denetçi “bu kural nerede, nasıl sınandı?” diye sorduğunda cevap bir satırdır.
        Aşağıdaki kimlikler örnektir; satır içeriği bu projeden gerçek bir kuraldır.
      </p>
      <Table
        head={['Gereksinim (örnek kimlik)', 'Tasarım', 'Test', 'Yayın kanıtı']}
        rows={[
          ['REQ-FEE-01: kartı başka bankaya ait olan müşteriden çekimde ücret alınır, ücret alan 28’de gider', 'BKM rotası, alan 28 biçimi (D + kuruş)', <code key="a">test_off_us_withdraw_routes_via_bkm_and_charges_fee</code>, 'PR, CI sonucu, sürüm notu'],
          ['REQ-REV-02: iptal hesap, ücret ve günlük limiti geri yazar', 'Alan 90 ile orijinal işlemi eşleme', <code key="b">test_reversal_restores_balance_fee_and_daily_limit</code>, 'PR, CI sonucu'],
          ['REQ-SEC-03: oturum belirteci kurcalanamaz', 'HMAC imzalı belirteç', <code key="c">test_tampered_token_rejected</code>, 'PR, CI sonucu'],
        ]}
      />
      <Callout title="Yayın takvimine dikkat">
        Zorunlu şema/ağ değişikliklerinde “tarihten geriye doğru planlama” yapılır: yürürlük tarihi − yayın penceresi − sertifikasyon süresi − test süresi − geliştirme = <b>en geç başlama tarihi</b>.
        Bu tarihi kaçıran bir iş, kapsam kısılarak (zorunlu çekirdek önce) ya da bayrakla yayınlanarak kurtarılır.
      </Callout>

      <h2 id="tasarim">Tasarım</h2>
      <h3>Tehdit modelleme</h3>
      <p>
        Kodlamadan önce “bu sistemi kim, nasıl bozar?” diye sorulur. Yaygın bir yöntem veri akış diyagramı üzerinde <b>STRIDE</b> kategorilerini (kimlik sahteciliği, kurcalama, inkâr, bilgi sızması,
        hizmet reddi, yetki yükseltme) gezmektir. ATM/ödeme için tipik sorular: PIN ağda hangi anahtarla korunuyor? Aynı istek tekrar oynatılırsa ne olur? İptal mesajını başkası taklit edebilir mi?
      </p>
      <h3>Mimari karar kaydı (ADR)</h3>
      <p>Önemli kararlar bağlam, seçenekler ve sonuçlarıyla kısa bir metne yazılır. Bu proje için gerçek bir örnek:</p>
      <Callout title="ADR örneği · host durumsuz, bakiye istemcide">
        <b>Bağlam:</b> Vercel fonksiyonları durumsuzdur. <b>Karar:</b> bakiyeler ve kasetler tarayıcıda tutulur, her istekle hosta gönderilir; kayıtlar imzalıdır.
        <b> Sonuç:</b> demo için yeterli. README’nin de belirttiği gibi kartsız onayın tek kullanımlık olması host tarafından garanti edilmez; gerçek bir sistemde defter bir veritabanında olmalıdır.
        İyi bir ADR, kabul edilen ödünü açıkça yazar.
      </Callout>
      <h3>Arayüz sözleşmeleri</h3>
      <Table
        head={['Sözleşme', 'Neyi belirler?', 'Dikkat']}
        rows={[
          [<b key="1">ISO 8583 şartnamesi</b>, 'Hangi mesaj türü, hangi alanlar zorunlu, hangi yanıt kodları; çoğu zaman kurumun kendi “lehçesi”', 'Şartname sürümlenir; alan ekleme geriye uyumlu olmalıdır'],
          [<b key="2">XFS</b>, 'ATM uygulaması ile cihaz sürücüsü arasındaki komut, olay ve hata kodları', 'Sürücü sürümü, cihaz modeli ve XFS sürümü birlikte sınanır'],
          [<b key="3">API / OpenAPI</b>, 'Mobil, web ve iç servis uçları', 'Sözleşme testi ile tüketici/üretici ayrışmaz'],
        ]}
      />
      <h3>İdempotans ve iptal tasarımı</h3>
      <p>Para taşıyan her çağrının <b>güvenle tekrar edilebilir</b> olması tasarım ilkesidir. Ağ yanıtı kaybolabilir; istemci tekrar gönderir; sonuç çift işlem olmamalıdır.</p>
      <Table
        head={['İlke', 'Nasıl']}
        rows={[
          ['İşlemi tanımlayan benzersiz anahtar', 'STAN, RRN ve terminal kimliği; tekrar edilen istek yeni bir işlem olarak değil, aynı işlem olarak tanınır'],
          ['Yanıt kaybına karşı iptal', 'Host onay verdi ama ATM yanıtı alamadıysa ATM iptal (0400) gönderir; alan 90 asıl işlemi gösterir'],
          ['İptalin de kaybolabilmesi', 'Yanıtsız iptal kuyruğa (SAF) yazılır ve 0420 ile tekrarlanır; bu tekrar da güvenle tekrar edilebilir olmalıdır'],
          ['Son söz mutabakatta', 'Gün sonunda ATM ve host sayaçları karşılaştırılır; fark insan incelemesine düşer'],
        ]}
      />
      <TryInSim>
        Servis → Arıza sekmesinden “Host yanıtı kaybolur” seçin, bir çekim yapın; bu tasarım ilkelerinin çalıştığını (ya da kuyrukta beklediğini) olay günlüğünden izleyin.
      </TryInSim>

      <h2 id="guvenli">Güvenli SDLC</h2>
      <p>
        Güvenlik son aşamada eklenen bir kutu değil, her aşamanın içindeki bir faaliyettir. Ödeme dünyasında çerçeve genelde şu kavramlardan oluşur (güncel sürüm ve gereksinimleri resmî belgelerinden <b>doğrulayın</b>):
      </p>
      <ul>
        <li>
          <b>PCI DSS:</b> kart verisi saklayan, işleyen ya da ileten kuruluşlar için güvenlik gereksinimleri; güvenli geliştirme ve değişiklik yönetimi gereksinimleri de içerir. Kimlik doğrulama verisinin
          (PIN, tam iz verisi, CVV) yetkilendirmeden sonra saklanmaması temel ilkedir.
        </li>
        <li>
          <b>PCI Secure Software standartları:</b> ödeme yazılımının kendisinin güvenli yaşam döngüsüyle geliştirildiğini ve güvenlik özelliklerini taşıdığını değerlendiren programlar (eski PA-DSS’nin yerini aldığı bilinir; kapsamı doğrulayın).
        </li>
        <li>
          <b>OWASP ASVS:</b> uygulamanın hangi güvenlik kontrollerini sağlaması gerektiğini seviyelerle sıralayan doğrulama standardı. <b>OWASP SAMM:</b> bir kuruluşun yazılım güvenliği olgunluğunu (yönetişim, tasarım, gerçekleme,
          doğrulama, operasyon) ölçmek için kullanılan model.
        </li>
      </ul>
      <Table
        head={['Kontrol', 'Neden?', 'Nasıl kanıtlanır?']}
        rows={[
          [<b key="1">Gizli bilgi yönetimi</b>, 'Anahtar ve parola kodda ya da depoda olursa herkese açılmış demektir', 'Ortam değişkeni veya kasa; depoda tarama; döndürme prosedürü'],
          [<b key="2">PAN ve PIN günlükte yok</b>, 'Günlükler çok kişiye açık; kart verisini kapsama alanı genişletir', 'Maskeleme testleri, günlük taraması; gösterimde maskeli kart (ilk/son haneler kuralı için standardı doğrulayın)'],
          [<b key="3">SAST</b>, 'Kod yazılırken zafiyeti statik analizle yakalar', 'Pipeline çıktısı, bulguların kapatılması'],
          [<b key="4">DAST</b>, 'Çalışan uygulamayı dışarıdan sınar', 'Test ortamında tarama raporu'],
          [<b key="5">SCA / bağımlılık taraması</b>, 'Üçüncü taraf kütüphanedeki bilinen açıklar', 'Bağımlılık raporu, sürüm sabitleme, yama süresi'],
          [<b key="6">Kod incelemesi</b>, 'İkinci göz hata ve kötü niyeti yakalar', 'PR onayı; yazanın kendi PR’ını onaylayamaması'],
          [<b key="7">Görev ayrılığı</b>, 'Tek kişi hem değişikliği yazıp hem üretime alamamalı', 'Rol tanımları, yayın izinlerinin ayrılması'],
          [<b key="8">Değişiklik yönetimi (CAB)</b>, 'Etki ve geri alma planı bilinmeden üretime dokunulmaz', 'Değişiklik kaydı, onay, yayın penceresi'],
          [<b key="9">Maker-checker</b>, 'Kritik her işlemde biri yapar, başkası onaylar (kod, yapılandırma, anahtar yükleme)', 'Çift onay kaydı'],
        ]}
      />
      <Callout tone="warn" title="Simülatörde bir uyarı">
        Host kodunda oturum imzası için ortam değişkeni <code>SESSION_SECRET</code> okunur; tanımlı değilse koda yazılı bir <b>geliştirme varsayılanı</b> kullanılır. Eğitim projesi için makuldür, ama gerçek bir sistemde “değişken yoksa varsayılan” davranışı
        <b> açılışta hata verecek</b> şekilde değiştirilirdi. Vercel’de değişkenin tanımlanması README’de ayrı bir adım olarak yer alır.
      </Callout>

      <h2 id="test">Test stratejisi</h2>
      <h3>Test piramidi</h3>
      <p>Alt katmanlarda çok sayıda hızlı ve ucuz test, üst katmanlarda az sayıda yavaş ve pahalı test. Ödemede piramidin tepesi (sertifikasyon, uçtan uca) başkalarının takvimine bağlıdır; bu yüzden alt katmanlar ne kadar güçlüyse, tepeye giden hata o kadar azalır.</p>
      <Table
        head={['Katman', 'Hız / maliyet', 'Ne yakalar?']}
        rows={[
          [<b key="1">Birim</b>, 'Saniyeler, ucuz', 'Kural ve hesap hataları'],
          [<b key="2">Sözleşme / entegrasyon</b>, 'Dakikalar', 'Alan biçimi, yanıt kodu, zorunlu alan uyumsuzluğu'],
          [<b key="3">Sistem ve uçtan uca</b>, 'Saatler, pahalı', 'Bileşenler arası gerçek akış; zamanlama sorunları'],
          [<b key="4">Sertifikasyon ve saha pilotu</b>, 'Günler/haftalar, çok pahalı', 'Karşı tarafın beklentisi, gerçek cihaz davranışı'],
        ]}
      />
      <h3>Test verisi ve test kartları</h3>
      <p>
        Gerçek PAN ile test yapılmaz. Kart şemaları ve ağlar test BIN’leri ve test kartları sağlar; bunlar test ortamında bilinen sonuçlar üretir. Test verisi sentetik ya da maskelenmiş olmalı, üretimden veri kopyalanacaksa anonimleştirilmelidir.
        Bu simülatördeki kartlar (VISA 4543…0001 gibi) <b>uydurmadır</b>, hiçbir gerçek hesapla ilgisi yoktur.
      </p>
      <h3>Simülatör ve sözleşme testleri</h3>
      <p>
        Karşı taraf (host, HSM, switch) her zaman testte hazır değildir. Bu yüzden yazılımın bu taraflarla konuştuğu mesajlar bir <b>simülatöre</b> karşı sınanır ve simülatörün sözleşmeye uygunluğu ayrıca doğrulanır.
        Bu proje de tam olarak bunu yapar: ATM arayüzü ile Python host simülatörü arasındaki API testlerle sabitlenmiştir.
      </p>
      <h3>Arıza enjeksiyonu</h3>
      <p>Başarılı yol çalışıyor diye ürün güvenli değildir. Simülatörün Servis → <b>Arıza</b> paneli bu yaklaşımın küçük bir örneğidir: arıza bir sonraki işlemde bir kez tetiklenir ve sistemin tepkisi izlenir.</p>
      <Table
        head={['Arıza', 'Beklenen davranış', 'Hangi katmanda sınanır?']}
        rows={[
          [<b key="1">Para sıkışması</b>, 'Host onayı sonrası CDM hatası; banknot red kutusuna; 0400 iptal, 39=22', 'HIL (gerçek hata kodu), entegrasyon (iptal mantığı)'],
          [<b key="2">Para alınmaz</b>, 'Süre dolunca geri çekme; 0400 iptal, 39=17', 'HIL, sistem'],
          [<b key="3">Host yanıtı kaybolur</b>, 'ATM para vermez; iptal SAF’ta bekler; 0420 ile tekrar; 39=68', 'Entegrasyon, uçtan uca, mutabakat'],
          [<b key="4">Kart sıkışması</b>, 'Kart alıkonur', 'HIL'],
          [<b key="5">Fiş kağıdı bitti</b>, 'İşlem sürer, fiş basılmaz', 'HIL'],
        ]}
      />
      <p>
        Gerçek projelerde aynı fikir <b>kaos/hata enjeksiyonu</b> olarak yaygınlaşır: ağ gecikmesi, paket kaybı, çökmüş bağımlılık, bozuk mesaj. Önemli olan, bunların önce test ortamında, kontrollü olarak denenmesidir.
      </p>
      <h3>Mutabakat, performans, negatif testler</h3>
      <ul>
        <li>
          <b>Mutabakat testleri:</b> işlem akışı biter ama doğruluk sorusu bitmez. ATM sayaçları ile host defteri aynı kalıyor mu? Simülatörde <code>test_settlement_mismatch_until_reversal_arrives</code> bu çizgidedir.
        </li>
        <li>
          <b>Performans ve dayanıklılık (soak):</b> beklenen işlem yoğunluğu (ör. maaş günü, ay sonu) ve uzun süreli çalışmada bellek/bağlantı sızıntısı. Bu projede performans testi yoktur.
        </li>
        <li>
          <b>Negatif testler:</b> yanlış PIN, süresi dolmuş QR (<code>test_qr_expired</code>), imzası bozuk belirteç, sahte kayıt (<code>test_settlement_ignores_forged_records</code>), başka banka ATM’sinde izin verilmeyen işlem türü (58 ile reddedilir).
        </li>
      </ul>

      <h2 id="yayin">Yayın ve dağıtım</h2>
      <h3>Ortamlar ve CI/CD hattı</h3>
      <Table
        head={['Ortam', 'Amaç']}
        rows={[
          [<b key="1">Geliştirme</b>, 'Geliştiricinin yerel/paylaşımlı denemesi'],
          [<b key="2">Test / SIT</b>, 'Entegrasyon ve sistem testi, simülatörlere bağlı'],
          [<b key="3">UAT / sertifikasyon</b>, 'İş kabulü ve karşı tarafla uçtan uca testler, test kartlarıyla'],
          [<b key="4">Üretim öncesi</b>, 'Üretimle aynı yapılandırma, son prova'],
          [<b key="5">Üretim</b>, 'Gerçek müşteri ve para'],
        ]}
      />
      <Table
        head={['Hat adımı', 'Ne yapar?', 'Başarısızsa']}
        rows={[
          ['Derleme', 'Bağımlılıkları kurar, paketi üretir (örnek: npm ci, npm run build)', 'Birleştirme engellenir'],
          ['Birim ve entegrasyon testleri', 'Otomatik regresyon (örnek: pytest)', 'Birleştirme engellenir'],
          ['Statik analiz ve bağımlılık taraması', 'SAST, SCA, gizli bilgi taraması', 'Bulgu kapatılır ya da gerekçeli istisna'],
          ['Test ortamına dağıtım ve sistem testleri', 'Otomatik dağıtım, duman testi', 'Sürüm adayı oluşmaz'],
          ['Kanıt paketi ve onay', 'Test sonucu, inceleme, değişiklik kaydı', 'CAB geri çevirir'],
          ['Kademeli üretim yayını', 'Canary, mavi-yeşil ya da dalgalar', 'Otomatik ya da elle geri alma'],
        ]}
      />
      <h3>Mavi-yeşil, canary ve özellik bayrakları</h3>
      <ul>
        <li>
          <b>Mavi-yeşil:</b> iki özdeş ortam; trafik yeni sürüme geçirilir, sorun olursa tek hamlede eskisine dönülür. Host hizmetleri için uygundur, veritabanı şeması ayrıca yönetilmelidir.
        </li>
        <li>
          <b>Canary:</b> yeni sürüm önce küçük bir trafik payına açılır; hata ve onay oranları izlenir, sonra genişletilir.
        </li>
        <li>
          <b>Özellik bayrağı:</b> kod üretimde ama kapalıdır; açma kararı yayından ayrılır. Şema yürürlük tarihine uyan değişiklikler için çok kullanışlıdır.
        </li>
      </ul>
      <h3>ATM yazılımı dağıtımı</h3>
      <p>
        ATM’lerde sunucudaki gibi “tek hamlede yayınla” yoktur. Yazılım dağıtım araçlarıyla <b>imzalı paketler</b> terminallere dalga dalga gönderilir; her terminal kendi bakım penceresinde güncellenir.
        Çevrimdışı ya da hatalı terminaller sonradan yakalanır, bu yüzden filoda bir süre <b>birden çok sürüm</b> yan yana çalışır. Host bu karışıklığı kaldırabilmelidir (geriye uyumluluk).
      </p>
      <Table
        head={['Konu', 'Ne olur?']}
        rows={[
          ['Dalga planı', 'Önce laboratuvar, sonra az sayıda pilot terminal, sonra model/şube/bölge bazlı dalgalar'],
          ['Sağlık göstergesi', 'İşlem başarı oranı, cihaz hata oranı, mutabakat farkı; eşik aşılırsa dalga durur'],
          ['Geri alma', 'Önceki paket hazır tutulur; ancak geri alma da bir dağıtımdır ve zaman alır. Bu yüzden önce pilot'],
          ['Yayın dondurma', 'Bayram, ay sonu, maaş günleri gibi yüksek yoğunluklu dönemlerde değişiklik durdurulur (kurum kuralı olarak)'],
        ]}
      />

      <h2 id="isletme">İşletme ve bakım</h2>
      <ul>
        <li>
          <b>İzleme:</b> sunucu sağlığı kadar <b>iş göstergeleri</b>: onay oranı, yanıt kodu dağılımı (özellikle 91/68 gibi zaman aşımı kodlarında artış), SAF kuyruk derinliği, mutabakat farkı, kasette kalan nakit, hizmet dışı ATM sayısı.
        </li>
        <li>
          <b>Olay yönetimi:</b> önem derecesi, sorumlu, iletişim kanalı ve çalışma kitabı (runbook). Amaç önce hizmeti geri getirmek, sonra nedeni bulmaktır.
        </li>
        <li>
          <b>Olay sonrası inceleme (post-mortem):</b> suçlayıcı olmayan, “sistem neden buna izin verdi?” diye soran bir metin; eylem maddeleri sahip ve tarihle takip edilir.
        </li>
        <li>
          <b>Hotfix süreci:</b> en kısa yol ama aynı kontroller: önce hatayı yeniden üreten test, düzeltme, hızlandırılmış inceleme, acil değişiklik onayı, kademeli yayın. “Acil” denerek atlanan kontrol, bir sonraki olayın nedeni olur.
        </li>
        <li>
          <b>Bakım:</b> bağımlılık yamaları, sertifika/anahtar yenilemeleri, uç-yaşam (end-of-life) işletim sistemi ve sürücü güncellemeleri planlı işlerdir, acil durum değildir.
        </li>
      </ul>

      <h2 id="belge">Belgeleme ve denetim kanıtı</h2>
      <p>
        Denetçi sizi dinlemez, <b>kanıtınıza</b> bakar. İyi sistem, kanıtı iş yaparken kendiliğinden üretir; denetim öncesi toplanan kanıt zayıftır.
      </p>
      <Table
        head={['Soru', 'Kanıt']}
        rows={[
          ['Bu gereksinim nereden geldi?', 'Genelge/talep kaydı, gereksinim kimliği'],
          ['Kim yazdı, kim inceledi?', 'PR geçmişi, inceleme onayı'],
          ['Nasıl sınandı?', 'Test sonuçları, kapsam, sertifikasyon raporu'],
          ['Kim onayladı ve ne zaman yayınlandı?', 'Değişiklik kaydı, CAB tutanağı, sürüm kaydı'],
          ['Geri almak mümkün müydü?', 'Geri alma planı ve denemesi'],
          ['Sorun çıktı mı, ne öğrenildi?', 'Olay kaydı, post-mortem'],
        ]}
      />
      <Callout title="Mimari belgeler">
        Yaşayan belge kısa olandır: bağlam diyagramı, ADR’ler, mesaj şartnamesi sürümleri, çalışma kitapları ve yayın notları. Kimsenin okumadığı 200 sayfalık belge denetime yardım etmez.
      </Callout>

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>Aşağıdaki senaryolar <b>varsayımsaldır</b>; amaç sürecin nasıl akacağını göstermektir. Ayrıntılar kuruma göre değişir.</p>
      <Tabs
        label="SDLC senaryoları"
        tabs={[
          {
            label: '1 · Şema genelgesi: yeni ücret kuralı',
            content: (
              <>
                <Sequence
                  label="Bir şema genelgesinden gelen ücret kuralı değişikliğinin yayına çıkışı"
                  actors={[A.uyum, A.dev, A.qa, A.rel]}
                  steps={[
                    { sep: 'Analiz' },
                    { from: 'uyum', to: 'dev', label: 'Genelge: yeni ücret kuralı', sub: 'yürürlük tarihi: T', tone: 'warn' },
                    { from: 'dev', to: 'uyum', label: 'Etki analizi + soru listesi', res: true },
                    { sep: 'Gerçekleme' },
                    { from: 'dev', to: 'dev', label: 'Kural tablosu\nbayrağın arkasında' },
                    { from: 'dev', to: 'qa', label: 'PR: birim + sözleşme testi' },
                    { from: 'qa', to: 'dev', label: 'Yeşil · kapsam raporu', res: true, tone: 'ok' },
                    { sep: 'Doğrulama' },
                    { from: 'uyum', to: 'qa', label: 'UAT: test kartları', sub: 'alan 28 değerleri' },
                    { note: 'Gerekirse şema/ağ test programında uçtan uca doğrulama', at: 'qa' },
                    { sep: 'Yayın' },
                    { from: 'qa', to: 'rel', label: 'Sürüm adayı + kanıt paketi' },
                    { from: 'rel', to: 'dev', label: 'Onay · yayın penceresi', res: true, tone: 'ok' },
                    { note: 'Kod T’den önce üretimde, bayrak T gününde açılır', span: ['dev', 'rel'], tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    'Gereksinim dışarıdan gelir; ilk iş, geriye doğru plan yapıp en geç başlama tarihini hesaplamaktır.',
                    'Kural, veri tablosunda ve bayrağın arkasındadır: yayın ile yürürlük birbirinden ayrılır.',
                    'Test, tutar ve ücret alanının (alan 28) beklenen değerlerini ve not-on-us yolunu kapsar. Simülatördeki karşılığı BKM rotasındaki ücret testidir.',
                    'Yürürlük gününde bayrağı açmak küçük, geri alınabilir bir işlemdir; yayının kendisi çok daha önce ve sakin biçimde yapılmıştır.',
                  ]}
                />
              </>
            ),
          },
          {
            label: '2 · Üretimde hata: zaman aşımı + iptal',
            content: (
              <>
                <Sequence
                  label="Varsayımsal olay: iptal tekrarı bazı durumlarda kuyruğa yazılmıyor; hotfix yolu"
                  actors={[A.ops, A.dev, A.qa, A.rel]}
                  steps={[
                    { sep: 'Tespit' },
                    { from: 'ops', to: 'dev', label: 'P1 olayı: mutabakat farkı', sub: 'SAF kuyruğu beklenenden boş', tone: 'bad' },
                    { from: 'dev', to: 'dev', label: 'Kök neden: 0420 tekrarı\nyalnızca belli yolda yazılıyor' },
                    { sep: 'Düzeltme' },
                    { from: 'dev', to: 'qa', label: 'Önce hatayı üreten test' },
                    { from: 'qa', to: 'dev', label: 'Kırmızı (beklenen)', res: true, tone: 'bad' },
                    { from: 'dev', to: 'qa', label: 'Düzeltme + regresyon paketi' },
                    { from: 'qa', to: 'dev', label: 'Yeşil · kanıt', res: true, tone: 'ok' },
                    { sep: 'Acil yayın' },
                    { from: 'dev', to: 'rel', label: 'Acil değişiklik talebi', sub: 'etki + geri alma planı' },
                    { note: 'Maker-checker: ikinci kişi hem kodu hem talebi onaylar', at: 'rel' },
                    { from: 'rel', to: 'ops', label: 'Canary → kademeli yayın', tone: 'ok' },
                    { from: 'ops', to: 'dev', label: 'Fark kapanıyor', res: true, tone: 'ok' },
                    { note: 'Sonra: etkilenen işlemler elle mutabakatla düzeltilir, post-mortem yazılır', span: ['ops', 'rel'], tone: 'warn' },
                  ]}
                />
                <Notes
                  items={[
                    'Hatayı gün sonu mutabakatındaki fark yakalar: bu yüzden mutabakat bir test değil, bir izleme aracıdır.',
                    'Düzeltmeden önce hatayı gösteren test yazılır; aynı hata geri gelmez.',
                    'Acil olması, kontrolleri atlamak anlamına gelmez; yalnızca daha hızlı yapılır.',
                    'Kod düzeltmesi geçmiş işlemleri düzeltmez. Etkilenen işlemler ayrı bir veri işi olarak ele alınır.',
                  ]}
                />
                <TryInSim>
                  “Host yanıtı kaybolur” arızasıyla bir çekim yapın, bakım modunda <Sim>Gün sonu</Sim> çalıştırın (fark çıkar), sonra <Sim>SAF kuyruğunu gönder</Sim> ile iptali ulaştırıp tekrar deneyin.
                </TryInSim>
              </>
            ),
          },
          {
            label: '3 · ATM filosuna yeni sürüm',
            content: (
              <>
                <Flow
                  items={[
                    { title: 'Paketleme ve imza', tag: 'sürüm adayı', text: 'ATM uygulaması ve sürücü bağımlılıkları sürümlenir, imzalanır. Paketin içeriği ve sağlama toplamı sürüm kaydına yazılır.' },
                    { title: 'Laboratuvar doğrulaması', tag: 'HIL', text: 'Filodaki her ATM modeli ve XFS sürücü sürümü için laboratuvar cihazında tam işlem paketi çalışır; sıkışma ve kağıt bitişi gibi hatalar zorlanır.' },
                    { title: 'Pilot dalga', tag: 'az sayıda terminal', text: 'Düşük yoğunluklu, iyi izlenen birkaç terminal. ATM bakım moduna alınır, güncellenir, hizmete döner.' },
                    { decision: true, title: 'Sağlık göstergeleri eşikte mi?', branches: [{ label: 'Evet', text: 'Sonraki dalgaya geç', tone: 'ok' }, { label: 'Hayır', text: 'Dağıtımı durdur, önceki pakete dön, incele', tone: 'bad' }] },
                    { title: 'Genişleyen dalgalar', tag: 'model · şube · bölge', text: 'Her dalgadan önce göstergeler yeniden bakılır. Yoğun saatler ve dondurma dönemleri dışında çalışılır.' },
                    { title: 'Filo sağlık raporu', tag: 'EJ · hata oranı · mutabakat', text: 'Çevrimdışı kalan terminaller takip edilir. Bir süre iki sürüm yan yana çalışır; host buna hazır olmalıdır.' },
                  ]}
                />
                <Notes
                  items={[
                    'ATM’ye “anında geri al” yoktur; her geri alma da dalgalı bir dağıtımdır. Bu yüzden pilot dalga gerçekten küçük tutulur.',
                    'Karar verisi iş göstergeleridir (başarı oranı, mutabakat farkı), yalnızca “güncelleme tamamlandı” değildir.',
                    'Simülatördeki bakım modu, ATM’nin güncelleme için hizmet dışına alınmasının küçük bir benzeridir; gerçek bir dağıtım aracı bu projede yoktur.',
                  ]}
                />
              </>
            ),
          },
          {
            label: '4 · Yeni işlem türü: QR ile kartsız çekim',
            content: (
              <>
                <p>
                  Bu simülatörde <b>kartsız (QR) para çekme</b> sonradan eklenmiş bir işlem türüdür. Aynı işi bir SDLC olarak izlersek:
                </p>
                <Flow
                  items={[
                    { title: 'Gereksinim', tag: 'analiz', text: 'Müşteri telefonda onaylar, ATM para verir; tutar ATM’den değil mobil onaydan alınır. Yalnızca Demo Bank müşterileri kullanabilir. QR oturumu 120 saniyede geçersiz olur.' },
                    { title: 'Tasarım', tag: 'tasarım', text: 'İmzalı QR oturumu, mobil onay → InterAPI → fraud/core, ATM onayı sorgular. 0200/0210 alan 48’de “Kartsız işlem · QR”. Kart olmadığı için kart iadesi yoktur. Tehdit modeli: oturumun yeniden oynatılması, başka işlem türü için kullanılması, süresi dolmuş QR.' },
                    { title: 'Gerçekleme', tag: 'kodlama', text: 'Host’ta QR oturum, onay ve çekim uçları; imza ve süre denetimi; ATM tarafında kart olmayan akış.' },
                    { title: 'Test', tag: 'test', text: 'Birim ve API testleri: tutarın mobil onaydan okunması, bakiye ön kontrolü, başka banka müşterisinin reddi, onayın işlem türüne bağlılığı, süresi dolan QR ve QR belirtecinin oturum sayılmaması.' },
                    { decision: true, title: 'Güvenlik ve tasarım açığı var mı?', branches: [{ label: 'Evet', text: 'Tasarım notuna yaz, kabul et ya da çöz', tone: 'warn' }, { label: 'Hayır', text: 'Yayına devam', tone: 'ok' }] },
                    { title: 'Yayın', tag: 'dağıtım', text: 'Vercel’de PR için ayrı bir önizleme ortamı, birleştirmeden sonra üretim. CI testleri ve derleme birleştirmeden önce koşar.' },
                    { title: 'Bakım', tag: 'işletme', text: 'Kullanım ve hata izleme, QR süresi gibi parametrelerin ayarı. Yeni arıza türleri (ör. mobil onay gecikmesi) yeni senaryo olarak geri döner.' },
                  ]}
                />
                <Callout tone="warn" title="Bilinen sınır">
                  README, kartsız onayın tek kullanımlık olmasının host tarafından garanti edilmediğini söyler (durumsuz host, onay istemcide taşınan imzalı belirteçtir). Gerçek bir sistemde bu, tasarım aşamasında bir
                  <b> “kabul edilen risk”</b> değil, kapatılması gereken bir gereksinim olurdu: onay sunucuda saklanır ve tüketildiğinde işaretlenir.
                </Callout>
              </>
            ),
          },
          {
            label: '5 · Düzenleme değişikliği ve son tarih',
            content: (
              <>
                <Flow
                  items={[
                    { title: 'Bildirim ve kapsam', tag: 'uyum birimi', text: 'Düzenleme metni hukuki dilden gereksinime çevrilir: hangi ürün, hangi kanal, hangi tarih.' },
                    { title: 'Geriye doğru plan', tag: 'yürürlük − sertifikasyon − yayın − test − kodlama', text: 'En geç başlama tarihi hesaplanır. Dış bağımlılıklar (sertifikasyon, karşı taraf testi) en uzun, en az kontrol edilebilir kalemlerdir; onlar önce planlanır.' },
                    { decision: true, title: 'Kapsam tarihe sığıyor mu?', branches: [{ label: 'Evet', text: 'Normal akış, bayrakla yürürlük', tone: 'ok' }, { label: 'Hayır', text: 'Zorunlu çekirdeği önce çıkar, kalanı ikinci dilimde; uyum birimi yazılı onaylar', tone: 'warn' }] },
                    { title: 'Geliştirme ve test', tag: 'bayrak · test', text: 'Değişiklik özellik bayrağının arkasında; yeni kural için hem yeni test hem eski davranışın regresyonu.' },
                    { title: 'Yayın ve yürürlük', tag: 'CAB · dondurma takvimi', text: 'Yayın, yürürlük gününden önce ve dondurma dönemlerine denk gelmeyecek şekilde. Yürürlükte bayrak açılır.' },
                    { title: 'Uyum kanıtı', tag: 'denetim paketi', text: 'Gereksinim → test → yayın zinciri, bayrağın açıldığı kayıt ve ilk günlerin izleme çıktıları denetime hazır tutulur.' },
                  ]}
                />
                <Notes
                  items={[
                    'Tarih sabitse, değişken olan kapsamdır: “zorunlu çekirdek önce” bu yüzden temel bir araçtır.',
                    'Sertifikasyon ve dış testler gecikmeye en açık adımlardır; bunları erken başlatmak planın en etkili hamlesidir.',
                    'Bayrak, “geç kaldık” riskini “yanlış açtık” riskinden ayırır; her ikisi de kontrol altındadır.',
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <h2 id="simulator">Bu simülatörün SDLC’si</h2>
      <p>Bu depo küçük ve eğitim amaçlıdır. Aşağıda hangi aşamanın depoda nasıl göründüğü ve gerçek bir sistemde buna neyin eklenmesi gerektiği dürüstçe yazılmıştır.</p>
      <Table
        head={['Aşama', 'Bu depoda', 'Üretim düzeyinde eklenecekler']}
        rows={[
          [<b key="1">Gereksinim</b>, 'README’deki işlem tablosu ve kurallar (limitler, ücret, yanıt kodları); ayrı bir gereksinim kaydı yok', 'Gereksinim kimlikleri, kabul kriterleri, izlenebilirlik matrisi'],
          [<b key="2">Tasarım</b>, 'README’nin “Mimari notlar” bölümü; ADR niteliğinde kararlar (durumsuz host, imzalı belirteç) yazılı', 'Tehdit modeli, resmî ADR deposu, arayüz sürümleme'],
          [<b key="3">Gerçekleme</b>, 'React (Vite) + Flask; bağımlılıklar sabit sürümde (package.json, requirements)', 'Zorunlu kod incelemesi, linter, statik analiz'],
          [<b key="4">Test</b>, <>tests/test_host.py içinde {'36'} pytest testi; iptal, mutabakat, QR, BKM rotası, transfer ve güvenliği kapsar</>, 'Ön yüz testleri, sözleşme testleri, performans/soak, HIL, gerçek ağ ve sertifikasyon testleri'],
          [<b key="5">Dağıtım</b>, 'GitHub Actions: pytest (Python 3.12) ve npm ci + npm run build (Node 20). Vercel: README’ye göre main’e push üretime, PR önizleme ortamına gider', 'Ortam zinciri (test → UAT → üretim), onaylı yayın, canary, geri alma otomasyonu, değişiklik kaydı'],
          [<b key="6">Güvenlik</b>, <>Belirteçler HMAC ile imzalı; PIN yalnızca hash; <code key="e">.env</code> .gitignore’da; sır ortam değişkeniyle</>, 'Bağımlılık ve gizli bilgi taraması, SAST/DAST, anahtar yönetimi (HSM), sızma testi'],
          [<b key="7">İşletme</b>, 'Yok: yalnızca olay günlüğü ve EJ (eğitim amaçlı)', 'İzleme, alarm, olay yönetimi, çalışma kitapları, post-mortem'],
        ]}
      />
      <Callout tone="warn" title="Dürüst değerlendirme">
        Bu depoda <b>yok</b> olanlar: ön yüz otomatik testi, linter, bağımlılık ya da gizli bilgi taraması, dal koruma kuralları kodda görünmüyor (GitHub ayarlarında olabilir, doğrulayın), değişiklik/yayın kaydı ve izleme.
        Git geçmişi kısadır ve büyük adımlıdır; gerçek ekipte bu özellikler küçük ve incelenmiş PR’larla gelirdi. Simülatör <b>öğretim aracıdır</b>; bu tablo, farkın nerede olduğunu göstermek içindir.
      </Callout>

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Konu', 'Akılda kalacak kural']}
        rows={[
          [<b key="1">Neden farklı?</b>, 'Para, düzenleme, 7/24, donanım ve sertifikasyon: geri dönüşü ucuz olmayan yerde önceden kanıt toplayın'],
          [<b key="2">Aşamalar</b>, 'Gereksinim → tasarım → gerçekleme → test → dağıtım → işletme; döngü kapanır'],
          [<b key="3">Süreç modeli</b>, 'Tek bir doğru model yok; bankalar karıştırır. Wagile’dan kaçınmak için yayını koddan ayırın ve kanıtı otomatikleştirin'],
          [<b key="4">V-model</b>, 'Her tasarım katmanının karşısında bir test seviyesi: birim, entegrasyon, sistem/HIL, uçtan uca, UAT, sertifikasyon'],
          [<b key="5">Gereksinim</b>, 'Dışarıdan gelir ve tarihi sabittir; izlenebilirlik matrisi ve geriye doğru planlama'],
          [<b key="6">Tasarım</b>, 'Tehdit modeli, ADR, arayüz sözleşmeleri; idempotans ve iptal baştan tasarlanır'],
          [<b key="7">Güvenli SDLC</b>, 'PCI DSS ve OWASP kavramları; sır kodda yok, PAN/PIN günlükte yok, görev ayrılığı, maker-checker, CAB'],
          [<b key="8">Test</b>, 'Piramit, test kartları, simülatörler, arıza enjeksiyonu, mutabakat ve negatif testler'],
          [<b key="9">Yayın</b>, 'Ortam zinciri, canary / mavi-yeşil, bayrak, ATM filosuna dalgalı dağıtım, dondurma dönemleri'],
          [<b key="10">İşletme</b>, 'İş göstergeleriyle izleme, olay yönetimi, suçlamayan post-mortem, hotfix’te de aynı kontroller'],
          [<b key="11">Denetim</b>, 'Kanıt iş yaparken otomatik üretilir; sonradan toplanan kanıt zayıftır'],
        ]}
      />
    </>
  )
}
