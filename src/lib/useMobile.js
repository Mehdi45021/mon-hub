import { useEffect, useState } from 'react'

// Vrai sur iPhone / petit écran : déclenche l'interface iOS (barre d'onglets, etc.)
export function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const h = () => setMobile(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return mobile
}
