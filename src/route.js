import { useEffect, useState } from 'react'

// Hash tabanlı yönlendirme: #/ simülatör, #/egitim konu dizini, #/egitim/<konu> konu sayfası.
// Sunucu tarafında ek ayar gerektirmez (Vercel dahil).
function read() {
  const [section, topic] = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (section === 'egitim') return { view: 'training', topic: topic ?? null }
  return { view: 'sim', topic: null }
}

export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const onChange = () => {
      setRoute(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
