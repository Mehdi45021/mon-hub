import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, FileDown, FileImage } from 'lucide-react'
import { api } from '../lib/api'
import { useSubjects, matiere } from '../lib/subjects'
import { EnTete, Carte, Select, Bouton, BoutonIcone } from '../components/ui'
import RichEditor, { exportPDF, exportPNG } from '../components/RichEditor'

export default function Fiches() {
  const { subjects } = useSubjects()
  const [fiches, setFiches] = useState([])
  const [sel, setSel] = useState(null)
  const [etat, setEtat] = useState('')
  const timer = useRef(null)

  const charger = () => api.get('/revisions').then(setFiches)
  useEffect(() => { charger() }, [])

  async function nouvelle() { const f = await api.post('/revisions', { titre: 'Nouvelle fiche', contenu: '', subject_id: null, maj: Date.now() }); await charger(); setSel(f) }
  async function supprimer(id) { await api.del('/revisions/' + id); if (sel?.id === id) setSel(null); charger() }
  function modifier(champ, val) {
    const maj = { ...sel, [champ]: val }
    setSel(maj); setEtat('Modifié…')
    setFiches(fs => fs.map(x => x.id === maj.id ? maj : x))
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => { await api.put('/revisions/' + maj.id, { titre: maj.titre, contenu: maj.contenu, subject_id: maj.subject_id, maj: Date.now() }); setEtat('Enregistré'); charger() }, 600)
  }

  return (
    <div>
      <EnTete section="ÉCOLE" titre="Fiches de révision" action={<Bouton variante="primaire" onClick={nouvelle}><Plus size={16} /> Nouvelle</Bouton>} />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Carte className="w-60 shrink-0 p-2 overflow-auto">
          {fiches.map(f => {
            const m = matiere(subjects, f.subject_id)
            return (
              <button key={f.id} onClick={() => { setSel(f); setEtat('') }}
                className={`t w-full text-left px-3 h-10 flex items-center gap-2 rounded text-sm ${sel?.id === f.id ? 'bg-surface-haute text-fort' : 'text-normal hover:bg-surface-haute hover:text-fort'}`}>
                {m && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.couleur }} />}
                <span className="truncate">{f.titre}</span>
              </button>
            )
          })}
          {fiches.length === 0 && <div className="px-3 py-6 text-faible text-sm">Aucune fiche.</div>}
        </Carte>
        <Carte className="flex-1 p-4 flex flex-col min-w-0">
          {sel ? <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <input value={sel.titre} onChange={e => modifier('titre', e.target.value)} className="flex-1 min-w-[8rem] bg-transparent titre text-lg outline-none" placeholder="Titre" />
              <Select value={sel.subject_id || ''} onChange={e => modifier('subject_id', e.target.value ? +e.target.value : null)}>
                <option value="">Matière…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </Select>
              <span className="eyebrow">{etat}</span>
              <BoutonIcone onClick={() => exportPDF(sel.contenu, sel.titre)} title="Export PDF"><FileDown size={16} /></BoutonIcone>
              <BoutonIcone onClick={() => exportPNG(sel.contenu, sel.titre)} title="Export PNG"><FileImage size={16} /></BoutonIcone>
              <BoutonIcone onClick={() => supprimer(sel.id)} className="hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
            <div className="flex-1 min-h-0"><RichEditor docKey={sel.id} value={sel.contenu} onChange={v => modifier('contenu', v)} /></div>
          </> : <div className="m-auto text-faible text-sm">Sélectionne ou crée une fiche.</div>}
        </Carte>
      </div>
    </div>
  )
}
