import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, List, Columns } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'
import TagBar from '../components/Tags'
import SousTaches from '../components/SousTaches'
import ExportData from '../components/ExportData'

const PRIO = { haute: 'bg-alerte', normale: 'bg-faible', basse: 'bg-faible/40' }
const COLS = [['afaire', 'À faire'], ['encours', 'En cours'], ['fait', 'Fait']]

export default function Taches() {
  const [tasks, setTasks] = useState([])
  const [titre, setTitre] = useState('')
  const [prio, setPrio] = useState('normale')
  const [rec, setRec] = useState('none')
  const [vue, setVue] = useState('liste')
  const [tags, setTags] = useState([])
  const [map, setMap] = useState({})
  const [filtre, setFiltre] = useState(null)
  const [ouvert, setOuvert] = useState(null) // tâche dépliée (sous-tâches/tags)

  const charger = () => {
    api.get('/tasks').then(setTasks)
    api.get('/tags').then(setTags)
    api.get('/tags/map/tasks').then(setMap)
  }
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!titre.trim()) return
    await api.post('/tasks', { titre: titre.trim(), priorite: prio, recurrence: rec })
    setTitre(''); setRec('none'); charger()
  }
  const basculer = (t) => api.put('/tasks/' + t.id, { fait: t.fait ? 0 : 1 }).then(charger)
  const bouger = (t, statut) => api.put('/tasks/' + t.id, { statut }).then(charger)
  const supprimer = (id) => api.del('/tasks/' + id).then(() => { setOuvert(null); charger() })

  const visibles = filtre ? tasks.filter(t => (map[t.id] || []).some(x => x.id === filtre)) : tasks

  // Carte tâche (réutilisée liste + kanban)
  function Ligne({ t, kanban }) {
    const open = ouvert === t.id
    return (
      <div className={kanban ? 'p-3' : 'px-4 py-2.5'}>
        <div className="flex items-center gap-3">
          <button onClick={() => basculer(t)}
            className={`t w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${t.fait ? 'bg-accent border-accent text-fond' : 'border-faible hover:border-fort'}`}>
            {t.fait ? <Check size={11} strokeWidth={3} /> : null}
          </button>
          <button onClick={() => setOuvert(open ? null : t.id)} className={`flex-1 text-left text-sm truncate ${t.fait ? 'line-through text-faible' : 'text-fort'}`}>{t.titre}</button>
          {t.recurrence !== 'none' && <span className="eyebrow">{t.recurrence === 'quotidien' ? 'QUOTIDIEN' : 'HEBDO'}</span>}
          <span className={`w-1.5 h-1.5 rounded-full ${PRIO[t.priorite]}`} title={t.priorite} />
          <BoutonIcone onClick={() => supprimer(t.id)} className="hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
        </div>
        {/* Tags inline */}
        {(map[t.id]?.length || open) ? (
          <div className="pl-7 mt-2">{open
            ? <TagBar type="tasks" id={t.id} onChange={() => api.get('/tags/map/tasks').then(setMap)} />
            : <div className="flex gap-1.5 flex-wrap">{map[t.id].map(g => (
                <span key={g.id} className="inline-flex items-center gap-1 text-xs text-normal"><span className="w-1.5 h-1.5 rounded-full" style={{ background: g.couleur }} />{g.nom}</span>
              ))}</div>}
          </div>
        ) : null}
        {open && <div className="pl-7 mt-3"><SousTaches taskId={t.id} /></div>}
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <EnTete section="TÂCHES" titre="Tâches" action={
        <div className="flex gap-2 items-center">
          <ExportData rows={tasks} nom="taches" />
          <div className="flex gap-1">
            <BoutonIcone onClick={() => setVue('liste')} className={vue === 'liste' ? 'text-fort bg-surface-haute' : ''}><List size={16} /></BoutonIcone>
            <BoutonIcone onClick={() => setVue('kanban')} className={vue === 'kanban' ? 'text-fort bg-surface-haute' : ''}><Columns size={16} /></BoutonIcone>
          </div>
        </div>
      } />
      <form onSubmit={ajouter} className="flex gap-2 mb-3 flex-wrap">
        <Champ value={titre} onChange={e => setTitre(e.target.value)} placeholder="Nouvelle tâche…" className="min-w-[12rem]" />
        <Select value={prio} onChange={e => setPrio(e.target.value)}><option value="haute">Haute</option><option value="normale">Normale</option><option value="basse">Basse</option></Select>
        <Select value={rec} onChange={e => setRec(e.target.value)}><option value="none">Ponctuel</option><option value="quotidien">Quotidien</option><option value="hebdo">Hebdo</option></Select>
        <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
      </form>

      {/* Filtre par tag */}
      {tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setFiltre(null)} className={`t h-6 px-2 rounded border text-xs ${!filtre ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>Tous</button>
          {tags.map(g => (
            <button key={g.id} onClick={() => setFiltre(g.id)} className={`t inline-flex items-center gap-1.5 h-6 px-2 rounded border text-xs ${filtre === g.id ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-normal hover:text-fort'}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.couleur }} />{g.nom}
            </button>
          ))}
        </div>
      )}

      {vue === 'liste' ? (
        <Carte className="divide-y divide-[var(--bordure)]">
          {visibles.map(t => <Ligne key={t.id} t={t} />)}
          {visibles.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Aucune tâche.</div>}
        </Carte>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {COLS.map(([st, label]) => (
            <div key={st}>
              <div className="eyebrow mb-2">{label} · {visibles.filter(t => (t.statut || 'afaire') === st).length}</div>
              <div className="space-y-2 min-h-[4rem]">
                {visibles.filter(t => (t.statut || 'afaire') === st).map(t => (
                  <Carte key={t.id}>
                    <Ligne t={t} kanban />
                    <div className="flex gap-1 px-3 pb-2">
                      {COLS.filter(([s]) => s !== st).map(([s, l]) => (
                        <button key={s} onClick={() => bouger(t, s)} className="t text-xs text-faible hover:text-fort px-1.5 py-0.5 rounded border border-[var(--bordure)]">→ {l}</button>
                      ))}
                    </div>
                  </Carte>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
