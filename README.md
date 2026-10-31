# ATM Simülatörü

NCR SelfServ 84 (6684) benzeri bir ATM'nin önden görünümünü ve işlemlerin arka planda
bankanın sistemlerinde nasıl ilerlediğini görsel olarak gösteren simülatör.

- **Ön yüz:** React (Vite). ATM ekranı, EPP tuş takımı, kart okuyucu, para çıkışı/girişi, fiş yazıcı.
- **Arka uç:** Python (Flask), Vercel Serverless Function olarak çalışır. ATM Switch → InterAPI → HSM / Fraud / Core Banking / Fatura Kurumu ve başka banka kartları için BKM rotasını simüle eder.

## Ekran görüntüleri

**İşlem sürerken:** InterAPI → Core Banking adımı mesaj akışında canlandırılıyor.

![İşlem sürerken mesaj akışı](docs/preview.webp)

**Para çekme tamamlandı:** fiş yazdırıldı, kaset ve hesap bakiyesi güncellendi, olay günlüğünde XFS komutları görünüyor.

![Para çekme sonrası fiş ve olay günlüğü](docs/p2.webp)

**Mobil görünüm:**

<img src="docs/p3.webp" alt="Mobil görünüm" width="320">

## Neler görülebiliyor?

| İşlem | Cihaz (XFS) olayları | Host tarafı |
|---|---|---|
| Kart takma | `IDC_READ_RAW_DATA`, `IDC_CHIP_IO` | Kart bilgisi |
| PIN | `PIN_GET_PIN`, `PIN_GET_PINBLOCK` | ISO 8583 `0100/0110`, HSM doğrulama, 3 hatalı denemede kart alıkonur |
| Para çekme | `CDM_DENOMINATE`, `CDM_DISPENSE`, `IDC_EJECT_CARD`, `CDM_PRESENT` | `0200/0210`, fraud kontrolü, bakiye, günlük limit, kaset planı (geri izlemeli) |
| Para yatırma | `CIM_CASH_IN_START/CASH_IN/CASH_IN_END` | Recycler'a geri dönüşüm, şüpheli banknot alıkoyma |
| Bakiye | – | `0100/0110`, alan 54 |
| Fatura ödeme | – | Kurum sorgu + tahsilat |
| Çek yatırma | `IPM_MEDIA_IN`, `IPM_READ_IMAGE` | MICR satırı, takas durumu |
| QR ile para çekme (kartsız) | `CDM_DENOMINATE`, `CDM_DISPENSE`, `CDM_PRESENT` (kart iadesi yok) | İmzalı QR oturumu, mobil onay + fraud + bakiye ön kontrolü, `0200/0210` alan 48 |
| QR ile para yatırma (kartsız) | `CIM_CASH_IN_START/CASH_IN/CASH_IN_END` | Mobil onay, ardından ATM'de sayılan tutar için alacak kaydı |
| Başka banka ATM'si (not-on-us) | Aynı cihaz olayları | BKM üzerinden kartı çıkaran bankaya, işlem ücreti (alan 28), kısıtlı menü |
| Para transferi | – | IBAN mod-97 kontrolü, maskeli alıcı adı, havale / FAST / EFT, alan 103 |
| Nakit avans (kredi kartı) | Para çekme ile aynı | İşlem kodu `013000`, Kart Sistemi'nde limit provizyonu |
| Kredi kartı borç ödeme | Nakit: `CIM_*` | Nakit (`210030`) veya banka kartıyla hesaptan (`400030`) |
| Arıza ve iptal | `CDM_RETRACT`, `ERR_CDM_CASHUNITERROR`, `ERR_IDC_MEDIAJAM` | `0400/0410` iptal, `0420/0430` SAF tekrarı, alan 90 |
| Gün sonu | `CDM_START/END_EXCHANGE` | `0500/0510` mutabakat |

Sağ paneldeki **Mesaj akışı** diyagramı her isteğin hangi sistemlerden geçtiğini adım adım canlandırır;
**Olay günlüğü** XFS komutlarını ve ISO 8583 alanlarını (2, 3, 4, 11, 15, 28, 37, 38, 39, 41, 48, 49, 52, 54, 74, 76, 86, 88, 90, 97, 103) gösterir.

### Kartsız işlem (QR)

1. ATM'nin karşılama ekranında **Kartsız İşlem · QR ile** seçilir. ATM hosttan 120 saniye geçerli,
   imzalı bir QR oturumu alır ve kodu ekranda gösterir.
2. Cüzdanın altındaki **telefonda** (Demo Bank Mobil) müşteri seçilir, **QR Kodu Okut** ile kod okutulur,
   işlem türü (çekme / yatırma) ve çekimde tutar belirlenip **Biyometrik Onayla** ile onaylanır.
   Onay Mobil Banka → InterAPI → Fraud / Core Banking yolundan geçer.
3. ATM onayı alır. Çekimde tutar ATM'den değil mobil onaydan okunur ve kart olmadığı için banknotlar
   doğrudan sunulur. Yatırmada banknotlar haznede sayılır ve hesaba geçer.

QR ile işlem yalnızca Demo Bank müşterilerine açıktır (başka banka kartı sahibi `57` alır).
Ekrandaki QR deseni gösterim amaçlıdır, gerçek bir telefon kamerasıyla okunmaz.

### Başka banka ATM'si

Üst çubuktaki **ATM** seçiminden cihaz *Demo Bank · ATM00684* ya da *Atlas Bank · ATM77120* yapılır
(her terminalin kendi kasetleri vardır). Kart ATM'nin bankasına aitse işlem bankanın kendi
sistemlerinden geçer (**on-us**). Değilse istek BKM üzerinden kartı çıkaran bankaya gider (**not-on-us**):

- PIN sonrası ücret ekranı gösterilir, müşteri kabul etmeden menüye geçilmez.
- Yalnızca para çekme / nakit avans ve bakiye / limit sorgulama yapılabilir; diğer işlemler `58` ile reddedilir.
- Çekim ve sorgulama ücreti hesaptan düşer ve ISO alan 28'de görünür.

Elif Demir'in kartı Atlas Bank'a aittir: Demo Bank ATM'sinde not-on-us, Atlas Bank ATM'sinde on-us olur.

### Para transferi (havale / FAST / EFT)

Banka kartıyla **Para Transferi** seçilir, kayıtlı demo IBAN'lardan biri seçilir ya da 24 hane tuş takımıyla girilir.
Host IBAN'ı mod-97 ile doğrular ve alıcı adını maskeli gösterir (`E*** D****`).

| Alıcı bankası | Tutar | Yöntem |
|---|---|---|
| Aynı banka | Her tutar | Havale, core banking içinde anında virman |
| Başka banka | 50.000 TL'ye kadar | FAST: TCMB üzerinden 7/24 anlık |
| Başka banka | 50.000 TL üstü | EFT: hafta içi 09:00–17:00; dışında talimat kuyruğa alınır, ilk iş günü gönderilir |

Gerçekleşen havale ve FAST alıcının hesabına anında geçer; kuyruktaki EFT geçmez.

### Kredi kartı

Cüzdandaki **KREDİ · MASTERCARD** kartı (PIN 2580) takıldığında menü değişir:
**Nakit Avans** limitten düşer (işlem kodu `013000`), **Borç Öde (Nakit)** para yatırma haznesiyle
borcu kapatır, **Limit / Borç Bilgisi** limit, dönem borcu, asgari ödeme ve son ödeme tarihini gösterir.
Banka kartıyla **Diğer İşlemler → Kredi Kartı Borcu** ise aynı müşterinin kart borcunu hesaptan öder.

Ücretler, FAST limiti ve EFT saatleri demo değerlerdir; gerçek tarifeleri yansıtmaz.

### Arıza senaryoları ve iptal (reversal)

Sağ alttaki **Servis → Arıza** sekmesinden bir arıza seçilir. Seçilen arıza bir sonraki uygun işlemde bir kez tetiklenir.

| Arıza | Ne olur | Host tarafı |
|---|---|---|
| Para sıkışması | Host onayından sonra `CDM_DISPENSE` sırasında `WFS_ERR_CDM_CASHUNITERROR`; banknotlar red kutusuna gider, CDM devre dışı kalır | `0400/0410` iptal, alan 39 = `22` |
| Para alınmaz | Banknotlar 6 sn içinde alınmazsa `CDM_RETRACT` ile geri çekme kutusuna alınır | `0400/0410` iptal, alan 39 = `17` |
| Host yanıtı kaybolur | Host hesabı borçlandırır ama `0210` ATM'ye ulaşmaz; ATM para vermez | `0400` yanıtsız kalır, iptal store-and-forward (SAF) kuyruğunda bekler; **Teknisyen → SAF kuyruğunu gönder** ile `0420/0430` gider, alan 39 = `68` |
| Kart sıkışması | Kart iadesinde `WFS_ERR_IDC_MEDIAJAM`, kart alıkonur | – |
| Fiş kağıdı bitsin | İşlemler sürer, fiş yazdırılmaz (`WFS_ERR_PTR_PAPEROUT`) | – |

İptal mesajı alan 90'da orijinal işlemin MTI, STAN, tarih ve kurum kodunu taşır. Host tutarı ve ücreti hesaba
geri yazar, günlük çekim limitini geri açar. QR ile çekimde de aynı iptal akışı çalışır.

### Teknisyen / operatör modu

**Servis → Teknisyen** sekmesi:

- **Bakım moduna al:** ATM boştayken hizmet dışı ekranına geçer; aşağıdaki işlemler yalnızca bu modda yapılır.
- **Kasetleri doldur** (`CDM_START_EXCHANGE` / `END_EXCHANGE`), **Arızaları gider** (CDM sıfırlama, yeni fiş rulosu),
  **Kutuları boşalt** (red / geri çekme kutuları ve alıkonan kartlar; demo için kartlar cüzdana döner).
- **Gün sonu (0500):** dönemin borç / alacak toplamları `0500/0510` mutabakat mesajıyla hosta gönderilir.
  Tutarsa sayaçlar sıfırlanır ve yeni dönem açılır (aşağıya bakın).
- **SAF kuyruğunu gönder:** yanıtsız kalan iptalleri `0420` olarak tekrar gönderir.
- **Denkleştirme tablosu:** kupür başına Açılış + İkmal + Yatan − Verilen − Red − Geri çekilen = Beklenen,
  kasetteki sayılanla karşılaştırılır.
- **EJ** sekmesi terminalin elektronik günlüğünü (işlem, maskeli kart, tutar, sonuç, operatör işlemleri) gösterir.

### Takas ve mutabakat

**Servis → Takas & Mutabakat** sekmesi.

**Mutabakat (ATM gün sonu).** Host her nakit işlemi kendi defterine yazar. Gün sonunda ATM'nin `0500` ile
bildirdiği sayaçları (çekim adedi / tutarı, yatırma adedi / tutarı) bu kayıtlarla karşılaştırır. İptal edilen
çekimler düşülür.

- Tutarsa `0510` alan 39 = `00`, dönem kapanır.
- Tutmazsa alan 39 = `95` (mutabakat farkı) döner, dönem açık kalır ve ATM / Host / Fark tablosu gösterilir.

Farkı görmek için: **Host yanıtı kaybolur** arızasıyla bir çekim yapın, ardından bakım modunda **Gün sonu**
çalıştırın. Host 1 çekim borçlandırmış, ATM ise para vermemiştir. **SAF kuyruğunu gönder** ile iptal ulaşınca
gün sonu tekrarlanır ve mutabakat tutar.

**Takas (bankalar arası).** **Takas oturumunu çalıştır**, iki terminalin de takasa girmemiş host kayıtlarını işler:

| Bölüm | Ne olur |
|---|---|
| BKM | Başka banka kartıyla yapılan çekim ve sorgulamalar için kartı çıkaran banka, ATM sahibi bankaya tutar + ücret öder (demo kuralı: ücretin tamamı ATM sahibine). On-us işlemler takasa girmez. Takastan sonra gelen iptal, sonraki oturumda ters kayıt olur. |
| FAST / EFT | Bankalar arası transferler TCMB üzerinden netleşir. Mesai dışında kuyruğa alınan EFT'ler bu oturumda gönderilir ve alıcı hesaba yazılır. Havale banka içidir, takasa girmez. |
| Çek takası | Takastaki çekler sonuçlanır. Karşılıklı çek hesaba geçer; demo kuralı: numarası **9** ile biten çek karşılıksızdır. |
| Net pozisyonlar | Her bankanın oturum sonundaki net alacaklı (+) / borçlu (−) durumu. |

### Demo kartlar

| Kart | PIN | Not |
|---|---|---|
| VISA 4543 … 0001 | 1234 | Kendi kartı, yüksek bakiye |
| TROY 9792 … 0042 | 4321 | Kendi kartı, düşük bakiye (51 yetersiz bakiye denemek için) |
| MASTERCARD 5170 … 7788 | 0000 | Atlas Bank kartı: Demo Bank ATM'sinde BKM rotası |
| KREDİ · MASTERCARD 5400 … 3311 | 2580 | Ayşe Yılmaz'ın Demo Bank kredi kartı (limit 40.000 TL, borç 8.750 TL) |

20 TL kaseti bilerek az doldurulmuştur; 60, 70 gibi tutarlarda kaset planlamasını izleyebilirsiniz.

## Yerelde çalıştırma

```bash
npm install
pip install -r requirements-dev.txt

# 1. terminal: Python host simülatörü (http://localhost:5328)
npm run dev:api

# 2. terminal: React arayüzü (http://localhost:5173, /api istekleri 5328'e proxy'lenir)
npm run dev
```

Alternatif olarak Vercel CLI ile ikisini birlikte çalıştırabilirsiniz: `vercel dev`

Testler: `pytest -q`

## Vercel'e yayınlama (Git entegrasyonu)

1. Bu klasörü GitHub/GitLab'da yeni bir repoya push edin:
   ```bash
   git remote add origin git@github.com:<kullanici>/atm-simulator.git
   git push -u origin main
   ```
2. Vercel'de **Add New → Project** ile repoyu seçin. `vercel.json` ayarları otomatik okunur:
   - Framework: Vite, build `npm run build`, çıktı `dist`
   - `api/index.py` Python fonksiyonu olarak derlenir, `requirements.txt` kurulur
   - `/api/*` istekleri `api/index` fonksiyonuna yönlenir
3. **Settings → Environment Variables** altına `SESSION_SECRET` ekleyin (uzun, rastgele bir değer).
4. Sonrasında `main`'e her push production'a, her pull request ayrı bir preview URL'ine deploy edilir.
   `.github/workflows/ci.yml` aynı anda Python testlerini ve React build'ini çalıştırır.

## Mimari notlar

### Gerçek ATM mimarisi ve sertifikasyonlar

Simülatörün modellediği yapının gerçek dünyadaki karşılığı: ATM donanımı ve yazılım katmanları,
banka/host sistemleri, bileşen bazında gerekli sertifikalar (EMV, PCI PTS, PCI DSS, XFS vb.) ve
ATM yaşam döngüsü.

![ATM sistem mimarisi ve sertifikasyon genel görünümü](docs/atm-architecture-certifications.webp)

### Bu projede

- Vercel fonksiyonları durumsuzdur. Bu yüzden hesap bakiyeleri ve kaset sayıları tarayıcıda tutulur,
  her istekte hosta gönderilir; host kuralları uygular ve yeni durumu döner. Gerçek sistemde bu
  veriler core banking veritabanında ve ATM'nin kendi kaset sayaçlarında tutulur.
- PIN'ler sunucuda yalnızca hash olarak bulunur. PIN doğrulandıktan sonra HMAC ile imzalı,
  5 dakika geçerli bir oturum token'ı verilir; diğer tüm işlemler bu token'ı ister.
- Kartsız işlemde gerçek sistem mobil onayı hostta saklar ve ATM durumu sorgular (polling).
  Burada host durumsuz olduğu için onay, işlem türüne ve terminale bağlı imzalı bir token olarak
  istemcide taşınır; bu yüzden tek kullanımlık olması host tarafından garanti edilmez.
- Gün sonu ve takas için host kendi defterine ihtiyaç duyar. Host durumsuz olduğu için her kayıt imzalı
  olarak istemcide tutulur ve geri gönderilir; host imzası tutmayan kaydı yok sayar. Gerçek sistemde bu
  defter core banking veritabanıdır.
- Bu proje eğitim amaçlıdır; gerçek bir banka, kart şeması veya kurumla bağlantısı yoktur.

```
api/
  index.py        Flask uygulaması, tüm /api rotaları
  _host.py        Host iş kuralları (alt çizgi: Vercel bunu ayrı fonksiyon yapmaz)
src/
  App.jsx         İşlem akışı / durum makinesi
  components/     AtmMachine, Screen, FlowDiagram, EventLog, StatusPanel, ServicePanel, Wallet, Phone
tests/            pytest testleri
vercel.json       Build, Python fonksiyonu ve rewrite ayarları
```
