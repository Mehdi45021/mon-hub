import { useEffect, useState } from 'react'
import { Plus, Trash2, Flame } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'

// 7 derniers jours (du plus ancien à aujourd'hui)
function septJours() {
  const arr = []
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); arr.push(d.toISOString().slice(0, 10)) }
  return arr
}
const JOUR = (iso) => ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'][new Date(iso).getDay()]

export default function Habitudes() {
  const [habits, setHabits] = useState([])
  const [nom, setNom] = useState('')
  const jours = septJours()

  const charger = () => api.get('/habits/state').then(setHabits)
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!nom.trim()) return
    await api.post('/habits', { nom: nom.trim() }); setNom(''); charger()
  }
  const basculer = (h, date) => api.post(`/habits/${h.id}/toggle`, { date }).then(charger)
  const supprimer = (id) => api.del('/habits/' + id).then(charger)

  return (
    <div className="max-w-3xl">
      <EnTete section="HABITUDES" titre="Suivi d'habitudes" />
      <form onSubmit={ajouter} className="flex gap-2 mb-4">
        <Champ value={nom} onChange={e => setNom(e.target.value)} placeholder="Nouvelle habitude…" />
        <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
      </form>
      <Carte className="divide-y divide-[var(--bordure)]">
        {/* En-tête jours */}
        <div className="flex items-center gap-3 px-4 h-9">
          <div className="flex-1" />
          {jours.map(j => <div key={j} className="w-8 text-center eyebrow">{JOUR(j)}</div>)}
          <div className="w-12 text-center eyebrow">Série</div>
          <div className="w-8" />
        </div>
        {habits.map(h => (
          <div key={h.id} className="group flex items-center gap-3 px-4 h-12">
            <span className="flex-1 text-sm text-fort truncate">{h.nom}</span>
            {jours.map(j => {
              const on = h.logs.includes(j)
              return (
                <button key={j} onClick={() => basculer(h, j)}
                  className={`t w-8 h-8 rounded border flex items-center justify-center ${on ? 'border-accent/60 bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]' : 'border-[var(--bordure)] hover:bg-surface-haute'}`}>
                  {on && <span className="w-2 h-2 rounded-full bg-accent" />}
                </button>
              )
            })}
            <div className="w-12 flex items-center justify-center gap-1 text-sm tabular-nums text-fort">
              {h.serie > 0 && <Flame size={13} className="text-accent" />}{h.serie}
            </div>
            <BoutonIcone onClick={() => supprimer(h.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
          </div>
        ))}
        {habits.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Aucune habitude.</div>}
      </Carte>
    </div>
  )
}
