import { useEffect, useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { api } from '../lib/api'

// Checklist / sous-tâches d'une tâche.
export default function SousTaches({ taskId }) {
  const [items, setItems] = useState([])
  const [titre, setTitre] = useState('')
  const charger = () => api.get(`/tasks/${taskId}/subtasks`).then(setItems)
  useEffect(() => { charger() }, [taskId])

  async function ajouter(e) {
    e.preventDefault()
    if (!titre.trim()) return
    await api.post('/subtasks', { task_id: taskId, titre: titre.trim(), fait: 0 })
    setTitre(''); charger()
  }
  const basculer = (s) => api.put('/subtasks/' + s.id, { fait: s.fait ? 0 : 1 }).then(charger)
  const supprimer = (id) => api.del('/subtasks/' + id).then(charger)

  const faits = items.filter(s => s.fait).length
  return (
    <div>
      <div className="eyebrow mb-1.5">Sous-tâches {items.length ? `· ${faits}/${items.length}` : ''}</div>
      <div className="space-y-1 mb-1.5">
        {items.map(s => (
          <div key={s.id} className="group flex items-center gap-2 text-sm">
            <button onClick={() => basculer(s)} className={`t w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${s.fait ? 'bg-accent border-accent text-fond' : 'border-faible hover:border-fort'}`}>
              {s.fait ? <Check size={9} strokeWidth={3} /> : null}
            </button>
            <span className={`flex-1 ${s.fait ? 'line-through text-faible' : 'text-normal'}`}>{s.titre}</span>
            <button onClick={() => supprimer(s.id)} className="opacity-0 group-hover:opacity-100 text-faible hover:text-alerte"><X size={13} /></button>
          </div>
        ))}
      </div>
      <form onSubmit={ajouter} className="flex gap-1">
        <input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ajouter une étape…"
          className="flex-1 h-7 px-2 rounded border border-[var(--bordure)] bg-fond text-xs text-fort outline-none focus:border-accent/60" />
        <button className="h-7 w-7 flex items-center justify-center rounded border border-[var(--bordure)] text-faible hover:text-fort"><Plus size={14} /></button>
      </form>
    </div>
  )
}
