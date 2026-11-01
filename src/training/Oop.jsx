import { useState } from 'react'
import { Callout, ClassDiagram, Code, Flow, PageHead, Table, Tabs, TryInSim } from './parts.jsx'

// ---------------------------------------------------------------- etkileşimli: polimorfizm ile ücret hesabı
// Değerler simülatörün demo ücretleridir (api/_host.py: OFF_US_FEES, TRANSFER_FEES).
const OPS = {
  withdraw: { label: 'Para çekme', policy: { on: ['OnUsFee', 0], off: ['OffUsWithdrawFee', 25] } },
  balance: { label: 'Bakiye sorgu', policy: { on: ['OnUsFee', 0], off: ['OffUsBalanceFee', 3] } },
  havale: { label: 'Havale', policy: { on: ['HavaleFee', 0], off: ['HavaleFee', 0] } },
  fast: { label: 'FAST', policy: { on: ['FastFee', 5], off: ['FastFee', 5] } },
  eft: { label: 'EFT', policy: { on: ['EftFee', 15], off: ['EftFee', 15] } },
}

function PolymorphismLab() {
  const [op, setOp] = useState('withdraw')
  const [onUs, setOnUs] = useState(false)
  const [name, fee] = OPS[op].policy[onUs ? 'on' : 'off']
  return (
    <div className="tr-lab">
      <div className="tr-lab-cols">
        <fieldset className="tr-fieldset">
          <legend>İşlem (çağıran kod bunu bilmez)</legend>
          {Object.entries(OPS).map(([k, o]) => (
            <label key={k} className="tr-check">
              <input type="radio" name="oop-op" checked={op === k} onChange={() => setOp(k)} />
              {o.label}
            </label>
          ))}
        </fieldset>
        <fieldset className="tr-fieldset">
          <legend>Terminal</legend>
          <label className="tr-check">
            <input type="radio" name="oop-term" checked={onUs} onChange={() => setOnUs(true)} />
            Kendi bankamın ATM’si (on-us)
          </label>
          <label className="tr-check">
            <input type="radio" name="oop-term" checked={!onUs} onChange={() => setOnUs(false)} />
            Başka bankanın ATM’si (not-on-us)
          </label>
        </fieldset>
      </div>
      <Code title="Çağıran kod her durumda aynı satırdır">{`FeePolicy policy = feeRegistry.forTransaction(txn);   // hangi sınıf?
Money fee = policy.fee(txn, terminal);                // her sınıf kendi kuralını uygular`}</Code>
      <div className={`tr-verdict ${fee ? 'warn' : 'ok'}`} role="status">
        <span>Seçilen sınıf</span>
        <b>
          {name} → {fee.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
        </b>
      </div>
      <p className="tr-muted">Ücretler simülatörün demo değerleridir, gerçek tarifeleri yansıtmaz.</p>
    </div>
  )
}

export default function Oop() {
  return (
    <>
      <PageHead
        eyebrow="Eğitim · Yazılım ve veri"
        title="Nesne yönelimli programlama (OOP)"
        lead="Bir ATM yazılımında kart okuyucu, PIN tuş takımı, nakit dağıtıcı, onlarca işlem türü ve yüzlerce ücret kuralı birlikte yaşar. OOP bu karmaşıklığı, veriyi ve onu işleyen davranışı aynı yerde tutan nesnelerle yönetilebilir kılar."
      />

      <h2 id="giris">OOP nedir, neden bankacılık yazılımında işe yarar?</h2>
      <p>
        Nesne yönelimli programlama, yazılımı <b>nesneler</b> etrafında kurar: her nesne kendi <b>durumunu</b> (alanlar) ve o durumu değiştiren <b>davranışını</b>
        (metotlar) taşır. Prosedürel yaklaşımda veri ve fonksiyonlar ayrıdır; herkes herkesin verisine dokunabilir. OOP’de veri sahibine bağlıdır ve ona yalnızca sahibinin
        izin verdiği yoldan ulaşılır.
      </p>
      <Table
        head={['ATM yazılımının gerçeği', 'OOP’nin cevabı']}
        rows={[
          ['Farklı üreticilerin farklı cihazları (kart okuyucu, dağıtıcı, yazıcı)', 'Ortak bir arayüz arkasında değiştirilebilir sınıflar (soyutlama + çok biçimlilik)'],
          ['Onlarca işlem türü: çekim, yatırma, transfer, fatura, QR…', 'Ortak bir iskelet, her tür kendi adımlarını doldurur (kalıtım, şablon metot)'],
          ['Kuralların sürekli değişmesi: ücret, limit, kampanya', 'Kural başına bir sınıf, çağıran kodu değiştirmeden yenisini ekleme (açık/kapalı ilkesi)'],
          ['Para ve bakiye gibi bozulmaması gereken veriler', 'İç durumu koruyan sınıflar (kapsülleme)'],
          ['Yıllarca yaşayan, onlarca kişinin dokunduğu kod', 'Küçük, tek sorumluluklu, test edilebilir sınıflar']
        ]}
      />
      <Callout title="Bu sayfa nasıl okunur?">
        Örnekler Java söz diziminde yazıldı çünkü ATM ve switch yazılımlarında Java, C# ve C++ yaygındır; kavramlar hepsinde aynıdır. Python (simülatörün host’u) ve
        JavaScript (arayüzü) da nesne yönelimini destekler, ama bu projede ağırlıklı olarak fonksiyonel yazılmıştır; ayrıntısı “Simülatörde OOP” bölümünde.
      </Callout>

      <h2 id="temel">Sınıf ve nesne</h2>
      <p>
        <b>Sınıf</b> bir şablondur, <b>nesne</b> o şablondan üretilmiş somut bir örnektir. “Hesap” sınıfından Ayşe’nin ve Mehmet’in hesapları iki ayrı nesne olarak doğar; her birinin kendi bakiyesi vardır.
      </p>
      <Code title="Account.java">{`public class Account {
    private final String iban;
    private long balanceKurus;                 // para: kayan noktalı değil, tamsayı (kuruş)
    private long dailyWithdrawnKurus;

    public Account(String iban, long openingKurus) {
        this.iban = iban;
        this.balanceKurus = openingKurus;
    }

    public long balance() { return balanceKurus; }
}

Account ayse = new Account("TR33...", 12_500_00);
Account mehmet = new Account("TR12...", 850_00);`}</Code>
      <p>
        <b>Yapıcı (constructor)</b> nesneyi geçerli bir durumla doğurur: IBAN’ı olmayan ya da bakiyesi negatif bir hesap hiç oluşturulamaz. Bu, hataları üretildiği yerde yakalamanın ilk adımıdır.
      </p>

      <h2 id="sutunlar">Dört temel kavram</h2>
      <Tabs
        label="OOP’nin dört sütunu"
        tabs={[
          {
            label: 'Kapsülleme',
            content: (
              <>
                <p>
                  Nesnenin iç durumu dışarıdan doğrudan değiştirilemez; yalnızca kurallarını uygulayan metotlar üzerinden değişir. Böylece bakiye eksiye düşemez, limit aşılamaz.
                </p>
                <Code title="Kötü: herkes bakiyeyi değiştirebilir">{`account.balance = account.balance - 500;   // limit, yetersiz bakiye, günlük toplam: hiçbiri kontrol edilmedi`}</Code>
                <Code title="İyi: kural nesnenin içinde">{`public void withdraw(long kurus, long dailyLimitKurus) {
    if (kurus <= 0) throw new InvalidAmountException();
    if (kurus > balanceKurus) throw new InsufficientFundsException();                      // yanıt kodu 51
    if (dailyWithdrawnKurus + kurus > dailyLimitKurus) throw new DailyLimitExceededException(); // 61
    balanceKurus -= kurus;
    dailyWithdrawnKurus += kurus;
}`}</Code>
                <p>
                  <b>ATM’de nerede?</b> PIN deneme sayacı, kaset adetleri, günlük çekim toplamı: hepsi dışarıdan serbestçe artırılıp azaltılamayacak, kuralları olan değerlerdir. Simülatör host’unda bu kurallar{' '}
                  <code>_withdraw_check</code> fonksiyonunda toplanır.
                </p>
              </>
            ),
          },
          {
            label: 'Soyutlama',
            content: (
              <>
                <p>
                  Karmaşık bir şeyin <b>ne yaptığını</b> söyleyip <b>nasıl yaptığını</b> gizlemek. Çağıran kod yalnızca arayüze bağlıdır; arkada hangi üreticinin donanımı olduğu önemli değildir.
                </p>
                <Code title="CashDispenser.java">{`public interface CashDispenser {
    DispensePlan denominate(long kurus);                 // hangi kupürden kaç adet?
    DispenseResult dispense(DispensePlan plan);          // banknotları çek ve sun
    void retract();                                       // müşteri almadı: geri çek
    DeviceStatus status();
}

// Tek bir üreticiye özgü ayrıntı bu sınıfın içinde kalır
public class VendorXCashDispenser implements CashDispenser { /* XFS WFS_CMD_CDM_* çağrıları */ }`}</Code>
                <p>
                  <b>ATM’de nerede?</b> XFS’in kendisi bir soyutlamadır: uygulama “CDM” der, donanımın NCR mı Diebold mu olduğunu bilmez. Simülatörde kasetlerden banknot seçen{' '}
                  <code>plan_dispense</code> fonksiyonu <code>denominate</code> işlevinin karşılığıdır.
                </p>
              </>
            ),
          },
          {
            label: 'Kalıtım',
            content: (
              <>
                <p>
                  Bir sınıfın başka bir sınıfın özelliklerini ve davranışını devralması (“<i>-dir</i> ilişkisi”). Ortak kısım üst sınıfta bir kez yazılır, farklılıklar alt sınıfta.
                </p>
                <Code title="Transaction.java">{`public abstract class Transaction {
    protected final Terminal terminal;
    protected final Card card;

    protected Transaction(Terminal terminal, Card card) { this.terminal = terminal; this.card = card; }

    public abstract String processingCode();      // 01xx00 çekim, 31xx00 bakiye, 21xx00 yatırma...
    public abstract Result execute(HostGateway host);
}

public class Withdrawal extends Transaction {
    private final long kurus;
    public Withdrawal(Terminal t, Card c, long kurus) { super(t, c); this.kurus = kurus; }
    @Override public String processingCode() { return "01" + card.accountType() + "00"; }
    @Override public Result execute(HostGateway host) { /* 0200 gönder, banknotları dağıt */ return null; }
}`}</Code>
                <Callout tone="warn" title="Kalıtımı dikkatli kullanın">
                  Derin kalıtım zinciri (5–6 seviye) kırılgandır: üst sınıfı değiştirmek tüm alt sınıfları bozabilir (<i>fragile base class</i>). Kalıtım yalnızca gerçek bir “-dir” ilişkisi varsa ve üst sınıf kararlıysa kullanılır. Aksi halde <b>kompozisyonu</b> tercih edin (aşağıda).
                </Callout>
              </>
            ),
          },
          {
            label: 'Çok biçimlilik',
            content: (
              <>
                <p>
                  Aynı çağrının, nesnenin gerçek türüne göre farklı davranması. Çağıran kod <i>ne olduğunu</i> bilmeden <i>ne yapacağını</i> söyler.
                </p>
                <Code title="Çağıran kod tür sormaz">{`for (Transaction txn : queue) {
    Result r = txn.execute(host);        // Withdrawal, Deposit, Transfer... hangisi olursa
    journal.record(txn, r);
}

// Kötü alternatif: her yeni işlem türünde buraya bir else-if daha eklenir
// if (txn instanceof Withdrawal) {...} else if (txn instanceof Deposit) {...} else if ...`}</Code>
                <p>
                  Aşağıdaki laboratuvar bunu ücret hesabıyla gösterir: çağıran satır hep aynıdır, işlem ve terminal değişince farklı bir sınıf devreye girer.
                </p>
                <PolymorphismLab />
              </>
            ),
          },
        ]}
      />
      <Table
        head={['Kavram', 'Kısaca', 'Ne işe yarar?', 'Bozulursa ne olur?']}
        rows={[
          [<b key="1">Kapsülleme</b>, 'Durum gizli, kural nesnede', 'Bozulmaz veri, tek yerde kural', 'Bakiyeyi herkes değiştirir, kural çiğnenir'],
          [<b key="2">Soyutlama</b>, 'Ne yaptığı görünür, nasıl yaptığı gizli', 'Cihaz/üretici bağımsızlığı', 'Uygulama tek bir üreticiye kilitlenir'],
          [<b key="3">Kalıtım</b>, 'Ortak kısım üst sınıfta', 'Tekrarı azaltır', 'Kırılgan hiyerarşi, beklenmedik yan etki'],
          [<b key="4">Çok biçimlilik</b>, 'Aynı çağrı, farklı davranış', 'Yeni tür eklerken eski kodu değiştirmemek', 'if/else yığınları, her değişiklikte regresyon'],
        ]}
      />

      <h2 id="diyagram">Sınıf diyagramları</h2>
      <p>
        UML sınıf diyagramı sınıfları (ad · alanlar · metotlar) ve aralarındaki ilişkileri gösterir. Boş üçgenli ok “<b>miras alır</b>”, kesikli boş üçgenli ok “<b>arayüzü uygular</b>”,
        içi dolu elmas “<b>parçasıdır</b> (kompozisyon)”, kesikli açık ok “<b>kullanır</b>” demektir.
      </p>
      <ClassDiagram
        label="Cihaz katmanı: arayüz ve üretici uygulamaları"
        width={760}
        height={350}
        classes={[
          { id: 'dev', x: 270, y: 8, w: 220, name: 'Device', stereo: 'interface', methods: ['status(): DeviceStatus', 'open(): void', 'close(): void'] },
          { id: 'cd', x: 20, y: 150, w: 210, name: 'CashDispenser', stereo: 'interface', methods: ['denominate(kurus): Plan', 'dispense(plan): Result', 'retract(): void'] },
          { id: 'cr', x: 275, y: 150, w: 210, name: 'CardReader', stereo: 'interface', methods: ['read(): CardData', 'eject(): void', 'retain(): void'] },
          { id: 'pp', x: 530, y: 150, w: 210, name: 'PinPad', stereo: 'interface', methods: ['getPinBlock(pan): byte[]', 'loadKey(key): void'] },
          { id: 'xcd', x: 20, y: 300, w: 210, name: 'XfsCashDispenser', methods: [] },
          { id: 'mcd', x: 275, y: 300, w: 210, name: 'MockCashDispenser', methods: [] },
        ]}
        links={[
          { from: 'cd', to: 'dev', kind: 'extends' },
          { from: 'cr', to: 'dev', kind: 'extends' },
          { from: 'pp', to: 'dev', kind: 'extends' },
          { from: 'xcd', to: 'cd', kind: 'implements' },
          { from: 'mcd', to: 'cd', kind: 'implements' },
        ]}
      />
      <p>
        Gerçek ve sahte (mock) uygulamanın aynı arayüzü paylaştığına dikkat edin: test ortamında donanımsız çalışabilmenin temeli budur.
      </p>
      <ClassDiagram
        label="İşlem katmanı: soyut sınıf, alt sınıflar ve bağımlılıklar"
        width={760}
        height={330}
        classes={[
          { id: 'txn', x: 180, y: 8, w: 260, name: 'Transaction', abstract: true, attrs: ['# terminal: Terminal', '# card: Card'], methods: ['+ processingCode(): String', '+ execute(host): Result'] },
          { id: 'hg', x: 540, y: 28, w: 200, name: 'HostGateway', stereo: 'interface', methods: [] },
          { id: 'wd', x: 10, y: 160, w: 170, name: 'Withdrawal', attrs: ['- kurus: long'], methods: [] },
          { id: 'dp', x: 225, y: 160, w: 170, name: 'Deposit', attrs: ['- notes: Notes'], methods: [] },
          { id: 'tr', x: 440, y: 160, w: 170, name: 'Transfer', attrs: ['- iban: String'], methods: [] },
          { id: 'qr', x: 10, y: 262, w: 190, name: 'QrWithdrawal', attrs: ['- approval: Approval'], methods: [] },
        ]}
        links={[
          { from: 'wd', to: 'txn', kind: 'extends' },
          { from: 'dp', to: 'txn', kind: 'extends' },
          { from: 'tr', to: 'txn', kind: 'extends' },
          { from: 'qr', to: 'wd', kind: 'extends' },
          { from: 'txn', to: 'hg', kind: 'uses', label: 'execute(host)' },
        ]}
      />

      <h2 id="kompozisyon">Kompozisyon ve kalıtım</h2>
      <p>
        <b>Kalıtım</b> “bir şeydir” (Withdrawal bir Transaction’dır), <b>kompozisyon</b> “bir şeyi vardır / kullanır” (ATM’in bir kart okuyucusu vardır) ilişkisidir. Pratikte kural:{' '}
        <b>kalıtım yerine kompozisyonu tercih edin.</b>
      </p>
      <Table
        head={['', 'Kalıtım', 'Kompozisyon']}
        rows={[
          ['İlişki', 'is-a (-dir)', 'has-a / uses (-sı vardır, kullanır)'],
          ['Bağlılık', 'Güçlü: alt sınıf üst sınıfın iç yapısına bağlı', 'Gevşek: yalnızca arayüze bağlı'],
          ['Çalışma zamanında değişim', 'Yok: tür derleme anında sabit', 'Var: başka bir nesne takılabilir'],
          ['Test', 'Üst sınıfla birlikte test edilir', 'Bağımlılık sahtesi (mock) ile tek başına test edilir'],
          ['Ne zaman?', 'Gerçek bir “-dir” ve kararlı üst sınıf', 'Davranışı yeniden kullanmak istediğinizde varsayılan seçim']
        ]}
      />
      <Code title="Kompozisyon: ATM kendi cihazlarına sahiptir, onlardan türemez">{`public class Atm {
    private final CardReader cardReader;
    private final PinPad pinPad;
    private final CashDispenser dispenser;
    private final ReceiptPrinter printer;

    public Atm(CardReader r, PinPad p, CashDispenser d, ReceiptPrinter pr) {   // bağımlılık enjeksiyonu
        this.cardReader = r; this.pinPad = p; this.dispenser = d; this.printer = pr;
    }
}
// Üretimde: new Atm(new XfsCardReader(), new XfsPinPad(), new XfsCashDispenser(), new XfsPrinter())
// Testte:   new Atm(new MockCardReader(), new MockPinPad(), new MockCashDispenser(), new MockPrinter())`}</Code>

      <h2 id="solid">SOLID ilkeleri</h2>
      <p>OOP’yi sürdürülebilir kılan beş tasarım ilkesidir. Her biri bir ATM örneğiyle:</p>
      <Table
        head={['İlke', 'Anlamı', 'Bozulduğunda', 'Düzeltme']}
        rows={[
          [<b key="1">S</b>, 'Tek sorumluluk: bir sınıfın değişmesi için tek bir sebep olmalı', 'ATM sınıfı hem ekranı çizer, hem host ile konuşur, hem donanımı yönetir; ücret kuralı değişince ekran kodu da risk altında', 'Ekran, host ağ geçidi, cihaz yönetimi ve ücret kuralları ayrı sınıflara'],
          [<b key="2">O</b>, 'Açık/kapalı: genişletmeye açık, değiştirmeye kapalı', 'Yeni işlem türü için ana döngüdeki else-if’e dokunmak gerekir', 'Yeni işlem = yeni sınıf; döngü aynı kalır (çok biçimlilik)'],
          [<b key="3">L</b>, 'Liskov: alt sınıf üst sınıfın yerine geçebilmeli', 'MockCashDispenser her zaman “dağıttım” der; gerçeği bozar, hatalar testte yakalanmaz', 'Sahte nesne asıl sözleşmeye uyar: sıkışma, kaset boşluğu da üretebilir'],
          [<b key="4">I</b>, 'Arayüz ayrımı: geniş bir arayüz yerine küçük ve odaklı arayüzler', 'Tek “Device” arayüzü hem dağıtma hem kart okumayı içerir; yazıcı gereksiz metotları uygulamak zorunda', 'CardReader, CashDispenser, ReceiptPrinter ayrı arayüzler'],
          [<b key="5">D</b>, 'Bağımlılığı tersine çevirme: üst katman somut sınıfa değil arayüze bağlansın', 'İş mantığı doğrudan XFS çağrılarına bağlı; donanımsız test imkânsız', 'İş mantığı CashDispenser arayüzüne bağlı; XFS uygulaması dışarıdan verilir']
        ]}
      />

      <h2 id="desenler">ATM ve ödeme yazılımında tasarım desenleri</h2>
      <p>
        Tasarım deseni, sık karşılaşılan bir sorunun denenmiş çözümüne verilen addır. Aşağıdakiler ödeme ve ATM yazılımında en sık görülenlerdir.
      </p>
      <Table
        head={['Desen', 'Sorun', 'ATM/ödeme örneği']}
        rows={[
          [<b key="1">Strategy</b>, 'Aynı iş için değiştirilebilir algoritmalar', 'Ücret hesaplama (on-us/off-us/FAST/EFT), banknot dağıtım planı (en az banknot / kaset dengeleme)'],
          [<b key="2">State</b>, 'Nesne duruma göre farklı davranır', 'ATM ekranı: boşta → PIN → menü → işlem → kart iade; cihaz durumu: hizmette / sıkışma / kağıt yok'],
          [<b key="3">Factory</b>, 'Hangi sınıfın üretileceği çalışma anında belli', 'Gelen ISO 8583 MTI ve işlem kodundan doğru işlem nesnesinin üretilmesi'],
          [<b key="4">Adapter</b>, 'Farklı arayüzü beklenen arayüze uydurmak', 'Üreticiye özgü cihaz SDK’sını XFS/uygulama arayüzüne çeviren sürücü; ISO 8583 ↔ ISO 20022 dönüşümü'],
          [<b key="5">Observer</b>, 'Bir olay birçok ilgiliye iletilir', 'XFS olayları (kart takıldı, banknot alındı) → ekran, günlük, izleme'],
          [<b key="6">Command</b>, 'İşlemi nesne olarak taşımak, geri alınabilir kılmak', 'İptal (0400) asıl işlemin tersi bir komuttur; SAF kuyruğu bekleyen komutlar listesidir'],
          [<b key="7">Template Method</b>, 'Sabit iskelet, değişen adımlar', 'Her işlem: doğrula → yetkilendir → hesaba işle → (para ver) → fiş/günlük'],
          [<b key="8">Decorator</b>, 'Davranışa katman eklemek', 'Günlük sarmalayıcı: PAN maskeleyen, süre ölçen host ağ geçidi']
        ]}
      />
      <h3>Strategy: ücret kuralları</h3>
      <Code title="FeePolicy.java">{`public interface FeePolicy { Money fee(Transaction txn, Terminal terminal); }

public class OnUsFee implements FeePolicy        { public Money fee(Transaction t, Terminal m) { return Money.ZERO; } }
public class OffUsWithdrawFee implements FeePolicy { public Money fee(Transaction t, Terminal m) { return Money.of(25_00); } }
public class FastFee implements FeePolicy         { public Money fee(Transaction t, Terminal m) { return Money.of(5_00); } }

// Yeni bir kampanya = yeni sınıf; Transaction ve ATM kodu değişmez
public class CampaignFee implements FeePolicy { /* ilk 3 çekim ücretsiz */ }`}</Code>
      <h3>Template Method: işlem iskeleti</h3>
      <Flow
        items={[
          { title: 'validate()', tag: 'alt sınıf doldurur', text: 'Tutar 10 TL’nin katı mı, işlem bu terminalde yapılabilir mi?' },
          { title: 'authorize()', tag: 'ortak', text: 'Host’a 0100/0200 gönderilir, yanıt kodu yorumlanır.' },
          { title: 'post()', tag: 'alt sınıf doldurur', text: 'Çekimde banknot dağıtılır, yatırmada banknot sayılır, transferde alıcı bilgisi eklenir.' },
          { title: 'compensate()', tag: 'ortak', text: 'Fiziksel adım başarısızsa 0400 ile iptal edilir.' },
          { title: 'journal()', tag: 'ortak', text: 'Elektronik günlüğe ve fişe yazılır (PAN maskeli).' },
        ]}
      />
      <Code title="Transaction.java (şablon metot)">{`public final Result run(HostGateway host) {          // final: iskelet değiştirilemez
    validate();                                       // alt sınıf
    Result auth = authorize(host);                    // ortak
    if (!auth.approved()) { journal(auth); return auth; }
    try {
        post(auth);                                   // alt sınıf: para ver / say
    } catch (DeviceException e) {
        compensate(host, auth);                       // ortak: 0400 iptal
        throw e;
    }
    journal(auth);
    return auth;
}`}</Code>
      <h3>State: ATM ekranı</h3>
      <Code title="AtmState.java">{`public interface AtmState { AtmState onEvent(AtmEvent e, AtmContext ctx); }

class IdleState implements AtmState {
    public AtmState onEvent(AtmEvent e, AtmContext ctx) {
        return e == AtmEvent.CARD_INSERTED ? new PinEntryState() : this;
    }
}
class PinEntryState implements AtmState {
    public AtmState onEvent(AtmEvent e, AtmContext ctx) {
        if (e == AtmEvent.PIN_ACCEPTED) return new MenuState();
        if (e == AtmEvent.PIN_RETAINED) return new IdleState();     // 75: kart alıkonur
        return this;
    }
}`}</Code>

      <h2 id="simulator">Simülatörde OOP</h2>
      <p>
        Bu proje bilinçli olarak kısa ve fonksiyonel yazılmıştır: host Python fonksiyonlarıdır (<code>withdraw</code>, <code>qr_approve</code>, <code>plan_dispense</code>…),
        arayüz React fonksiyon bileşenleridir ve durum sözlükler/nesne literalleriyle taşınır. Aynı sorumlulukları OOP’ye çevirmek isterseniz karşılıklar şöyledir:
      </p>
      <Table
        head={['Simülatörde şu an', 'OOP karşılığı']}
        rows={[
          [<code key="1">plan_dispense(amount, cassettes)</code>, 'CashDispenser.denominate() — arayüz + stratejiler (açgözlü / geri izleme)'],
          [<code key="2">_withdraw_check(...)</code>, 'Account.withdraw() içindeki kapsüllenmiş kurallar + özel istisna sınıfları'],
          [<code key="3">HostError(code)</code>, 'ResponseCodeException hiyerarşisi: InsufficientFunds (51), DailyLimit (61), PinTriesExceeded (75)'],
          [<code key="4">OFF_US_FEES, TRANSFER_FEES</code>, 'FeePolicy arayüzü ve her kural için bir Strategy sınıfı'],
          [<code key="5">screen === "pin" | "menu" | …</code>, 'AtmState arayüzü ve her ekran için bir State sınıfı'],
          [<code key="6">_withdraw / _deposit / bill_pay</code>, 'Transaction soyut sınıfı + Withdrawal, Deposit, BillPayment alt sınıfları'],
          [<code key="7">xfs(dev, cmd, text)</code>, 'Device arayüzleri ve Observer ile günlük/izleme']
        ]}
      />
      <Callout title="Hangisi daha iyi?">
        Küçük, yaşam süresi kısa bir program için fonksiyonel stil çoğu zaman daha sadedir. OOP’nin değeri, <b>çok sayıda geliştiricinin yıllarca değiştirdiği ve
        çok sayıda varyantı olan</b> sistemlerde (cihaz üreticileri, işlem türleri, kural setleri) ortaya çıkar. Fonksiyonel stil de aynı ilkeleri (soyutlama, tek sorumluluk, bağımlılığı tersine çevirme)
        fonksiyonlar ve modüllerle sağlar; ilkeler dilden bağımsızdır.
      </Callout>
      <TryInSim>
        Başka banka ATM’sine geçip çekim yapın, ardından Para çekme ve Bakiye için ücret ekranlarını karşılaştırın (25 TL ve 3 TL); bunlar yukarıdaki ücret stratejilerinin simülatördeki halidir.
      </TryInSim>

      <h2 id="hatalar">Sık yapılan hatalar</h2>
      <Table
        head={['Hata', 'Belirti', 'Çözüm']}
        rows={[
          [<b key="1">God class</b>, 'Tek sınıf her şeyi yapar: 5.000 satır, kimse dokunmaya cesaret edemez', 'Sorumluluklara göre böl'],
          [<b key="2">Anemic model</b>, 'Sınıflar yalnızca alan ve getter/setter; mantık dışarıdaki “servis”lerde', 'Kuralı, verinin sahibi olan nesneye taşı'],
          [<b key="3">Her yerde kalıtım</b>, 'Derin hiyerarşi, üst sınıf değişince her şey bozulur', 'Kompozisyon ve arayüzler'],
          [<b key="4">Açık alanlar/setter’lar</b>, 'Bakiye, sayaç gibi değerler herkes tarafından değiştirilir', 'Kapsülle, kuralı metoda koy'],
          [<b key="5">Para için double/float</b>, '0,1 + 0,2 ≠ 0,3; kuruş farkları', 'Kuruşu tamsayı tut ya da BigDecimal/Money sınıfı kullan'],
          [<b key="6">Singleton cihazlar</b>, 'Global durum, test edilemez, paralel testler çakışır', 'Bağımlılık enjeksiyonu'],
          [<b key="7">Yutulan istisnalar</b>, 'catch (Exception e) {} — para verilmedi mi verildi mi bilinmez', 'Tür belirli istisna, günlük, telafi (iptal)'],
          [<b key="8">instanceof zincirleri</b>, 'Yeni tür eklemek 10 yeri değiştirmeyi gerektirir', 'Çok biçimlilik veya Strategy']
        ]}
      />

      <h2 id="ozet">Özet</h2>
      <Table
        head={['Kavram', 'Bir cümlede']}
        rows={[
          ['Sınıf / nesne', 'Şablon / ondan üretilmiş somut örnek'],
          ['Kapsülleme', 'Durumu gizle, kuralı metoda koy'],
          ['Soyutlama', 'Arayüzü göster, uygulamayı gizle'],
          ['Kalıtım', 'Ortak kısmı üst sınıfa al; yalnızca gerçek “-dir” ilişkisinde'],
          ['Çok biçimlilik', 'Çağıran tür sormaz, nesne kendi davranışını uygular'],
          ['Kompozisyon', 'Davranışı yeniden kullanmanın varsayılan yolu'],
          ['SOLID', 'Değişime dayanıklı sınıf tasarımının beş ilkesi'],
          ['Desenler', 'Strategy, State, Factory, Adapter, Observer, Command, Template Method']
        ]}
      />
      <p className="tr-next">
        İlgili konular: <a href="#/egitim/xfs">XFS</a> · <a href="#/egitim/suruculer">ATM cihaz sürücüleri</a> · <a href="#/egitim/acid">ACID</a> · <a href="#/egitim/sdlc">SDLC</a>
      </p>
    </>
  )
}
