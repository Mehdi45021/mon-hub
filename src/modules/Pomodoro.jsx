import { useEffect, useRef, useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Bouton } from '../components/ui'

const TRAVAIL = 25 * 60, PAUSE = 5 * 60

export default function Pomodoro() {
  const [phase, setPhase] = useState('travail') // travail | pause
  const [reste, setReste] = useState(TRAVAIL)
  const [actif, setActif] = useState(false)
  const [sessions, setSessions] = useState(0)
  const tick = useRef(null)

  const charger = () => api.get('/pomodoro/today').then(d => setSessions(d.sessions))
  useEffect(() => { charger() }, [])

  useEffect(() => {
    if (!actif) return
    tick.current = setInterval(() => setReste(r => r - 1), 1000)
    return () => clearInterval(tick.current)
  }, [actif])

  // Fin de phase
  useEffect(() => {
    if (reste > 0) return
    setActif(false)
    if (phase === 'travail') { api.post('/pomodoro', {}).then(charger); setPhase('pause'); setReste(PAUSE) }
    else { setPhase('travail'); setReste(TRAVAIL) }
  }, [reste])

  function reset() { setActif(false); setReste(phase === 'travail' ? TRAVAIL : PAUSE) }
  const r = Math.max(reste, 0) // jamais négatif à l'affichage
  const mm = String(Math.floor(r / 60)).padStart(2, '0')
  const ss = String(r % 60).padStart(2, '0')
  const total = phase === 'travail' ? TRAVAIL : PAUSE
  const pct = ((total - reste) / total) * 100

  return (
    <div className="max-w-md">
      <EnTete section="FOCUS" titre="Minuteur Pomodoro" />
      <Carte className="p-8 text-center">
        <div className="eyebrow mb-4">{phase === 'travail' ? 'Concentration' : 'Pause'}</div>
        <div className="titre tabular-nums mb-6" style={{ fontSize: '64px', lineHeight: 1 }}>{mm}:{ss}</div>
        {/* Barre de progression fine */}
        <div className="h-1 rounded bg-surface-haute mb-6 overflow-hidden">
          <div className="h-full bg-accent t" style={{ width: pct + '%' }} />
        </div>
        <div className="flex justify-center gap-2">
          <Bouton variante="primaire" onClick={() => setActif(a => !a)}>
            {actif ? <Pause size={16} /> : <Play size={16} />}{actif ? 'Pause' : 'Démarrer'}
          </Bouton>
          <Bouton onClick={reset}><RotateCcw size={16} /></Bouton>
        </div>
      </Carte>
      <Carte className="p-5 mt-4 flex items-center justify-between">
        <div className="eyebrow">Sessions aujourd'hui</div>
        <div className="titre text-2xl tabular-nums">{sessions}</div>
      </Carte>
    </div>
  )
}
