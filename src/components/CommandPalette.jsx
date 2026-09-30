import { useEffect, useRef, useState } from 'react'
import { Search, CornerDownLeft, Plus } from 'lucide-react'
import { MODULES } from '../modules'
import { api } from '../lib/api'

// ============ PALETTE DE COMMANDES ⌘K (pièce maîtresse) ============
// Recherche dans toutes les sections + navigation/création au clavier.
export default function CommandPalette({ ouvert, onFermer, onNaviguer }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const [i, setI] = useState(0)
  const input = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (ouvert) { setQ(''); setRes(null); setI(0); setTimeout(() => input.current?.focus(), 0) }
  }, [ouvert])

  // Recherche débouncée
  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) { setRes(null); return }
    timer.current = setTimeout(() => api.get('/search?q=' + encodeURIComponent(q.trim())).then(setRes), 200)
  }, [q])

  // Construit la liste plate des commandes (nav + créations + résultats)
  const cmds = []
  if (!q.trim()) {
    MODULES.forEach(m => cmds.push({ type: 'nav', label: 'Aller à ' + m.nom, mod: m.id, icone: m.icone }))
    cmds.push({ type: 'create', label: 'Créer une tâche', mod: 'taches', icone: Plus })
    cmds.push({ type: 'create', label: 'Créer une note', mod: 'notes', icone: Plus })
  } else if (res) {
    const g = (arr, mod, hint, fmt) => (arr || []).forEach(x => cmds.push({ type: 'res', label: fmt(x), mod, hint }))
    g(res.tasks, 'taches', 'tâche', t => t.titre)
    g(res.notes, 'notes', 'note', n => n.titre)
    g(res.events, 'calendrier', 'événement', e => `${e.titre} · ${e.date}`)
    g(res.homework, 'devoirs', 'devoir', h => h.titre)
    g(res.revisions, 'fiches', 'fiche', r => r.titre)
    g(res.flashcards, 'flashcards', 'flashcard', c => c.titre)
    g(res.vocab, 'vocab', 'mot', v => v.titre)
    g(res.favoris, 'favoris', 'favori', f => f.titre)
    g(res.files, 'fichiers', 'fichier', f => f.path)
  }
  const max = cmds.length

  function onKey(e) {
    if (e.key === 'Escape') return onFermer()
    if (e.key === 'ArrowDown') { e.preventDefault(); setI(v => Math.min(v + 1, max - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI(v => Math.max(v - 1, 0)) }
    if (e.key === 'Enter' && cmds[i]) { onNaviguer(cmds[i].mod); onFermer() }
  }

  if (!ouvert) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[8vh] md:pt-[12vh] bg-black/40 backdrop-blur-md" onMouseDown={onFermer}>
      <div className="liquid-glass w-full max-w-xl rounded-[22px] overflow-hidden"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
        onMouseDown={e => e.stopPropagation()} onKeyDown={onKey}>
        <div className="flex items-center gap-3 px-4 border-b border-[var(--bordure)]">
          <Search size={17} className="text-faible" />
          <input ref={input} value={q} onChange={e => { setQ(e.target.value); setI(0) }}
            placeholder="Rechercher ou naviguer…"
            className="flex-1 h-12 bg-transparent outline-none text-fort placeholder:text-faible" />
          <kbd className="hidden md:block font-mono text-xs text-faible border border-[var(--bordure)] rounded px-1.5 py-0.5">ESC</kbd>
          <button onClick={onFermer} className="md:hidden text-faible text-sm px-1">OK</button>
        </div>
        <div className="max-h-80 overflow-auto py-2">
          {max === 0 && <div className="px-4 py-6 text-center text-faible text-sm">Aucun résultat.</div>}
          {cmds.map((c, idx) => {
            const Icone = c.icone || Search
            return (
              <button key={idx} onMouseEnter={() => setI(idx)}
                onClick={() => { onNaviguer(c.mod); onFermer() }}
                className={`t w-full flex items-center gap-3 px-4 py-2 text-left ${idx === i ? 'bg-surface-haute text-fort' : 'text-normal'}`}>
                <Icone size={16} className={idx === i ? 'text-accent' : 'text-faible'} />
                <span className="flex-1 truncate text-sm">{c.label}</span>
                {c.hint && <span className="eyebrow">{c.hint}</span>}
                {idx === i && <CornerDownLeft size={14} className="text-faible" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
