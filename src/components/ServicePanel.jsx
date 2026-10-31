import { useState } from 'react'
import { money } from '../api'

const FAULTS = [
  ['jam', 'Para sıkışması', 'Host onayından sonra CDM sıkışır, 0400 iptal (39=22) gider'],
  ['notTaken', 'Para alınmaz', 'Banknotlar 6 sn sonra geri çekilir, 0400 iptal (39=17)'],
  ['timeout', 'Host yanıtı kaybolur', 'Hesap borçlanır ama 0210 gelmez; 0400 yanıtsız kalır, iptal SAF kuyruğunda bekler (Teknisyen → SAF kuyruğunu gönder)'],
  ['cardJam', 'Kart sıkışması', 'Kart iadesinde okuyucu sıkışır, kart alıkonur'],
]
const DENOMS = [200, 100, 50, 20]
const DEVICE = { ok: 'Hizmette', jam: 'Sıkışma', 'paper-out': 'Kağıt yok' }
const sumValue = (notes) => DENOMS.reduce((s, d) => s + d * (notes[d] || 0), 0)
const sumCount = (notes) => DENOMS.reduce((s, d) => s + (notes[d] || 0), 0)

// Gün sonu denkleştirme: kasetteki fiili sayı, sayaçlardan beklenenle karşılaştırılır
function Balancing({ service, cassettes }) {
  const rows = DENOMS.map((d) => {
    const expected =
      service.opening[d] + service.replenished[d] + service.recycled[d] - service.dispensed[d] - service.rejected[d] - service.retracted[d]
    return { d, expected, counted: cassettes[d] ?? 0 }
  })
  return (
    <div className="svc-scroll">
      <table className="svc-table">
        <thead>
          <tr>
            <th>Kupür</th>
            <th>Açılış</th>
            <th>+ İkmal</th>
            <th>+ Yatan</th>
            <th>− Verilen</th>
            <th>− Red</th>
            <th>− Geri</th>
            <th>Beklenen</th>
            <th>Sayılan</th>
            <th>Fark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, expected, counted }) => (
            <tr key={d}>
              <td>{d} ₺</td>
              <td>{service.opening[d]}</td>
              <td>{service.replenished[d]}</td>
              <td>{service.recycled[d]}</td>
              <td>{service.dispensed[d]}</td>
              <td>{service.rejected[d]}</td>
              <td>{service.retracted[d]}</td>
              <td>{expected}</td>
              <td>{counted}</td>
              <td className={counted === expected ? 'ok' : 'bad'}>{counted - expected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const COUNTERS = [
  ['debits', 'Borç · para çekme'],
  ['credits', 'Alacak · para yatırma'],
]
const signed = (n) => (n > 0 ? `+${money(n)}` : money(n))

// Gün sonu: ATM'nin bildirdiği sayaçlar ile hostun kendi kayıtları
function Reconciliation({ recon }) {
  return (
    <div className="svc-scroll">
      <table className="svc-table">
        <thead>
          <tr>
            <th />
            <th>ATM</th>
            <th>Host</th>
            <th>Fark</th>
          </tr>
        </thead>
        <tbody>
          {COUNTERS.map(([k, label]) => (
            <tr key={k}>
              <td>{label}</td>
              <td>
                {recon.atm[k].count} · {money(recon.atm[k].amount)}
              </td>
              <td>
                {recon.host[k].count} · {money(recon.host[k].amount)}
              </td>
              <td className={recon.diff[k].count || recon.diff[k].amount ? 'bad' : 'ok'}>
                {recon.diff[k].count} · {signed(recon.diff[k].amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Table({ head, rows }) {
  return (
    <div className="svc-scroll">
      <table className="svc-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={c?.cls}>
                  {typeof c === 'object' && c !== null ? c.text : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ClearingTab({ service, terminalId, hostBook, clearing, onClearing, canRun, cards }) {
  const recon = service.lastRecon
  const unsettled = hostBook.filter((r) => r.terminal === terminalId && !r.settled).length
  const uncleared = hostBook.filter((r) => !r.cleared).length
  const holder = (id) => cards.find((c) => c.id === id)?.holder ?? id
  return (
    <>
      <div className="panel-head svc-sub">
        <h3>Mutabakat · {terminalId}</h3>
        {recon && (
          <span className={`svc-badge ${recon.matched ? 'ok' : 'bad'}`}>
            {recon.matched ? `Dönem ${recon.batch} tuttu` : `Dönem ${recon.batch} · fark var (95)`}
          </span>
        )}
      </div>
      {recon ? (
        <>
          <Reconciliation recon={recon} />
          <p className="svc-note">
            Son gün sonu {recon.at}.{' '}
            {recon.matched
              ? 'Dönem kapandı, sayaçlar sıfırlandı.'
              : 'Dönem açık kaldı. Fark çoğunlukla hostun borçladığı ama ATM’nin vermediği, iptali henüz ulaşmamış bir çekimdir.'}
          </p>
        </>
      ) : (
        <p className="svc-note">Bu terminalde henüz gün sonu yapılmadı. Teknisyen sekmesinden bakım moduna alıp Gün sonu (0500) çalıştırın.</p>
      )}
      <p className="svc-note">
        Gün sonu bekleyen host kaydı: <b>{unsettled}</b> · SAF kuyruğunda iptal: <b>{service.saf.length}</b>
      </p>

      <div className="panel-head svc-sub">
        <h3>Bankalar arası takas</h3>
        <button type="button" className="ghost small" onClick={onClearing} disabled={!canRun || !uncleared}>
          Takas oturumunu çalıştır · {uncleared} kayıt
        </button>
      </div>
      {!clearing && <p className="svc-note">Henüz takas oturumu çalıştırılmadı. Tüm terminallerin host kayıtları birlikte takasa girer.</p>}
      {clearing && (
        <>
          <p className="svc-note">Son oturum {clearing.date}</p>
          <h4 className="svc-h4">BKM · başka banka kartıyla ATM işlemleri</h4>
          {clearing.bkm.length ? (
            <Table
              head={['Kartı çıkaran → ATM sahibi', 'Adet', 'Tutar', 'Ücret', 'Ödenecek']}
              rows={clearing.bkm.map((r) => [
                `${r.issuer_name} → ${r.acquirer_name}`,
                r.count,
                money(r.amount),
                money(r.fee),
                money(r.amount + r.fee),
              ])}
            />
          ) : (
            <p className="svc-note">Takasa giren başka banka işlemi yok.</p>
          )}
          <h4 className="svc-h4">FAST / EFT · TCMB</h4>
          {clearing.payments.length ? (
            <Table
              head={['Yöntem', 'Gönderen → Alıcı', 'Adet', 'Tutar', 'Kuyruktan gönderilen']}
              rows={clearing.payments.map((r) => [r.method_text, `${r.from_name} → ${r.to_name}`, r.count, money(r.amount), r.released])}
            />
          ) : (
            <p className="svc-note">Bankalar arası transfer yok (havale banka içidir, takasa girmez).</p>
          )}
          <h4 className="svc-h4">Çek takası</h4>
          {clearing.cheques.length ? (
            <Table
              head={['Çek no', 'Lehtar', 'Tutar', 'Sonuç']}
              rows={clearing.cheques.map((c) => [
                c.cheque_no,
                holder(c.card),
                money(c.amount),
                { text: c.status, cls: c.status === 'Karşılıklı' ? 'ok' : 'bad' },
              ])}
            />
          ) : (
            <p className="svc-note">Takasta çek yok.</p>
          )}
          <h4 className="svc-h4">Net pozisyonlar</h4>
          <Table
            head={['Banka', 'Net (+ alacaklı / − borçlu)']}
            rows={clearing.positions.map((p) => [p.name, { text: signed(p.net), cls: p.net > 0 ? 'ok' : p.net < 0 ? 'bad' : undefined }])}
          />
          {clearing.postings.length > 0 && (
            <>
              <h4 className="svc-h4">Hesaplara geçen</h4>
              <Table head={['Hesap', 'Neden', 'Tutar']} rows={clearing.postings.map((p) => [holder(p.card), p.reason, money(p.amount)])} />
            </>
          )}
        </>
      )}
    </>
  )
}

export default function ServicePanel({
  faults,
  onFault,
  onPaperOut,
  service,
  cassettes,
  terminalId,
  maintenance,
  canToggle,
  busy,
  onToggleMaintenance,
  onRefill,
  onClearFaults,
  onEmptyBins,
  onSettle,
  onFlushSaf,
  backOffice,
  hostBook,
  clearing,
  onClearing,
  cards,
  journal,
}) {
  const [tab, setTab] = useState('faults')
  const armed = Object.values(faults).filter(Boolean).length
  const disabled = !maintenance || busy

  return (
    <div className="panel service">
      <div className="panel-head">
        <h3>Servis</h3>
        <div className="filters" role="tablist">
          {[
            ['faults', `Arıza${armed ? ` · ${armed}` : ''}`],
            ['tech', 'Teknisyen'],
            ['clearing', 'Takas & Mutabakat'],
            ['ej', `EJ · ${journal.length}`],
          ].map(([k, label]) => (
            <button
              type="button"
              key={k}
              role="tab"
              aria-selected={tab === k}
              className={`chip ${tab === k ? 'on' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'faults' && (
        <>
          <p className="svc-note">Seçilen arıza bir sonraki uygun işlemde bir kez tetiklenir.</p>
          <ul className="svc-faults">
            {FAULTS.map(([k, label, hint]) => (
              <li key={k}>
                <label>
                  <input type="checkbox" checked={faults[k]} onChange={(e) => onFault(k, e.target.checked)} />
                  <span>
                    <b>{label}</b>
                    <small>{hint}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="ghost small" onClick={onPaperOut} disabled={service.ptr !== 'ok'}>
            Fiş kağıdı bitsin
          </button>
        </>
      )}

      {tab === 'tech' && (
        <>
          <div className="svc-top">
            <span className={`svc-mode ${maintenance ? 'on' : ''}`}>{maintenance ? 'Bakım modu · hizmet dışı' : 'Hizmette'}</span>
            <button type="button" className="ghost small" onClick={onToggleMaintenance} disabled={!canToggle || busy}>
              {maintenance ? 'Hizmete aç' : 'Bakım moduna al'}
            </button>
          </div>
          {!maintenance && <p className="svc-note">İşlemler için ATM boştayken bakım moduna alın.</p>}
          <dl className="svc-status">
            <div>
              <dt>Para verme (CDM)</dt>
              <dd className={service.cdm === 'ok' ? 'ok' : 'bad'}>{DEVICE[service.cdm]}</dd>
            </div>
            <div>
              <dt>Fiş yazıcı (PTR)</dt>
              <dd className={service.ptr === 'ok' ? 'ok' : 'bad'}>{DEVICE[service.ptr]}</dd>
            </div>
            <div>
              <dt>Red kutusu</dt>
              <dd>
                {sumCount(service.reject)} adet · {money(sumValue(service.reject))}
              </dd>
            </div>
            <div>
              <dt>Geri çekme kutusu</dt>
              <dd>
                {sumCount(service.retract)} adet · {money(sumValue(service.retract))}
              </dd>
            </div>
            <div>
              <dt>Alıkonan kart</dt>
              <dd>{service.captured}</dd>
            </div>
            <div>
              <dt>SAF kuyruğu</dt>
              <dd className={service.saf.length ? 'bad' : undefined}>{service.saf.length}</dd>
            </div>
          </dl>
          <div className="svc-actions">
            <button type="button" className="ghost small" onClick={onRefill} disabled={disabled}>
              Kasetleri doldur
            </button>
            <button type="button" className="ghost small" onClick={onClearFaults} disabled={disabled}>
              Arızaları gider
            </button>
            <button type="button" className="ghost small" onClick={onEmptyBins} disabled={disabled}>
              Kutuları boşalt
            </button>
            <button type="button" className="ghost small" onClick={onSettle} disabled={disabled}>
              Gün sonu (0500)
            </button>
            <button type="button" className="ghost small" onClick={onFlushSaf} disabled={!service.saf.length || !backOffice}>
              SAF kuyruğunu gönder
            </button>
          </div>
          <div className="panel-head svc-sub">
            <h3>Denkleştirme</h3>
            <span className="panel-meta">
              {terminalId} · dönem {service.batch} · borç {service.debits.count} / {money(service.debits.amount)} · alacak {service.credits.count} /{' '}
              {money(service.credits.amount)}
            </span>
          </div>
          <Balancing service={service} cassettes={cassettes} />
        </>
      )}

      {tab === 'clearing' && (
        <ClearingTab
          service={service}
          terminalId={terminalId}
          hostBook={hostBook}
          clearing={clearing}
          onClearing={onClearing}
          canRun={backOffice}
          cards={cards}
        />
      )}

      {tab === 'ej' && (
        <ol className="svc-ej">
          {journal.length === 0 && <li className="log-empty">Bu terminalde henüz kayıt yok.</li>}
          {[...journal].reverse().map((e) => (
            <li key={e.id}>
              <span className="ej-time">{e.time}</span>
              <span className="ej-txn">{e.txn}</span>
              <span className="ej-pan">{e.pan}</span>
              <span className="ej-amt">{typeof e.amount === 'number' ? money(e.amount) : e.amount ?? ''}</span>
              <span className={`ej-res ${/ONAY|VERİLDİ|OPERATÖR|KAPANDI/.test(e.result) ? 'ok' : 'bad'}`}>{e.result}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
