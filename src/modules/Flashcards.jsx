import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, X, RotateCcw, Download, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { useSubjects, matiere } from '../lib/subjects'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'

export default function Flashcards() {
  const { subjects } = useSubjects()
  const [cartes, setCartes] = useState([])
  const [aRevoir, setARevoir] = useState([])
  const [f, setF] = useState({ question: '', reponse: '', subject_id: '' })
  const [filtre, setFiltre] = useState('')
  const [mode, setMode] = useState(false)
  const [i, setI] = useState(0)
  const [retourne, setRetourne] = useState(false)

  const charger = () => { api.get('/flashcards').then(setCartes); api.get('/flashcards/review').then(setARevoir) }
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!f.question.trim() || !f.reponse.trim()) return
    await api.post('/flashcards', { question: f.question.trim(), reponse: f.reponse.trim(), subject_id: f.subject_id ? +f.subject_id : null, box: 1, due: null })
    setF({ ...f, question: '', reponse: '' }); charger()
  }
  const supprimer = (id) => api.del('/flashcards/' + id).then(charger)

  async function repondre(bon) {
    await api.post(`/flashcards/${aRevoir[i].id}/answer`, { bon })
    const suite = aRevoir.filter((_, k) => k !== i)
    setARevoir(suite); setRetourne(false)
    if (i >= suite.length) setI(0)
    if (suite.length === 0) { setMode(false); charger() }
  }

  // ===== Stats =====
  const visibles = filtre ? cartes.filter(c => c.subject_id === +filtre) : cartes
  const stats = subjects.map(s => {
    const cs = cartes.filter(c => c.subject_id === s.id)
    return { ...s, total: cs.length, acquis: cs.filter(c => c.box >= 4).length }
  }).filter(s => s.total)

  // ===== CSV =====
  function exportCSV() {
    const lignes = [['question', 'reponse', 'box', 'matiere'], ...cartes.map(c => [c.question, c.reponse, c.box, matiere(subjects, c.subject_id)?.nom || ''])]
    const csv = lignes.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'flashcards.csv'; a.click()
  }
  async function importCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const txt = await file.text()
    const lignes = txt.split('\n').slice(1).filter(l => l.trim())
    for (const l of lignes) {
      const m = l.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map(x => x.replace(/^,?"?|"?,?$/g, '').replace(/""/g, '"'))
      if (m && m[0] && m[1]) {
        const sid = subjects.find(s => s.nom === (m[3] || '').trim())?.id || null
        await api.post('/flashcards', { question: m[0], reponse: m[1], subject_id: sid, box: 1, due: null })
      }
    }
    e.target.value = ''; charger()
  }

  // ===== Mode révision (flip) =====
  if (mode && aRevoir.length > 0) {
    const c = aRevoir[i]
    return (
      <div className="max-w-xl mx-auto">
        <EnTete section="ÉCOLE" titre="Révision" action={<Bouton onClick={() => setMode(false)}>Quitter</Bouton>} />
        <div className="eyebrow mb-3">{aRevoir.length} carte{aRevoir.length > 1 ? 's' : ''} · Box {c.box}</div>
        <div className="flip h-64 mb-4" onClick={() => setRetourne(r => !r)} role="button">
          <div className={`flip-inner ${retourne ? '' : ''}`} style={{ transform: retourne ? 'rotateY(180deg)' : 'none' }}>
            <Carte className="flip-face p-8 items-center justify-center text-center cursor-pointer">
              <div className="eyebrow mb-3">Question</div>
              <p className="text-fort text-xl">{c.question}</p>
              <div className="eyebrow mt-auto pt-4">Clique pour retourner</div>
            </Carte>
            <Carte className="flip-face flip-dos p-8 items-center justify-center text-center cursor-pointer">
              <div className="eyebrow mb-3">Réponse</div>
              <p className="text-normal text-lg">{c.reponse}</p>
            </Carte>
          </div>
        </div>
        {retourne && (
          <div className="flex gap-2">
            <Bouton onClick={() => repondre(false)} className="flex-1 hover:text-alerte"><X size={16} /> À revoir</Bouton>
            <Bouton variante="primaire" onClick={() => repondre(true)} className="flex-1"><Check size={16} /> Su</Bouton>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <EnTete section="ÉCOLE" titre="Flashcards" action={
        <div className="flex gap-2">
          <Bouton onClick={exportCSV}><Download size={16} /></Bouton>
          <label className="cursor-pointer"><Bouton onClick={e => e.currentTarget.parentElement.querySelector('input').click()}><Upload size={16} /></Bouton>
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} /></label>
          <Bouton variante="primaire" onClick={() => { setMode(true); setI(0); setRetourne(false) }} disabled={!aRevoir.length}>Réviser{aRevoir.length ? ` (${aRevoir.length})` : ''}</Bouton>
        </div>
      } />

      {/* Stats par matière */}
      {stats.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {stats.map(s => (
            <Carte key={s.id} className="p-4">
              <div className="flex items-center gap-2 mb-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.couleur }} /><span className="text-sm text-fort truncate">{s.nom}</span></div>
              <div className="titre text-xl tabular-nums">{s.acquis}<span className="text-faible text-sm">/{s.total} acquis</span></div>
              <div className="h-1 rounded bg-surface-haute mt-2 overflow-hidden"><div className="h-full bg-accent" style={{ width: (s.acquis / s.total * 100) + '%' }} /></div>
            </Carte>
          ))}
        </div>
      )}

      <form onSubmit={ajouter} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <Champ value={f.question} onChange={e => setF({ ...f, question: e.target.value })} placeholder="Question" />
          <Select value={f.subject_id} onChange={e => setF({ ...f, subject_id: e.target.value })}><option value="">Matière…</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}</Select>
        </div>
        <div className="flex gap-2">
          <Champ value={f.reponse} onChange={e => setF({ ...f, reponse: e.target.value })} placeholder="Réponse" />
          <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
        </div>
      </form>

      {subjects.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          <button onClick={() => setFiltre('')} className={`t h-6 px-2 rounded border text-xs ${!filtre ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>Toutes</button>
          {subjects.map(s => <button key={s.id} onClick={() => setFiltre('' + s.id)} className={`t inline-flex items-center gap-1.5 h-6 px-2 rounded border text-xs ${filtre === '' + s.id ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-normal hover:text-fort'}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: s.couleur }} />{s.nom}</button>)}
        </div>
      )}

      <Carte className="divide-y divide-[var(--bordure)]">
        {visibles.map(c => (
          <div key={c.id} className="group flex items-center gap-3 px-4 h-12">
            <span className="flex-1 text-sm text-fort truncate">{c.question}</span>
            <span className="eyebrow">Box {c.box}/5</span>
            <BoutonIcone onClick={() => supprimer(c.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
          </div>
        ))}
        {visibles.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Aucune carte.</div>}
      </Carte>
    </div>
  )
}
