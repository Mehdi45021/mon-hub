import { useEffect, useRef, useState } from 'react'
import { Link2, X, Search, ArrowRight, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

// Libellés courts des types pour l'affichage
const TYPE = { tasks: 'Tâche', notes: 'Note', events: 'Événement', homework: 'Devoir', revisions: 'Fiche', snippets: 'Snippet', favoris: 'Favori', flights: 'Vol', vocab: 'Mot', subjects: 'Matière', mddocs: 'Markdown' }

// Panneau Liens + Rétroliens d'un élément. Réutilisable partout (1 ligne).
export default function Liens({ type, id }) {
  const [data, setData] = useState({ sortants: [], entrants: [] })
  const [titres, setTitres] = useState({})
  const [q, setQ] = useState('')
  const [res, setRes] = useState(null)
  const timer = useRef(null)

  const charger = () => api.get(`/links/${type}/${id}`).then(setData)
  useEffect(() => { if (id) charger() }, [type, id])

  // Résout les titres des deux bouts
  useEffect(() => {
    const tout = [...data.sortants.map(l => [l.dst_type, l.dst_id]), ...data.entrants.map(l => [l.src_type, l.src_id])]
    tout.forEach(([t, i]) => {
      const k = t + ':' + i
      if (!(k in titres)) api.get(`/resolve/${t}/${i}`).then(r => setTitres(s => ({ ...s, [k]: r.titre })))
    })
  }, [data])

  // Recherche cible
  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) { setRes(null); return }
    timer.current = setTimeout(() => api.get('/search?q=' + encodeURIComponent(q.trim())).then(setRes), 200)
  }, [q])

  async function lier(dst_type, dst_id) {
    await api.post('/links', { src_type: type, src_id: id, dst_type, dst_id })
    setQ(''); setRes(null); charger()
  }
  const supprimer = (lid) => api.del('/links/' + lid).then(charger)

  const cibles = []
  if (res) ['tasks', 'notes', 'events', 'homework', 'snippets', 'favoris'].forEach(t =>
    (res[t] || []).forEach(x => cibles.push({ type: t, id: x.id, titre: x.titre })))

  return (
    <div>
      <div className="eyebrow mb-2 flex items-center gap-1.5"><Link2 size={12} /> Liens</div>
      <div className="space-y-1 mb-2">
        {data.sortants.map(l => (
          <div key={l.id} className="group flex items-center gap-2 text-xs text-normal">
            <ArrowRight size={12} className="text-faible" />
            <span className="text-faible font-mono">{TYPE[l.dst_type] || l.dst_type}</span>
            <span className="text-fort truncate flex-1">{titres[l.dst_type + ':' + l.dst_id] || '…'}</span>
            <button onClick={() => supprimer(l.id)} className="opacity-0 group-hover:opacity-100 text-faible hover:text-alerte"><X size={12} /></button>
          </div>
        ))}
        {data.entrants.map(l => (
          <div key={l.id} className="flex items-center gap-2 text-xs text-normal">
            <ArrowLeft size={12} className="text-faible" />
            <span className="text-faible font-mono">{TYPE[l.src_type] || l.src_type}</span>
            <span className="text-fort truncate flex-1">{titres[l.src_type + ':' + l.src_id] || '…'}</span>
            <span className="eyebrow">rétrolien</span>
          </div>
        ))}
        {!data.sortants.length && !data.entrants.length && <div className="text-faible text-xs">Aucun lien.</div>}
      </div>
      <div className="relative">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-faible" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Lier à…"
          className="w-full h-7 pl-7 pr-2 rounded border border-[var(--bordure)] bg-fond text-xs text-fort outline-none focus:border-accent/60" />
        {cibles.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-surface border border-[var(--bordure)] rounded shadow-2xl p-1 max-h-44 overflow-auto">
            {cibles.map((c, i) => (
              <button key={i} onClick={() => lier(c.type, c.id)}
                className="t w-full flex items-center gap-2 px-2 h-7 rounded text-xs text-normal hover:bg-surface-haute hover:text-fort">
                <span className="text-faible font-mono">{TYPE[c.type]}</span>
                <span className="truncate">{c.titre}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
