import { useEffect, useRef, useState } from 'react'
import { GROUPS, TOPICS } from '../training/topics'

// Ana menü: Simülatör | Eğitim ▾ (konular). Eğitim menüsü topics.js listesinden oluşur.
export default function TopNav({ route }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const inTraining = route.view === 'training'

  useEffect(() => setOpen(false), [route])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        box.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav className="mainnav" aria-label="Ana menü">
      <span className="mainnav-brand">ATM · Sim</span>
      <a href="#/" className={`mainnav-link ${!inTraining ? 'on' : ''}`} aria-current={!inTraining ? 'page' : undefined}>
        Simülatör
      </a>
      <div className="mainnav-menu" ref={box}>
        <button
          type="button"
          className={`mainnav-link ${inTraining ? 'on' : ''}`}
          aria-haspopup="true"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Eğitim <span aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className="mainnav-pop">
            {GROUPS.map((g) => (
              <div key={g} role="group" aria-label={g}>
                <p className="mainnav-group">{g}</p>
                {TOPICS.filter((t) => t.group === g).map((t) => (
                  <a key={t.id} href={`#/egitim/${t.id}`} className="mainnav-item" aria-current={route.topic === t.id ? 'page' : undefined}>
                    <b>{t.title}</b>
                    <span>{t.summary}</span>
                  </a>
                ))}
              </div>
            ))}
            <a href="#/egitim" className="mainnav-item all">
              Tüm konular →
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
