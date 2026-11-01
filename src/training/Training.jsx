import { Suspense, useEffect, useRef, useState } from 'react'
import { GROUPS, TOPICS } from './topics'

// Konu sayfasını sarar: içerikteki <h2 id> başlıklarından içindekiler çıkarır, görünür başlığı vurgular.
function Article({ Page, onToc, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const heads = [...ref.current.querySelectorAll('h2[id]')]
    onToc(heads.map((h) => ({ id: h.id, text: h.textContent })))
    const seen = new Map()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting))
        const first = heads.find((h) => seen.get(h.id))
        if (first) active(first.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    heads.forEach((h) => io.observe(h))
    return () => io.disconnect()
  }, [Page, onToc, active])

  return (
    <div ref={ref}>
      <Page />
    </div>
  )
}

function TopicPage({ topic }) {
  const [toc, setToc] = useState([])
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    document.title = `${topic.title} · Eğitim · ATM Simülatörü`
    return () => {
      document.title = 'ATM Simülatörü'
    }
  }, [topic])

  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="tr">
      <nav className="tr-toc" aria-label="Bu sayfada">
        <h4>Bu sayfada</h4>
        {toc.map((t) => (
          <button key={t.id} type="button" className={current === t.id ? 'on' : ''} aria-current={current === t.id ? 'true' : undefined} onClick={() => jump(t.id)}>
            {t.text}
          </button>
        ))}
      </nav>
      <article className="tr-content">
        <Suspense fallback={<p className="tr-loading">Yükleniyor…</p>}>
          <Article key={topic.id} Page={topic.Page} onToc={setToc} active={setCurrent} />
        </Suspense>
      </article>
    </div>
  )
}

function TopicIndex() {
  return (
    <div className="tr-index">
      <header className="tr-head">
        <p className="eyebrow">Eğitim</p>
        <h1>Ödeme sistemleri eğitimi</h1>
        <p className="tr-lead">
          Simülatörde gördüğünüz mesajların ve cihaz davranışlarının arkasındaki standartlar. Her konu akış şemaları, örnek senaryolar ve
          simülatörle bağlantılı alıştırmalar içerir.
        </p>
      </header>
      {GROUPS.map((g) => (
        <section key={g} aria-label={g}>
          <h2 className="tr-group">{g}</h2>
          <ul className="tr-cards">
            {TOPICS.filter((t) => t.group === g).map((t) => (
              <li key={t.id}>
                <a href={`#/egitim/${t.id}`} className="tr-card">
                  <b>{t.title}</b>
                  <span>{t.summary}</span>
                  <small>≈ {t.minutes} dk okuma</small>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="tr-muted">Yeni konular eklendikçe burada ve üstteki Eğitim menüsünde listelenir.</p>
    </div>
  )
}

export default function Training({ topicId }) {
  const topic = TOPICS.find((t) => t.id === topicId)
  return topic ? <TopicPage topic={topic} /> : <TopicIndex />
}
