import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, ArrowRight, Sparkles, Languages } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'
import ExportData from '../components/ExportData'

const LANGUES = ['Français', 'Espagnol', 'Anglais', 'Darija', 'Coréen']

// Outil de traduction rapide via IA
function Traducteur({ onAjouter }) {
  const [texte, setTexte] = useState('')
  const [cible, setCible] = useState('Anglais')
  const [res, setRes] = useState('')
  const [charge, setCharge] = useState(false)

  async function traduire(e) {
    e.preventDefault()
    if (!texte.trim()) return
    setCharge(true); setRes('')
    try { const d = await api.post('/ai/translate', { text: texte.trim(), cible }); setRes(d.traduction) }
    catch (e) { setRes('⚠️ ' + e.message) } finally { setCharge(false) }
  }
  return (
    <Carte className="p-4 mb-5">
      <div className="eyebrow mb-2 flex items-center gap-1.5"><Languages size={12} /> Traduction rapide</div>
      <form onSubmit={traduire} className="flex gap-2 mb-2 flex-wrap">
        <Champ value={texte} onChange={e => setTexte(e.target.value)} placeholder="Texte à traduire…" className="flex-1 min-w-[10rem]" />
        <Select value={cible} onChange={e => setCible(e.target.value)}>{LANGUES.map(l => <option key={l}>{l}</option>)}</Select>
        <Bouton variante="primaire" type="submit" disabled={charge}><Sparkles size={16} />{charge ? '…' : 'Traduire'}</Bouton>
      </form>
      {res && (
        <div className="flex items-center gap-2 bg-fond rounded border border-[var(--bordure)] px-3 py-2">
          <span className="flex-1 text-sm text-fort">{res}</span>
          {!res.startsWith('⚠️') && <Bouton onClick={() => onAjouter(cible, texte, res)}><Plus size={14} /> Au carnet</Bouton>}
        </div>
      )}
    </Carte>
  )
}

export default function Vocabulaire() {
  const [mots, setMots] = useState([])
  const [f, setF] = useState({ langue: 'Anglais', mot: '', traduction: '', exemple: '' })
  const [filtre, setFiltre] = useState('Toutes')
  const [entrainement, setEntrainement] = useState(false)
  const [i, setI] = useState(0)
  const [montre, setMontre] = useState(false)

  const charger = () => api.get('/vocab').then(setMots)
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!f.mot.trim() || !f.traduction.trim()) return
    await api.post('/vocab', { ...f, mot: f.mot.trim(), traduction: f.traduction.trim() })
    setF({ ...f, mot: '', traduction: '', exemple: '' }); charger()
  }
  const supprimer = (id) => api.del('/vocab/' + id).then(charger)
  // Ajoute une entrée depuis le traducteur (langue cible = langue du mot traduit)
  async function ajouterDepuisTrad(cible, source, traduction) {
    await api.post('/vocab', { langue: cible, mot: traduction, traduction: source, exemple: '' }); charger()
  }
  const visibles = filtre === 'Toutes' ? mots : mots.filter(m => m.langue === filtre)

  // ===== Mode entraînement (cache la traduction) =====
  if (entrainement && visibles.length > 0) {
    const m = visibles[i % visibles.length]
    return (
      <div className="max-w-xl mx-auto">
        <EnTete section="LANGUES" titre="Entraînement" action={<Bouton onClick={() => setEntrainement(false)}>Quitter</Bouton>} />
        <div className="eyebrow mb-2">{m.langue} · {i + 1}/{visibles.length}</div>
        <Carte className="p-8 text-center min-h-[14rem] flex flex-col justify-center">
          <p className="text-fort text-2xl mb-4">{m.mot}</p>
          {montre ? <>
            <p className="text-accent text-lg mb-2">{m.traduction}</p>
            {m.exemple && <p className="text-faible text-sm italic">{m.exemple}</p>}
          </> : <Bouton variante="primaire" onClick={() => setMontre(true)} className="mx-auto"><Eye size={16} /> Révéler</Bouton>}
        </Carte>
        <Bouton variante="primaire" onClick={() => { setMontre(false); setI(i + 1) }} className="w-full mt-3"><ArrowRight size={16} /> Suivant</Bouton>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <EnTete section="LANGUES" titre="Carnet de vocabulaire" action={
        <div className="flex gap-2"><ExportData rows={mots} nom="vocabulaire" /><Bouton variante="primaire" onClick={() => { setEntrainement(true); setI(0); setMontre(false) }} disabled={!visibles.length}>S'entraîner</Bouton></div>
      } />
      <Traducteur onAjouter={ajouterDepuisTrad} />
      <form onSubmit={ajouter} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <Select value={f.langue} onChange={e => setF({ ...f, langue: e.target.value })}>{LANGUES.map(l => <option key={l}>{l}</option>)}</Select>
          <Champ value={f.mot} onChange={e => setF({ ...f, mot: e.target.value })} placeholder="Mot" />
          <Champ value={f.traduction} onChange={e => setF({ ...f, traduction: e.target.value })} placeholder="Traduction" />
        </div>
        <div className="flex gap-2">
          <Champ value={f.exemple} onChange={e => setF({ ...f, exemple: e.target.value })} placeholder="Exemple (optionnel)" />
          <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
        </div>
      </form>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {['Toutes', ...LANGUES].map(l => (
          <button key={l} onClick={() => setFiltre(l)} className={`t h-6 px-2 rounded border text-xs ${filtre === l ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>{l}</button>
        ))}
      </div>
      <Carte className="divide-y divide-[var(--bordure)]">
        {visibles.map(m => (
          <div key={m.id} className="group flex items-center gap-3 px-4 h-12">
            <span className="eyebrow w-16 shrink-0">{m.langue}</span>
            <span className="text-sm text-fort w-32 truncate">{m.mot}</span>
            <span className="flex-1 text-sm text-normal truncate">{m.traduction}</span>
            <BoutonIcone onClick={() => supprimer(m.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
          </div>
        ))}
        {visibles.length === 0 && <div className="px-4 py-8 text-center text-faible text-sm">Aucun mot.</div>}
      </Carte>
    </div>
  )
}
