import { useEffect, useState } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Bouton, BoutonIcone } from '../components/ui'

const TYPE = { tasks: 'Tâche', notes: 'Note', events: 'Événement', homework: 'Devoir', flashcards: 'Flashcard', snippets: 'Snippet', favoris: 'Favori', flights: 'Vol', vocab: 'Mot' }
const titreDe = (d) => d.titre || d.mot || d.nom || (d.depart && `${d.depart} → ${d.arrivee}`) || d.question || '(sans titre)'

export default function Corbeille() {
  const [items, setItems] = useState([])
  const charger = () => api.get('/trash').then(setItems)
  useEffect(() => { charger() }, [])

  const restaurer = (id) => api.post(`/trash/${id}/restore`).then(charger)
  const purger = (id) => api.del('/trash/' + id).then(charger)

  return (
    <div className="max-w-2xl">
      <EnTete section="CORBEILLE" titre="Corbeille" />
      <p className="text-faible text-sm mb-4">Les éléments supprimés sont conservés 30 jours.</p>
      <Carte className="divide-y divide-[var(--bordure)]">
        {items.map(it => (
          <div key={it.id} className="group flex items-center gap-3 px-4 h-12">
            <span className="eyebrow w-20 shrink-0">{TYPE[it.type] || it.type}</span>
            <span className="flex-1 text-sm text-fort truncate">{titreDe(it.data)}</span>
            <span className="eyebrow">{new Date(it.supprime_le).toLocaleDateString('fr-FR')}</span>
            <BoutonIcone onClick={() => restaurer(it.id)} title="Restaurer" className="hover:text-succes"><RotateCcw size={16} /></BoutonIcone>
            <BoutonIcone onClick={() => purger(it.id)} title="Supprimer définitivement" className="hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
          </div>
        ))}
        {items.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Corbeille vide.</div>}
      </Carte>
    </div>
  )
}
