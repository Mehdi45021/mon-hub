import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { md } from '../lib/markdown'
import { EnTete, Carte, Bouton, BoutonIcone } from '../components/ui'

export default function Markdown() {
  const [docs, setDocs] = useState([])
  const [sel, setSel] = useState(null)
  const [etat, setEtat] = useState('')
  const timer = useRef(null)

  const charger = () => api.get('/mddocs').then(setDocs)
  useEffect(() => { charger() }, [])

  async function nouveau() { const d = await api.post('/mddocs', { titre: 'Sans titre', contenu: '# Titre\n\nÉcris en **markdown**…', maj: Date.now() }); await charger(); setSel(d) }
  async function supprimer(id) { await api.del('/mddocs/' + id); if (sel?.id === id) setSel(null); charger() }
  function modifier(champ, val) {
    const maj = { ...sel, [champ]: val }
    setSel(maj); setEtat('Modifié…')
    setDocs(ds => ds.map(x => x.id === maj.id ? maj : x))
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => { await api.put('/mddocs/' + maj.id, { titre: maj.titre, contenu: maj.contenu, maj: Date.now() }); setEtat('Enregistré'); charger() }, 600)
  }

  return (
    <div>
      <EnTete section="DÉVELOPPEMENT" titre="Bloc-notes Markdown" action={<Bouton variante="primaire" onClick={nouveau}><Plus size={16} /> Nouveau</Bouton>} />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Carte className="w-52 shrink-0 p-2 overflow-auto">
          {docs.map(d => (
            <button key={d.id} onClick={() => { setSel(d); setEtat('') }} className={`t w-full text-left px-3 h-9 flex items-center rounded text-sm truncate ${sel?.id === d.id ? 'bg-surface-haute text-fort' : 'text-normal hover:bg-surface-haute hover:text-fort'}`}>{d.titre}</button>
          ))}
          {docs.length === 0 && <div className="px-3 py-6 text-faible text-sm">Aucun doc.</div>}
        </Carte>
        {sel ? (
          <Carte className="flex-1 p-0 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-11 border-b border-[var(--bordure)]">
              <input value={sel.titre} onChange={e => modifier('titre', e.target.value)} className="flex-1 bg-transparent text-sm text-fort outline-none" placeholder="Titre" />
              <span className="eyebrow">{etat}</span>
              <BoutonIcone onClick={() => supprimer(sel.id)} className="hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
            <div className="flex-1 grid grid-cols-2 overflow-hidden">
              <textarea value={sel.contenu} onChange={e => modifier('contenu', e.target.value)} className="p-4 bg-transparent font-mono text-sm text-normal leading-relaxed outline-none resize-none border-r border-[var(--bordure)]" />
              <div className="p-4 overflow-auto prose-hub" dangerouslySetInnerHTML={{ __html: md(sel.contenu) }} />
            </div>
          </Carte>
        ) : <Carte className="flex-1 flex"><div className="m-auto text-faible text-sm">Sélectionne ou crée un document.</div></Carte>}
      </div>
    </div>
  )
}
