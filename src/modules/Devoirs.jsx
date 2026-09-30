import { useEffect, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { api } from '../lib/api'
import { useSubjects, matiere } from '../lib/subjects'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'
import ExportData from '../components/ExportData'

const today = () => new Date().toISOString().slice(0, 10)
// Jours restants avant échéance
function reste(echeance) {
  const d = Math.round((new Date(echeance) - new Date(today())) / 86400000)
  if (d < 0) return { txt: 'En retard', urgent: true }
  if (d === 0) return { txt: "Aujourd'hui", urgent: true }
  if (d === 1) return { txt: 'Demain', urgent: true }
  return { txt: `${d} j`, urgent: d <= 3 }
}

export default function Devoirs() {
  const { subjects } = useSubjects()
  const [list, setList] = useState([])
  const [f, setF] = useState({ titre: '', subject_id: '', echeance: today() })

  const charger = () => api.get('/homework').then(setList)
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!f.titre.trim()) return
    await api.post('/homework', { titre: f.titre.trim(), subject_id: f.subject_id ? +f.subject_id : null, echeance: f.echeance, fait: 0 })
    setF({ ...f, titre: '' }); charger()
  }
  const basculer = (h) => api.put('/homework/' + h.id, { fait: h.fait ? 0 : 1 }).then(charger)
  const supprimer = (id) => api.del('/homework/' + id).then(charger)

  const aRendre = list.filter(h => !h.fait)
  const finis = list.filter(h => h.fait)

  return (
    <div className="max-w-2xl">
      <EnTete section="ÉCOLE" titre="Devoirs" action={<ExportData rows={list} nom="devoirs" />} />
      <form onSubmit={ajouter} className="flex gap-2 mb-5 flex-wrap">
        <Champ value={f.titre} onChange={e => setF({ ...f, titre: e.target.value })} placeholder="Devoir à faire…" className="flex-1 min-w-[10rem]" />
        <Select value={f.subject_id} onChange={e => setF({ ...f, subject_id: e.target.value })}>
          <option value="">Matière…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </Select>
        <Champ type="date" value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} className="w-40" />
        <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
      </form>

      <div className="eyebrow mb-2">À rendre bientôt</div>
      <Carte className="divide-y divide-[var(--bordure)] mb-5">
        {aRendre.map(h => {
          const m = matiere(subjects, h.subject_id), r = reste(h.echeance)
          return (
            <div key={h.id} className="group flex items-center gap-3 px-4 h-12">
              <button onClick={() => basculer(h)} className="t w-4 h-4 rounded-sm border border-faible hover:border-fort shrink-0" />
              <span className="flex-1 text-sm text-fort truncate">{h.titre}</span>
              {m && <span className="eyebrow flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: m.couleur }} />{m.nom}</span>}
              <span className={`text-xs tabular-nums ${r.urgent ? 'text-alerte' : 'text-faible'}`}>{r.txt}</span>
              <BoutonIcone onClick={() => supprimer(h.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
          )
        })}
        {aRendre.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Rien à rendre.</div>}
      </Carte>

      {finis.length > 0 && <>
        <div className="eyebrow mb-2">Terminés</div>
        <Carte className="divide-y divide-[var(--bordure)]">
          {finis.map(h => (
            <div key={h.id} className="group flex items-center gap-3 px-4 h-11">
              <button onClick={() => basculer(h)} className="t w-4 h-4 rounded-sm bg-accent border border-accent text-fond flex items-center justify-center shrink-0"><Check size={11} strokeWidth={3} /></button>
              <span className="flex-1 text-sm line-through text-faible truncate">{h.titre}</span>
              <BoutonIcone onClick={() => supprimer(h.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
          ))}
        </Carte>
      </>}
    </div>
  )
}
