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

// ---------------------------------------------------------------- mesaj adı çözücü
const AREAS = {
  pain: 'Payments Initiation: müşteri ile banka arası ödeme başlatma',
  pacs: 'Payments Clearing and Settlement: bankalar arası takas ve uzlaşma',
  camt: 'Cash Management: ekstre, bildirim, iptal ve araştırma',
  acmt: 'Account Management: hesap açma ve değiştirme',
  head: 'Business Application Header: mesajın zarfı',
  admi: 'Administration: sistem ve yönetim mesajları',
}
const MSG_NAMES = {
  'pain.001': 'Customer Credit Transfer Initiation: müşterinin havale/ödeme talimatı',
  'pain.002': 'Customer Payment Status Report: talimatın durumu',
  'pain.008': 'Customer Direct Debit Initiation: otomatik tahsilat talimatı',
  'pacs.008': 'FI to FI Customer Credit Transfer: bankadan bankaya müşteri havalesi',
  'pacs.002': 'FI to FI Payment Status Report: bankalar arası durum raporu',
  'pacs.004': 'Payment Return: ödemenin iadesi',
  'pacs.009': 'FI Credit Transfer: bankanın kendi adına yaptığı transfer (cover dahil)',
  'camt.053': 'Bank to Customer Statement: gün sonu ekstre',
  'camt.054': 'Bank to Customer Debit Credit Notification: borç/alacak bildirimi',
  'camt.056': 'FI to FI Payment Cancellation Request: iptal / geri çağırma talebi',
  'camt.029': 'Resolution of Investigation: iptal talebine yanıt',
  'head.001': 'Business Application Header: mesaj zarfı',
}
const EXAMPLES = ['pacs.008.001.08', 'pacs.002.001.10', 'pain.001.001.09', 'camt.056.001.08', 'camt.053.001.08', 'head.001.001.02']

function NameLab() {
  const [v, setV] = useState('pacs.008.001.08')
  const m = /^([a-z]{4})\.(\d{3})\.(\d{3})\.(\d{2})$/.exec(v.trim().toLowerCase())
  const parts = m
    ? [
        ['Alan', m[1], AREAS[m[1]] ?? 'Listede olmayan bir iş alanı'],
        ['Mesaj no', m[2], MSG_NAMES[`${m[1]}.${m[2]}`] ?? 'Bu birleşim kısa listede yok: standardın mesaj kataloğuna bakın'],
        ['Varyant', m[3], '001 = standart biçim. Bir ağ kendi kuralını “kullanım kılavuzu” ile getirir, numara genelde değişmez'],
        ['Sürüm', m[4], 'Aynı mesajın yeni sürümü: alanlar eklenir, bazıları değişir. Tarafların aynı sürümü konuşması gerekir'],
      ]
    : null
  return (
    <div className="tr-lab">
      <div className="tr-lab-row">
        <label>
          Mesaj tanımlayıcısı
          <input className="tr-input mono wide" value={v} onChange={(e) => setV(e.target.value)} spellCheck={false} aria-invalid={!m} aria-describedby="msg-lab-out" />
        </label>
        <div className="tr-chips" aria-label="Hazır örnekler">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className={`tr-chip ${x === v ? 'on' : ''}`} onClick={() => setV(x)}>
              {x}
            </button>
          ))}
        </div>
      </div>
      <p id="msg-lab-out" className="tr-lab-out">
        {m ? <b>{MSG_NAMES[`${m[1]}.${m[2]}`] ?? 'Mesaj numarası kısa listede yok'}</b> : 'Şu biçimde yazın: alan.numara.varyant.sürüm (ör. pacs.008.001.08).'}
      </p>
      {parts && (
        <div className="tr-digits">
          {parts.map(([title, val, text]) => (
            <div key={title} className="tr-digit">
              <span className="d">{val}</span>
              <small>{title}</small>
              <b style={{ fontWeight: 500 }}>{text}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- örnek XML
// Kurgusal örnek: Ayşe Yılmaz (Demo Bank) → Elif Demir (Atlas Bank), 1.250,00 TL, simülatörün IBAN'ları.
// BIC'ler, kimlikler ve BizSvc değeri uydurmadır; gerçek bir şemanın şartnamesi değildir.
const XML_008 = `<AppHdr xmlns="urn:iso:std:iso:20022:tech:xsd:head.001.001.02">
  <Fr><FIId><FinInstnId><BICFI>DEMOTRIS</BICFI></FinInstnId></FIId></Fr>
  <To><FIId><FinInstnId><BICFI>ATLSTRIS</BICFI></FinInstnId></FIId></To>
  <BizMsgIdr>DEMO-20261101-000042</BizMsgIdr>
  <MsgDefIdr>pacs.008.001.08</MsgDefIdr>
  <BizSvc>ornek.hizli.odeme</BizSvc>
  <CreDt>2026-11-01T12:34:56+03:00</CreDt>
</AppHdr>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>DEMO20261101000042</MsgId>
      <CreDtTm>2026-11-01T12:34:56+03:00</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <TtlIntrBkSttlmAmt Ccy="TRY">1250.00</TtlIntrBkSttlmAmt>
      <IntrBkSttlmDt>2026-11-01</IntrBkSttlmDt>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <InstrId>004217</InstrId>
        <EndToEndId>KIRA-2026-11</EndToEndId>
        <TxId>263051200418</TxId>
        <UETR>3f6b2c1e-8d4a-4b7e-9c15-2a7e6f0d9b34</UETR>
      </PmtId>
      <PmtTpInf><LclInstrm><Prtry>HIZLI</Prtry></LclInstrm></PmtTpInf>
      <IntrBkSttlmAmt Ccy="TRY">1250.00</IntrBkSttlmAmt>
      <ChrgBr>SLEV</ChrgBr>
      <Dbtr><Nm>AYSE YILMAZ</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>TR360006100000001978645784</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId>
        <BICFI>DEMOTRIS</BICFI>
        <ClrSysMmbId><MmbId>00061</MmbId></ClrSysMmbId>
      </FinInstnId></DbtrAgt>
      <CdtrAgt><FinInstnId>
        <BICFI>ATLSTRIS</BICFI>
        <ClrSysMmbId><MmbId>00099</MmbId></ClrSysMmbId>
      </FinInstnId></CdtrAgt>
      <Cdtr><Nm>ELIF DEMIR</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>TR830009900000004410278100</IBAN></Id></CdtrAcct>
      <Purp><Cd>RENT</Cd></Purp>
      <RmtInf><Ustrd>Kasim 2026 kira</Ustrd></RmtInf>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`

const XML_002_OK = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
  <FIToFIPmtStsRpt>
    <GrpHdr>
      <MsgId>ATLAS20261101000917</MsgId>
      <CreDtTm>2026-11-01T12:34:57+03:00</CreDtTm>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>DEMO20261101000042</OrgnlMsgId>
      <OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId>
    </OrgnlGrpInfAndSts>
    <TxInfAndSts>
      <StsId>ATLAS-STS-000917</StsId>
      <OrgnlInstrId>004217</OrgnlInstrId>
      <OrgnlEndToEndId>KIRA-2026-11</OrgnlEndToEndId>
      <OrgnlTxId>263051200418</OrgnlTxId>
      <OrgnlUETR>3f6b2c1e-8d4a-4b7e-9c15-2a7e6f0d9b34</OrgnlUETR>
      <TxSts>ACSC</TxSts>
      <AccptncDtTm>2026-11-01T12:34:57+03:00</AccptncDtTm>
    </TxInfAndSts>
  </FIToFIPmtStsRpt>
</Document>`

const XML_002_RJCT = `<TxInfAndSts>
  <StsId>ATLAS-STS-000918</StsId>
  <OrgnlEndToEndId>KIRA-2026-11</OrgnlEndToEndId>
  <OrgnlTxId>263051200419</OrgnlTxId>
  <OrgnlUETR>8a1d5e72-4c3b-4f90-b6a2-0e9d7c1f5a63</OrgnlUETR>
  <TxSts>RJCT</TxSts>
  <StsRsnInf>
    <Rsn><Cd>AC04</Cd></Rsn>
    <AddtlInf>Alici hesap kapali</AddtlInf>
  </StsRsnInf>
</TxInfAndSts>`

const XML_STRD = `<RmtInf>
  <Strd>
    <RfrdDocInf>
      <Tp><CdOrPrtry><Cd>CINV</Cd></CdOrPrtry></Tp>
      <Nb>FTR-2026-0187</Nb>
      <RltdDt>2026-10-28</RltdDt>
    </RfrdDocInf>
    <RfrdDocAmt><DuePyblAmt Ccy="TRY">1250.00</DuePyblAmt></RfrdDocAmt>
    <CdtrRefInf>
      <Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry></Tp>
      <Ref>RF18539007547034</Ref>
    </CdtrRefInf>
  </Strd>
</RmtInf>`

// ---------------------------------------------------------------- sayfa
const ACT = {
  atm: { id: 'atm', label: 'ATM', sub: 'NDC / ISO 8583' },
  host: { id: 'host', label: 'Banka Host', sub: 'Core + InterAPI' },
  fast: { id: 'fast', label: 'FAST / TCMB', sub: 'Bankalar arası sistem' },
  alici: { id: 'alici', label: 'Alıcı Banka', sub: 'Atlas Bank' },
  musteri: { id: 'musteri', label: 'Müşteri', sub: 'Mobil / internet' },
  a: { id: 'a', label: 'Gönderen Banka', sub: 'Debtor Agent' },
  b: { id: 'b', label: 'Alıcı Banka', sub: 'Creditor Agent' },
  sis: { id: 'sis', label: 'Ödeme Sistemi', sub: 'FAST / EFT / SWIFT' },
}

export default function Iso20022() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Ödeme mesajlaşması"
        title="ISO 20022"
        lead="ISO 8583 ATM ile kartlı işlemin dilidir. Bankalar arası havale, FAST, EFT ve SWIFT ödemelerinin dili ise giderek ISO 20022’dir: XML tabanlı, bol veri taşıyan, her ödemeye tek bir uçtan uca kimlik veren bir mesaj ailesi. Bu sayfa, simülatördeki transferin arka ofiste hangi mesajlara karşılık geldiğini anlatır."
      />

      <h2 id="giris">ISO 20022 nedir, neden var?</h2>
      <p>
        ISO 20022, finansal mesajlaşma için bir <b>metodoloji ve mesaj kataloğudur</b>. Önce iş süreci ve veri sözlüğü modellenir, sonra bundan
        mesaj tanımları (şemalar) üretilir. Sahada en çok karşılaşılan gösterimi <b>XML</b>’dir; “MX” (SWIFT’in ISO 20022 mesajlarına verdiği ad) ve
        “pacs.008” gibi adları duyduğunuzda konuşulan şey budur.
      </p>
      <p>Eski dünyayla farkı tek tabloda görmek en kolayı:</p>
      <Table
        head={['', 'ISO 8583', 'SWIFT MT', 'ISO 20022 (MX)']}
        rows={[
          ['Ne için', 'Kart işlemi: ATM, POS', 'Bankalar arası ödeme ve mesajlaşma', 'Bankalar arası ve müşteri-banka ödeme, ekstre, iptal, araştırma'],
          ['Biçim', 'Bitmap + sabit/değişken uzunluklu alanlar', 'Etiketli, serbest metin ağırlıklı alanlar (ör. :32A:, :59:)', 'XML (hiyerarşik, etiketli, şema ile doğrulanır)'],
          ['Veri zenginliği', 'Az alan, kısa değerler', 'Satır başı karakter sınırları, adres ve açıklama sığmaz', 'Ayrı ayrı adlandırılmış yapılar: ad, adres, kimlik, yapılandırılmış açıklama'],
          ['Ödeme kimliği', 'STAN, RRN (hop başına)', 'Referans alanları (ağ boyunca değişebilir)', 'EndToEndId + UETR: uçtan uca değişmeyen kimlik'],
          ['Otomasyon', 'Yanıt kodu 2 hane', 'Hata nedenini çoğu zaman insan okur', 'Durum ve neden kodları makine okunur (TxSts, StsRsnInf)'],
        ]}
      />
      <h3>Neden geçiliyor?</h3>
      <ul>
        <li>
          <b>Veri zenginliği:</b> gönderen ve alıcının adı, adresi, kimliği, ödemenin amacı ve faturası mesajda ayrı alanlarda taşınır. Uyum (AML,
          yaptırım taraması) ve otomatik mutabakat için serbest metni ayrıştırmak gerekmez.
        </li>
        <li>
          <b>Yapılandırılmış açıklama:</b> “fatura no, tutar, referans” gibi bilgi makinenin okuyacağı biçimde gelir, alıcı taraf ödemeyi otomatik eşleştirir.
        </li>
        <li>
          <b>İzlenebilirlik:</b> <b>UETR</b> (36 karakterlik UUID) ödeme baştan sona aynı kalır; SWIFT gpi ile ödemenin hangi bankada olduğu izlenebilir.
        </li>
        <li>
          <b>Ortak dil:</b> anlık ödeme sistemlerinin çoğu ve büyük tahsilat/ödeme altyapıları aynı mesaj katalogunu kullanır; bir kez öğrenilen yapı birçok sistemde işe yarar.
        </li>
      </ul>
      <h3>Geçiş takvimi</h3>
      <Table
        head={['Alan', 'Durum', 'Not']}
        rows={[
          ['SWIFT CBPR+ (sınır ötesi)', 'MT ile MX birlikte yaşama dönemi Mart 2023’te başladı; bankalar arası ödeme talimatlarında dönemin sonu 22 Kasım 2025', 'Bazı mesaj grupları (ör. MT9xx raporlama) için süre uzatıldı, ücretli çeviri servisi sürüyor. Kesin durum için SWIFT’in güncel duyurularını doğrulayın.'],
          ['Yurt içi şemalar', 'Dünyada hızlı ödeme sistemlerinin neredeyse tamamı ISO 20022 kullanıyor', 'Ülke ve şemaya göre takvim değişir; kendi şemanızın şartnamesine bakın.'],
          ['Türkiye (FAST, EFT)', 'FAST ve EFT TCMB tarafından işletilir', 'Bu sistemlerin mesaj biçimi, sürümü ve geçiş tarihi için doğrulayın: TCMB’nin güncel şartnamelerine bakılmalı. Simülatör günlüğü FAST/EFT satırında “ISO 20022 pacs.008” yazar.'],
        ]}
      />
      <Callout title="ATM hâlâ ISO 8583 / NDC konuşur">
        ATM ile switch arasında NDC/DDC, switch ile banka host’u arasında ISO 8583 vardır. ISO 20022 <b>bankanın arkasında</b>, ödeme sistemine ve
        diğer bankalara çıkan tarafta görünür. Aynı havale, ATM’de <code>0200</code> olarak başlar, bankalar arası yolda <code>pacs.008</code>’e
        dönüşür. Bu sayfanın “ATM nerede?” senaryosu bunu gösterir.
      </Callout>

      <h2 id="aileler">Mesaj aileleri ve adlandırma</h2>
      <p>
        Her mesajın adı <code>alan.numara.varyant.sürüm</code> biçimindedir. İlk dört harf <b>iş alanını</b>, sonraki üç hane <b>mesajı</b>, ardından varyant
        ve sürüm gelir. Aşağıda adı yazın ya da bir örnek seçin; parçalar tek tek çözülür.
      </p>
      <NameLab />
      <Table
        head={['Mesaj', 'Ad', 'Ne zaman kullanılır', 'Yön']}
        rows={[
          [<b key="1">pain.001</b>, 'Customer Credit Transfer Initiation', 'Müşteri bankasına “şu hesaba şu kadar gönder” der (mobil, internet, kurumsal dosya)', 'Müşteri → banka'],
          [<b key="2">pain.002</b>, 'Customer Payment Status Report', 'Banka talimatın kabul/red durumunu müşteriye bildirir', 'Banka → müşteri'],
          [<b key="3">pacs.008</b>, 'FI to FI Customer Credit Transfer', 'Müşteri havalesinin bankalar arası hali. Bu sayfanın ana karakteri', 'Banka → banka / sistem'],
          [<b key="4">pacs.002</b>, 'FI to FI Payment Status Report', 'pacs.008’in sonucu: kabul, red, neden', 'Banka / sistem → banka'],
          [<b key="5">pacs.004</b>, 'Payment Return', 'Alınmış bir ödemenin iadesi (hesap kapalı, geri çağırma kabulü)', 'Alıcı banka → gönderen banka'],
          [<b key="6">pacs.009</b>, 'FI Credit Transfer', 'Bankanın kendi adına yaptığı transfer: likidite, cover (COV) ödemeleri', 'Banka → banka'],
          [<b key="7">camt.053</b>, 'Bank to Customer Statement', 'Gün sonu ekstre: açılış, kapanış bakiyesi, hareketler', 'Banka → müşteri'],
          [<b key="8">camt.054</b>, 'Bank to Customer Debit Credit Notification', 'Tek tek borç/alacak bildirimi (anlık)', 'Banka → müşteri'],
          [<b key="9">camt.056</b>, 'FI to FI Payment Cancellation Request', 'Gönderilen ödemenin iptali / geri çağrılması talebi', 'Gönderen banka → alıcı banka'],
          [<b key="10">camt.029</b>, 'Resolution of Investigation', 'camt.056’ya yanıt: iptal kabul mü red mi', 'Alıcı banka → gönderen banka'],
          [<b key="11">acmt.xxx</b>, 'Account Management', 'Hesap açma/değiştirme talepleri; ödeme akışının parçası değil, aynı kataloğun üyesi', 'Müşteri ↔ banka'],
          [<b key="12">head.001</b>, 'Business Application Header', 'Her mesajın önüne gelen zarf: kimden, kime, hangi mesaj, ne zaman', 'Hepsi'],
        ]}
      />
      <Callout tone="warn" title="Sürüm numaralarını doğrulayın">
        Yukarıdaki örnek sürümler (<code>pacs.008.001.08</code> gibi) CBPR+ çevresinde yaygın görülenlerdir. Sürüm ağdan ağa ve yıldan yıla değişir;
        bir entegrasyonda geçerli olan sürümü her zaman ilgili şemanın kullanım kılavuzundan doğrulayın.
      </Callout>

      <h2 id="yapi">Bir mesajın yapısı</h2>
      <p>
        Bir ISO 20022 mesajı iki parçadan oluşur: <b>BAH</b> (<code>head.001</code>, zarf) ve <b>Document</b> (asıl iş verisi). Document’in içinde bir
        <b> grup başlığı</b> (<code>GrpHdr</code>) ve bir ya da birden çok <b>işlem</b> bloğu (<code>CdtTrfTxInf</code>) bulunur.
      </p>
      <Table
        head={['Eleman', 'Anlamı', 'Not']}
        rows={[
          [<code key="1">AppHdr</code>, 'BAH: Fr (gönderen), To (alıcı), BizMsgIdr, MsgDefIdr (mesaj tanımı), BizSvc, CreDt', 'Gönderen/alıcı kurum BICFI ile belirtilir. Zarfın tam biçimi ağa göre değişir.'],
          [<code key="2">GrpHdr</code>, 'MsgId, CreDtTm, NbOfTxs, toplam tutar, uzlaşma bilgisi', 'MsgId mesajı, işlemler ise TxId/UETR ile tanımlanır.'],
          [<code key="3">PmtId</code>, 'InstrId, EndToEndId, TxId, UETR', 'Dört ayrı kimlik; aşağıdaki tabloda ayrımı var.'],
          [<code key="4">IntrBkSttlmAmt</code>, 'Bankalar arası uzlaşma tutarı; para birimi Ccy özniteliğinde', <>Ondalık nokta ile yazılır: <code>1250.00</code>. ISO 8583’teki gibi kuruş tamsayısı değildir.</>],
          [<code key="5">ChrgBr</code>, 'Ücreti kim öder: DEBT (gönderen), CRED (alıcı), SHAR (paylaşım), SLEV (şemanın kuralı)', 'Yurt içi anlık şemalarda genellikle SLEV; sınır ötesinde DEBT/CRED/SHAR.'],
          [<code key="6">Dbtr / Cdtr</code>, 'Borçlu (gönderen) ve alacaklı (alıcı): Nm, PstlAdr, Id', 'Ad ve adres yapılandırılmış alanlardır; uyum taraması bunlara bakar.'],
          [<code key="7">DbtrAcct / CdtrAcct</code>, 'Hesap: Id/IBAN ya da Id/Othr', 'Türkiye IBAN’ı 26 hane: TR + 2 kontrol + 5 banka kodu + 1 yedek + 16 hesap.'],
          [<code key="8">DbtrAgt / CdtrAgt</code>, 'Gönderen ve alıcı banka: FinInstnId altında BICFI veya ClrSysMmbId', 'BICFI = BIC (8 veya 11 karakter). Yurt içi sistemler kendi üye numarasını kullanabilir.'],
          [<code key="9">Purp</code>, 'Ödeme amacı kodu: SALA maaş, SUPP tedarikçi, RENT kira, TAXS vergi', 'Harici kod listesinden gelir; serbest metin değildir.'],
          [<code key="10">RmtInf</code>, 'Ustrd (serbest, kısa) ya da Strd (yapılandırılmış)', 'Aşağıda ayrıntısı var.'],
        ]}
      />
      <h3>Dört kimlik: hangisi ne işe yarar?</h3>
      <Table
        head={['Kimlik', 'Kim verir', 'Ne kadar yaşar', 'ISO 8583’teki en yakın karşılığı']}
        rows={[
          [<b key="1">InstrId</b>, 'Talimatı başlatan taraf', 'Yalnızca iki komşu taraf arasında anlamlı', 'STAN (alan 11)'],
          [<b key="2">EndToEndId</b>, 'Ödemeyi başlatan müşteri / kurum', 'Baştan sona değişmez; ekstrede alıcı da görür', 'Yok'],
          [<b key="3">TxId</b>, 'İlk talimatı veren banka', 'Bankalar arası işlemi tanımlar', 'RRN (alan 37), kabaca'],
          [<b key="4">UETR</b>, 'Başlatan banka (UUID v4)', 'Tüm zincir boyunca; iptal ve iade mesajları da bunu taşır', 'Yok'],
        ]}
      />
      <h3>Serbest ve yapılandırılmış açıklama</h3>
      <p>
        <code>Ustrd</code> kısa bir serbest metindir (tipik sınır 140 karakter). <code>Strd</code> ise belgenin türünü, numarasını, tutarını ve alıcının
        referansını ayrı ayrı taşır. Aşağıdaki örnekte fatura (<code>CINV</code>) ve ISO 11649 biçimli alacaklı referansı (<code>SCOR</code>, “RF…”) var.
        Alıcı kurum bu alanları okuyup faturayı kendiliğinden kapatabilir.
      </p>
      <Code label="Yapılandırılmış açıklama örneği">{XML_STRD}</Code>

      <h2 id="esleme">ISO 8583’ten ISO 20022’ye eşleme</h2>
      <p>
        Simülatörde Ayşe Yılmaz’ın Demo Bank ATM’sinden Elif Demir’e yaptığı FAST transferi iki dünyada şöyle görünür. Günlükte gördüğünüz{' '}
        <code>0200</code> mesajının alanları solda, bankalar arası yoldaki ISO 20022 karşılıkları sağdadır.
      </p>
      <Table
        head={['ISO 8583', 'Simülatörde', 'ISO 20022', 'Fark']}
        rows={[
          [<b key="1">MTI 0200 / 0210</b>, <Sim key="s">sim</Sim>, 'pacs.008 / pacs.002', 'İstek ve yanıt MTI ile değil, iki ayrı mesaj tanımıyla ayrılır.'],
          [<b key="2">Alan 3 (400000)</b>, <Sim key="s">sim</Sim>, 'Mesaj türü (pacs.008) + hesap türü (DbtrAcct/Tp) + Purp', 'Tek bir “işlem kodu” alanı yoktur; anlam birkaç yerde taşınır.'],
          [<b key="3">Alan 4 (000000125000)</b>, <Sim key="s">sim</Sim>, <code key="c">IntrBkSttlmAmt Ccy=“TRY”: 1250.00</code>, 'Kuruş tamsayısı yerine ondalık sayı; para birimi tutarın özniteliği.'],
          [<b key="4">Alan 49 (949)</b>, <Sim key="s">sim</Sim>, <code key="c">Ccy=“TRY”</code>, 'Sayısal ISO 4217 kodu yerine üç harfli kod.'],
          [<b key="5">Alan 7, 12, 13</b>, <Sim key="s">sim</Sim>, 'CreDtTm, IntrBkSttlmDt', 'Tek ISO 8601 zaman damgası (yıl ve saat dilimi dahil).'],
          [<b key="6">Alan 11 STAN</b>, <Sim key="s">sim</Sim>, 'InstrId', 'Eşleştirme anahtarı iki komşu arasında geçerlidir.'],
          [<b key="7">Alan 37 RRN</b>, <Sim key="s">sim</Sim>, 'TxId', 'İşlemi sonradan bulmanın anahtarı.'],
          [<b key="8">Yok</b>, '', 'EndToEndId, UETR', 'ISO 8583’te uçtan uca değişmeyen bir kimlik yoktur; her hop kendi STAN’ını üretir.'],
          [<b key="9">Alan 103 (IBAN)</b>, <Sim key="s">sim</Sim>, <code key="c">CdtrAcct/Id/IBAN</code>, 'Alıcı hesap; alan 102 gönderen hesabıdır (simülatör onu göndermez).'],
          [<b key="10">Alan 2 (maskeli PAN)</b>, <Sim key="s">sim</Sim>, <code key="c">DbtrAcct/Id/IBAN</code>, 'Transferde kartın kendisi değil, kartın bağlı olduğu hesap taşınır; kart bilgisi bankalar arası mesajda yer almaz.'],
          [<b key="11">Alan 32 (acquirer), alan 41 (terminal)</b>, <Sim key="s">sim</Sim>, 'DbtrAgt (gönderen banka). Terminal için karşılık yok', 'ATM, kanal bilgisidir; alıcı banka bunu görmez.'],
          [<b key="12">Alan 28 (D00000500)</b>, <Sim key="s">sim</Sim>, 'ChrgBr, gerekirse ChrgsInf', 'Müşteri ile kendi bankası arasındaki ücret bankalar arası mesajda görünmeyebilir.'],
          [<b key="13">Alan 48 (serbest veri)</b>, '', 'RmtInf/Ustrd veya Strd', 'Serbest metin yerine yapılandırılmış açıklama da gelebilir.'],
          [<b key="14">Alan 39 (yanıt kodu)</b>, <Sim key="s">sim</Sim>, 'pacs.002: TxSts + StsRsnInf/Rsn/Cd', 'İki haneli sayı yerine durum (ACSC, RJCT…) ve ayrı bir neden kodu (AM04, AC04…).'],
          [<b key="15">Alan 38 (onay kodu)</b>, <Sim key="s">sim</Sim>, 'AccptncDtTm (kabul zamanı)', 'Onay kodunun doğrudan karşılığı yoktur.'],
          [<b key="16">0400 / 0420 + alan 90</b>, <Sim key="s">sim</Sim>, 'camt.056 → camt.029 → pacs.004', 'Alan 90’ın yerini OrgnlMsgId, OrgnlTxId ve OrgnlUETR alır.'],
          [<b key="17">0500 / 0510</b>, <Sim key="s">sim</Sim>, 'camt.053 (ekstre) ile mutabakat', 'Yaklaşık bir eşleme: gün sonu uzlaşması ekstre ve bildirimlerle yapılır.'],
        ]}
      />
      <h3>Yanıt kodundan durum koduna</h3>
      <p>
        Alan 39 hem sonucu hem nedeni iki karaktere sıkıştırır. pacs.002’de ise sonuç <code>TxSts</code>’te, neden <code>StsRsnInf</code>’de ayrı durur.
        İki tarafın eşlemesi standartta tanımlı değildir; her banka ve şema kendi tablosunu yapar. Aşağıdaki eşleme öğretici bir yaklaşıktır.
      </p>
      <Table
        head={['Alan 39', 'Anlamı', 'TxSts', 'Olası neden (StsRsnInf)']}
        rows={[
          [<b key="1">00</b>, 'Onaylandı', 'ACSC (uzlaşma tamamlandı); alıcı hesaba alacak yazıldıysa ACCC da kullanılır', '—'],
          [<b key="2">51</b>, 'Yetersiz bakiye', 'RJCT', 'AM04 (yetersiz bakiye)'],
          [<b key="3">14</b>, 'Geçersiz hesap', 'RJCT', 'AC01 (hesap numarası hatalı)'],
          [<b key="4">13</b>, 'Geçersiz tutar', 'RJCT', 'AM02 (izin verilmeyen tutar) ya da şemanın limit kodu'],
          [<b key="5">91</b>, 'Sistem ulaşılamıyor', 'Yanıt yok / PDNG', 'Durum bilinmez: araştırma gerekir (aşağıdaki not)'],
          [<b key="6">55, 75</b>, 'PIN hataları', '—', 'Karşılığı yok: PIN kart dünyasına aittir, hesap transferinde bankalar arası mesaja girmez'],
        ]}
      />
      <Callout tone="warn" title="“Yanıt yok” ISO 20022’de de çözülmüş değil">
        pacs.008’i gönderdiniz, pacs.002 gelmedi. Para gitti mi? ISO 8583’teki zaman aşımı sorununun aynısı. Çözüm yine mesajla yapılır: durum sorgulamak
        için bir araştırma/durum isteği gönderilir, gerekirse camt.056 ile iptal istenir. Şemalar ayrıca zaman aşımı kurallarını (örneğin anlık
        ödemede kesin bir süre) kendileri tanımlar. Ayrıntı için ACID sayfasındaki “yanıt kayboldu” senaryosuna bakın.
      </Callout>

      <h2 id="xml">Gerçekçi örnek: pacs.008 ve pacs.002</h2>
      <p>
        Aşağıdaki mesajlar <b>kurgusaldır</b>: kimlikler, BIC’ler ve zarf değerleri uydurmadır; IBAN’lar simülatördeki Ayşe Yılmaz (Demo Bank) ve Elif Demir (Atlas Bank)
        hesaplarının IBAN’ıdır. Gerçek bir FAST/EFT şartnamesi değildir: eleman adları ISO 20022 genel mesajına uyar, şemaya özgü zorunluluklar farklı olabilir
        (doğrulayın). Kolay okunsun diye Türkçe karakterler kullanılmadı; birçok ağda izin verilen karakter kümesi sınırlıdır.
      </p>
      <Tabs
        label="Örnek XML mesajları"
        tabs={[
          { label: 'pacs.008 · havale', content: <Code label="pacs.008 örneği">{XML_008}</Code> },
          { label: 'pacs.002 · kabul', content: <Code label="pacs.002 kabul örneği">{XML_002_OK}</Code> },
          { label: 'pacs.002 · red', content: <Code label="pacs.002 red örneği">{XML_002_RJCT}</Code> },
        ]}
      />
      <h3>Alan alan okuyalım</h3>
      <Table
        head={['Eleman / değer', 'Okunuşu']}
        rows={[
          [<code key="1">MsgDefIdr = pacs.008.001.08</code>, 'Zarf, içindeki Document’in hangi mesaj tanımına uyduğunu söyler. Alıcı şemayı bununla seçer.'],
          [<code key="2">UETR = 3f6b…9b34</code>, 'Bu ödemenin ömür boyu kimliği. pacs.002, camt.056 ve pacs.004 bunu aynen taşır.'],
          [<code key="3">InstrId 004217, TxId 263051200418</code>, 'Simülatördeki STAN ve RRN biçimine benzetilmiş: ilki iki komşu arasındaki talimat no, ikincisi bankalar arası işlem no.'],
          [<code key="4">EndToEndId = KIRA-2026-11</code>, 'Müşterinin verdiği referans. Alıcının ekstresinde de aynen görünür.'],
          [<code key="5">IntrBkSttlmAmt Ccy=“TRY” 1250.00</code>, 'Tutar ve para birimi birlikte; ücret yok: ücret müşteri ile bankası arasındadır, ChrgBr = SLEV şema kuralını işaret eder.'],
          [<code key="6">Purp RENT</code>, 'Ödeme amacı kira. Uyum ve raporlama bu koda bakar.'],
          [<code key="7">TxSts ACSC</code>, 'Uzlaşma tamamlandı. Simülatördeki alan 39 = 00’ın karşılığıdır.'],
          [<code key="8">TxSts RJCT + AC04</code>, 'Reddedildi, neden: kapalı hesap. Gönderen banka bunu görünce borçlandırdığı tutarı müşteriye iade etmek zorundadır.'],
        ]}
      />

      <h2 id="yasam">Ödeme yaşam döngüsü</h2>
      <p>
        Başarılı bir müşteri ödemesi şu mesaj zincirini izler. Her bankada ya da sistemde bu mesajların hepsi görünmeyebilir (örneğin pain.002 isteğe bağlıdır),
        ama sıra aynıdır.
      </p>
      <Sequence
        label="Müşteri talimatından ekstreye: pain.001 → pacs.008 → pacs.002 → camt.054 / camt.053"
        actors={[ACT.musteri, ACT.a, ACT.sis, ACT.b]}
        steps={[
          { sep: 'Talimat' },
          { from: 'musteri', to: 'a', label: 'pain.001', sub: 'ödeme talimatı', tone: 'ok' },
          { from: 'a', to: 'musteri', label: 'pain.002 · ACTC', sub: 'teknik olarak kabul', res: true, tone: 'ok' },
          { note: 'Gönderen banka: hesap, bakiye,\nlimit, uyum taraması, borç kaydı', at: 'a' },
          { sep: 'Bankalar arası' },
          { from: 'a', to: 'sis', label: 'pacs.008', sub: 'UETR · tutar · hesaplar', tone: 'ok' },
          { from: 'sis', to: 'b', label: 'pacs.008', tone: 'ok' },
          { note: 'Alıcı banka: IBAN, hesap durumu,\nad uyumu; alacak kaydı', at: 'b' },
          { from: 'b', to: 'sis', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
          { from: 'sis', to: 'a', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
          { sep: 'Bildirim ve ekstre' },
          { from: 'a', to: 'musteri', label: 'camt.054', sub: 'borç bildirimi', res: true, tone: 'ok' },
          { note: 'Alıcıya camt.054 alacak bildirimi gider', at: 'b' },
          { from: 'a', to: 'musteri', label: 'camt.053', sub: 'gün sonu ekstre', res: true },
        ]}
      />
      <h3>Alıcı banka pacs.008’i alınca</h3>
      <Flow
        items={[
          { title: 'Şema ve zarf doğrulaması', tag: 'XSD · head.001', text: 'Mesaj biçimsel olarak geçerli mi, MsgDefIdr tanınan bir sürüm mü? Değilse mesaj işlenmeden reddedilir.' },
          { title: 'Tekrar kontrolü', tag: 'UETR · TxId', text: 'Bu UETR daha önce işlendi mi? İşlendiyse yeni alacak yazılmaz; önceki sonuç yeniden bildirilir (idempotentlik).' },
          { decision: true, title: 'Alıcı hesap bulundu ve alacak kabul ediyor mu?', branches: [{ label: 'Evet', text: 'Alacak yazılır, pacs.002 ACSC (ya da ACCC) döner.', tone: 'ok' }, { label: 'Hayır', text: 'pacs.002 RJCT ve neden kodu (AC01, AC04, AC06…) döner; para alıcıya geçmez.', tone: 'bad' }] },
          { title: 'Uyum / ad kontrolü', tag: 'Dbtr · Cdtr · Purp', text: 'Yaptırım taraması ve (şema istiyorsa) alıcı adı doğrulaması. Takılırsa PDNG ile beklemeye alınabilir.' },
          { title: 'Gönderen banka sonucu işler', tag: 'pacs.002', text: 'ACSC ise müşteriye bildirim; RJCT ise borç kaydı geri alınır (telafi) ve müşteri bilgilendirilir.' },
        ]}
      />
      <Table
        head={['Mesaj', 'Ne zaman', 'Kimden kime']}
        rows={[
          [<b key="1">pain.001 / pain.002</b>, 'Talimatın verilmesi ve durumu', 'Müşteri ↔ gönderen banka'],
          [<b key="2">pacs.008 / pacs.002</b>, 'Bankalar arası ödeme ve sonucu', 'Banka ↔ sistem ↔ banka'],
          [<b key="3">camt.054 / camt.053</b>, 'Hareket bildirimi ve gün sonu ekstre', 'Banka → müşteri'],
          [<b key="4">camt.056 → camt.029 → pacs.004</b>, 'Geri çağırma: talep, yanıt, iade', 'Gönderen banka ↔ alıcı banka'],
        ]}
      />

      <h2 id="turkiye">Türkiye bağlamı</h2>
      <p>Emin olduklarım ve doğrulamanız gerekenler ayrı tutuldu:</p>
      <Table
        head={['Konu', 'Bilgi', 'Güven']}
        rows={[
          ['FAST', 'TCMB tarafından işletilen, 7/24 çalışan anlık ödeme sistemi', 'Kesin'],
          ['EFT', 'TCMB tarafından işletilen elektronik fon transferi sistemi', 'Kesin'],
          ['SWIFT', 'Sınır ötesi ödemelerde bankalar CBPR+ kapsamında ISO 20022’ye geçti', 'Genel olarak kesin, kapsam ve istisnalar için doğrulayın'],
          ['IBAN', '26 hane; 5 haneli banka kodu içerir (simülatördeki Demo Bank = 00061)', 'Kesin'],
          ['FAST / EFT mesaj biçimi ve sürümü', 'Sistemlerin kullandığı ISO 20022 alt kümesi ve sürümleri', 'Doğrulayın: TCMB şartnamelerine bakın'],
          ['EFT çalışma saatleri', 'Geçmişte hafta içi mesai saatleriyle sınırlıydı; güncel kuralı değişmiş olabilir', 'Doğrulayın. Simülatör hafta içi 09:00–17:00 modelliyor (demo kuralı)'],
          ['FAST tutar limiti', 'Limit zaman içinde değişti', 'Doğrulayın. Simülatörde FAST limiti 50.000 TL, üstü EFT (demo değeri)'],
        ]}
      />

      <h2 id="senaryolar">Örnek senaryolar</h2>
      <p>
        Senaryolar iki bölüme ayrılır: bazıları simülatörde birebir izlenir, bazıları (geri çağırma, sınır ötesi) kavramsaldır; simülatörde karşılığı yoktur
        ve her senaryo bunu söyler. Diyagramlarda ISO 8583 mesajları (<code>0200</code>, <code>0210</code>) ile ISO 20022 mesajlarının hangi halkada
        birbirine dönüştüğüne bakın.
      </p>
      <Tabs
        label="ISO 20022 senaryoları"
        tabs={[
          {
            label: '1 · ATM nerede? FAST transfer',
            content: (
              <>
                <Sequence
                  label="Demo Bank ATM’sinden Atlas Bank hesabına 1.250 TL FAST transferi"
                  actors={[ACT.atm, ACT.host, ACT.fast, ACT.alici]}
                  steps={[
                    { sep: 'ATM tarafı: ISO 8583' },
                    { from: 'atm', to: 'host', label: '0200 · 1.250,00 TRY', sub: 'alan 3=400000 · 103=IBAN', tone: 'ok' },
                    { note: 'Bakiye, FAST limiti, risk skoru\nHesap borçlanır: 1.250 + 5 ücret', at: 'host' },
                    { sep: 'Bankalar arası: ISO 20022' },
                    { from: 'host', to: 'fast', label: 'pacs.008', sub: 'UETR · TRY 1250.00', tone: 'ok' },
                    { from: 'fast', to: 'alici', label: 'pacs.008', tone: 'ok' },
                    { note: 'IBAN doğrulanır,\nalacak yazılır', at: 'alici' },
                    { from: 'alici', to: 'fast', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
                    { from: 'fast', to: 'host', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
                    { sep: 'ATM tarafı: ISO 8583' },
                    { from: 'host', to: 'atm', label: '0210 · 39 = 00', res: true, tone: 'ok' },
                    { note: 'Fiş: “Transfer gerçekleşti”', at: 'atm' },
                  ]}
                />
                <Notes
                  items={[
                    <>ATM’nin gönderdiği <b>0200</b> kartlı işlem mesajıdır: <b>alan 3 = 400000</b> (transfer), <b>alan 103</b> alıcı IBAN’ı, <b>alan 28</b> FAST ücreti (D00000500).</>,
                    <>Banka host’u önce kendi tarafında kararı verir: bakiye (tutar + ücret), FAST limiti, risk skoru. Simülatörde sıra: risk skoru, hesaptan borç, FAST hattı.</>,
                    <>Hostun bankalar arası yola çıkardığı mesaj <b>pacs.008</b>’dir. Kart, terminal ve PIN bilgisi burada yoktur; yalnızca hesaplar, tutar ve kimlikler vardır.</>,
                    <>Alıcı banka <b>pacs.002</b> ile sonucu bildirir. Host bu sonucu görünce ATM’ye <b>0210</b> döner.</>,
                    <>Alıcı hesaba alacak <b>anında</b> yazılır (FAST). Aynı bankanın iki hesabı arasındaki <b>havale</b> ise core banking içinde virmandır; bankalar arası mesaj hiç çıkmaz.</>,
                  ]}
                />
                <Callout tone="warn" title="Simülatör bunu nasıl basitleştiriyor?">
                  Simülatör <b>pacs.008 / pacs.002 XML’i üretmez</b>. Olay günlüğünde yalnızca ISO 8583 alanları (<code>0200</code>, alan 3 = 400000, alan 103) görünür; host halkasının
                  açıklamasında ise “FAST · ISO 20022 pacs.008” yazısı vardır. Sayfadaki XML kurgusal bir örnektir. Ayrıca simülatörde pacs.002’yi alıcı
                  bankadan beklemez: alıcı hesaba alacak istemci tarafında yazılır.
                </Callout>
                <TryInSim>
                  Cüzdandan Ayşe Yılmaz’ın Visa kartını (PIN 1234) takın, Para Transferi’ni seçin, alıcı olarak Elif Demir’in IBAN’ını seçin ya da girin (Atlas Bank),
                  1.250 TL gönderin. Onay ekranında “FAST” ve 5 TL ücreti görün. Olay günlüğünde 0200’ün alan 3 ve 103’üne, yolu gösteren host satırlarında “FAST · ISO 20022 pacs.008” açıklamasına
                  bakın. Sonra Takas &amp; Mutabakat sekmesinde takas oturumunu çalıştırıp FAST satırını ve banka pozisyonlarını inceleyin.
                </TryInSim>
              </>
            ),
          },
          {
            label: '2 · Red: bakiye ve hesap',
            content: (
              <>
                <Sequence
                  label="Gönderen bankada red ve alıcı bankada red"
                  actors={[ACT.atm, ACT.host, ACT.fast, ACT.alici]}
                  steps={[
                    { sep: 'A · Bakiye yetersiz (gönderen bankada)' },
                    { from: 'atm', to: 'host', label: '0200 · 2.000 TRY', tone: 'ok' },
                    { from: 'host', to: 'atm', label: '0210 · 39 = 51', res: true, tone: 'bad' },
                    { note: 'pacs.008 hiç üretilmez,\nhesapta hareket olmaz', at: 'host', tone: 'bad' },
                    { sep: 'B · Alıcı banka reddeder (kavramsal)' },
                    { from: 'atm', to: 'host', label: '0200 · 500 TRY', tone: 'ok' },
                    { note: 'Hesap borçlandı', at: 'host' },
                    { from: 'host', to: 'fast', label: 'pacs.008', tone: 'ok' },
                    { from: 'fast', to: 'alici', label: 'pacs.008', tone: 'ok' },
                    { from: 'alici', to: 'fast', label: 'pacs.002 · RJCT', sub: 'neden AC04: kapalı hesap', res: true, tone: 'bad' },
                    { from: 'fast', to: 'host', label: 'pacs.002 · RJCT', res: true, tone: 'bad' },
                    { note: 'Telafi: borç geri alınır', at: 'host', tone: 'warn' },
                    { from: 'host', to: 'atm', label: '0210 · 39 ≠ 00', res: true, tone: 'bad' },
                  ]}
                />
                <Notes
                  items={[
                    <>Yetersiz bakiye <b>gönderen bankanın kendi kararıdır</b>; ağa çıkmadan verilir. ISO 20022 dünyasında bu, müşteriye <b>pain.002</b> RJCT ile bildirilir.</>,
                    <>Alıcı bankanın reddi ancak mesaj gittikten sonra bilinir. <b>pacs.002 RJCT</b> geldiğinde para zaten borçlanmış olabilir; gönderen banka borcu geri almak zorundadır. Bu bir <b>telafi (compensation)</b> adımıdır (ACID sayfasında saga).</>,
                    <>Neden kodları standarttır, serbest metin değildir: <b>AC01</b> hesap numarası hatalı, <b>AC04</b> kapalı hesap, <b>AC06</b> bloke hesap, <b>AM04</b> yetersiz bakiye.</>,
                    <>Simülatörde alıcı hesap sorgusu <b>transferden önce</b> yapılır: geçersiz IBAN ve bulunamayan alıcı için host 14, yetersiz bakiye için 51 döner. B şıkkı bu yüzden simülatörde tetiklenemez.</>,
                  ]}
                />
                <TryInSim>
                  Mehmet Kaya’nın Troy kartıyla (PIN 4321, bakiye 850 TL) 2.000 TL transfer girin: 51. Sonra bir IBAN girip son hanelerini değiştirin: kontrol basamakları
                  tutmadığı için 14 (“IBAN geçersiz”) alırsınız. İki durumda da hesapta hareket olmadığını bakiyeden doğrulayın.
                </TryInSim>
              </>
            ),
          },
          {
            label: '3 · EFT kuyruğu (mesai dışı)',
            content: (
              <>
                <Sequence
                  label="Mesai dışı EFT: borç hemen, bankalar arası gönderim sonra"
                  actors={[ACT.host, ACT.fast, ACT.alici]}
                  steps={[
                    { sep: 'Talimat anı (mesai dışı)' },
                    { note: 'Hesaptan borç + talimat\nkuyruğa alınır (“ilk iş günü”)', at: 'host', tone: 'warn' },
                    { sep: 'Sonraki oturum' },
                    { from: 'host', to: 'fast', label: 'pacs.008 · kuyruktan', sub: 'aynı UETR', tone: 'ok' },
                    { from: 'fast', to: 'alici', label: 'pacs.008', tone: 'ok' },
                    { note: 'Alacak şimdi yazılır', at: 'alici', tone: 'ok' },
                    { from: 'alici', to: 'fast', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
                    { from: 'fast', to: 'host', label: 'pacs.002 · ACSC', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Müşteri açısından para <b>hemen çıkmış</b>, ama alıcıya henüz ulaşmamıştır. İki hesap bir süre tutarsızdır: bu bir <b>nihai tutarlılık</b> örneğidir.</>,
                    <>Talimat kuyruktayken mesajın kimliği değişmez; gönderim sırasında aynı UETR kullanılır.</>,
                    <>Simülatörde 50.000 TL üstü transfer EFT’dir. Mesai dışında (hafta sonu ve 09:00–17:00 dışı) talimat kuyruğa alınır, alıcıya alacak yazılmaz.
                    Takas oturumu çalıştığında EFT gönderilir ve alıcı hesaba alacak yazılır.</>,
                    <>Gerçek EFT çalışma saatleri zaman içinde değişmiş olabilir; simülatörün hafta içi 09:00–17:00 kuralı bir demo varsayımıdır (doğrulayın).</>,
                  ]}
                />
                <Callout tone="warn" title="Bu senaryo simülatörde tetiklenemez">
                  Demo hesapların bakiyeleri 50.000 TL’nin çok altındadır; bu yüzden büyük tutar girildiğinde host transferi 51 ile reddeder ve EFT yoluna hiç
                  girilmez. EFT akışı yalnızca kodda (<code>api/_host.py</code>, <code>transfer</code> ve <code>clearing</code> işlevleri) izlenebilir.
                </Callout>
              </>
            ),
          },
          {
            label: '4 · Geri çağırma ve iade',
            content: (
              <>
                <Sequence
                  label="Yanlış IBAN’a giden ödemenin geri çağrılması: camt.056, camt.029, pacs.004"
                  actors={[ACT.musteri, ACT.a, ACT.b]}
                  steps={[
                    { from: 'a', to: 'b', label: 'pacs.008 · yanlış IBAN', sub: 'ACSC döndü: para alıcıda', tone: 'warn' },
                    { sep: 'Müşteri hatayı fark eder' },
                    { from: 'musteri', to: 'a', label: 'Geri çağırma talebi', tone: 'warn' },
                    { from: 'a', to: 'b', label: 'camt.056', sub: 'neden: CUST, DUPL, FRAD, TECH', tone: 'warn' },
                    { note: 'Alıcı banka alıcıyı\nbilgilendirir, onayını arar', at: 'b' },
                    { from: 'b', to: 'a', label: 'camt.029', sub: 'iptal kabul / red', res: true, tone: 'ok' },
                    { from: 'b', to: 'a', label: 'pacs.004', sub: 'iade (Return), aynı UETR', tone: 'ok' },
                    { from: 'a', to: 'musteri', label: 'camt.054', sub: 'alacak bildirimi', res: true, tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Başarıyla tamamlanmış (ACSC) bir ödeme <b>geri alınamaz</b>; yalnızca geri çağrılması istenebilir. İptal bir istektir, emir değildir.</>,
                    <><b>camt.056</b> asıl ödemeyi UETR ve asıl mesaj kimlikleriyle gösterir (ISO 8583’teki alan 90’ın işlevi). İptal nedeni kodludur: <b>DUPL</b> mükerrer, <b>FRAD</b> sahte, <b>TECH</b> teknik hata, <b>CUST</b> müşteri talebi.</>,
                    <>Alıcı hesapta para yoksa ya da hesap sahibi iade etmek istemezse <b>camt.029</b> ile red gelir. Kabulde para <b>pacs.004</b> ile geri döner; bu, ayrı bir yeni ödeme değil iade ödemesidir ve aynı UETR’yi taşır.</>,
                    <>Simülatörde bu akışın karşılığı yoktur. En yakını ATM’nin 0400/0420 iptalidir, ama o <b>para çekme</b> içindir ve banka kendi içinde (alıcı onayı gerekmeden) geri alır. Simülatörde transferler iptal edilemez.</>,
                  ]}
                />
              </>
            ),
          },
          {
            label: '5 · Sınır ötesi (CBPR+)',
            content: (
              <>
                <Sequence
                  label="Muhabir bankalı SWIFT ödemesi: seri yöntem ve cover yöntemi"
                  actors={[ACT.a, { id: 'm', label: 'Muhabir Banka', sub: 'Intermediary' }, ACT.b]}
                  steps={[
                    { sep: 'Seri yöntem' },
                    { from: 'a', to: 'm', label: 'pacs.008', sub: 'UETR üretilir', tone: 'ok' },
                    { from: 'm', to: 'b', label: 'pacs.008', sub: 'aynı UETR', tone: 'ok' },
                    { from: 'b', to: 'a', label: 'pacs.002 · ACCC', sub: 'gpi takibi için durum', res: true, tone: 'ok' },
                    { sep: 'Cover yöntemi' },
                    { from: 'a', to: 'b', label: 'pacs.008', sub: 'doğrudan, bilgi amaçlı', tone: 'ok' },
                    { from: 'a', to: 'm', label: 'pacs.009 COV', sub: 'asıl para hareketi', tone: 'ok' },
                  ]}
                />
                <Notes
                  items={[
                    <>Sınır ötesinde gönderen ve alıcı bankanın karşılıklı hesabı olmayabilir; araya <b>muhabir bankalar</b> girer ve her biri mesajı bir sonrakine iletir.</>,
                    <><b>UETR</b> zincirin her halkasında aynı kalır. Bu sayede ödemenin hangi bankada olduğu izlenebilir, iptal ve iade mesajları ödemeyle eşleşir.</>,
                    <><b>Cover</b> yönteminde müşteri bilgisini taşıyan pacs.008 alıcı bankaya doğrudan gider, parayı taşıyan <b>pacs.009 COV</b> ise muhabir zincirinden geçer.</>,
                    <>Bu senaryo kavramsaldır. Simülatörde sınır ötesi transfer yoktur; yalnızca TRY ve yurt içi IBAN’lar vardır. Ayrıntılar (kullanılan sürümler, zorunlu alanlar) için CBPR+ kullanım kılavuzlarını doğrulayın.</>,
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <h2 id="pratik">Gerçek hayat notları</h2>
      <ul>
        <li>
          <b>Çeviri kayıpları:</b> MX → MT çevirisinde zengin veri kısalır. MX’te adres yapılandırılmış, MT’de serbest satırdır; iki dünya bir arada yaşadığı
          sürece hangi uçta hangi biçim olduğunu bilmek gerekir.
        </li>
        <li>
          <b>İdempotentlik:</b> UETR ve EndToEndId, aynı ödemenin iki kez işlenmesini engellemek için kullanılır. Alıcı taraf aynı UETR’yi ikinci kez görürse yeni
          alacak yazmaz.
        </li>
        <li>
          <b>Tutar biçimi:</b> ISO 20022’de ondalık sayıdır (1250.00), ama bunu yazılımda kayan noktalı sayıya çevirmeyin. ISO 8583 alan 4’teki gibi minör birimle
          (kuruş) tamsayı hesaplayın.
        </li>
        <li>
          <b>Karakter kümesi:</b> Ağ, izin verilen karakterleri sınırlayabilir (Türkçe karakterler için doğrulayın). Ad ve adres alanlarında dönüşüm kuralı belirleyin.
        </li>
        <li>
          <b>Şema doğrulaması:</b> Bir XML şemaya uyuyor diye iş kuralına da uyuyor demek değildir. Şema yapıyı, kullanım kılavuzu ise zorunlulukları ve değer kümelerini sınırlar.
        </li>
      </ul>

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['ISO 20022', 'Finansal mesajlar için XML tabanlı, veri zengini bir katalog ve metodoloji'],
          ['Mesaj adı', 'alan.numara.varyant.sürüm: pacs.008.001.08 = bankalar arası müşteri havalesi'],
          ['BAH + Document', 'Zarf (kimden, kime, ne) ve içindeki iş verisi'],
          ['UETR', 'Ödemeyi baştan sona izleyen 36 karakterlik kimlik; iptal ve iade bunu taşır'],
          ['EndToEndId', 'Müşterinin verdiği, alıcıya kadar değişmeyen referans'],
          ['pacs.008 / pacs.002', 'Bankalar arası ödeme ve sonucu (TxSts + neden kodu)'],
          ['camt.056 → camt.029 → pacs.004', 'Geri çağırma talebi, yanıtı ve iade ödemesi'],
          ['camt.054 / camt.053', 'Hareket bildirimi ve gün sonu ekstre'],
          ['Alan 39 → TxSts', 'İki haneli yanıt kodu yerine durum ve neden kodu'],
          ['ATM ile ilişkisi', 'ATM ISO 8583 / NDC konuşur; ISO 20022 bankanın arkasında, ödeme sistemine çıkan tarafta görünür'],
        ]}
      />
      <p className="tr-next">
        Sıradaki konu: <a href="#/egitim/acid">ACID: transfer ve para çekmede tutarlılık nasıl korunur →</a>
      </p>
    </>
  )
}
