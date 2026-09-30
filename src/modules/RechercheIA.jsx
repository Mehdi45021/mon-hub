import { useEffect, useRef, useState } from 'react'
import { Search, Globe, HardDrive, Sparkles, ExternalLink, Clock, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'

const MODES = [
  ['auto', 'Auto', Sparkles, 'Cherche d\'abord chez toi, puis sur le web'],
  ['local', 'Mes données', HardDrive, 'Notes, fiches, devoirs, flashcards, vocabulaire'],
  ['web', 'Web', Globe, 'DuckDuckGo + Wikipédia, avec sources']
]

export default function RechercheIA() {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('auto')
  const [periode, setPeriode] = useState(null)
  const [convs, setConvs] = useState([])
  const [convId, setConvId] = useState(null)
  const [fil, setFil] = useState([])
  const [charge, setCharge] = useState(false)
  const [err, setErr] = useState('')
  const bas = useRef(null)

  const chargerConvs = () => api.get('/cerveau/conversations?mode=recherche').then(setConvs)
  useEffect(() => { chargerConvs() }, [])
  useEffect(() => { bas.current?.scrollIntoView({ behavior: 'smooth' }) }, [fil])

  async function ouvrir(id) {
    const d = await api.get('/cerveau/conversations/' + id)
    setConvId(id)
    setFil(d.messages.map(m => ({ role: m.role, contenu: m.contenu, sources: m.sources })))
  }
  async function supprimer(id) {
    await api.del('/cerveau/conversations/' + id)
    if (convId === id) { setConvId(null); setFil([]) }
    chargerConvs()
  }

  async function chercher(e) {
    e.preventDefault()
    if (!q.trim() || charge) return
    setCharge(true); setErr('')
    let id = convId
    if (!id) { const c = await api.post('/cerveau/conversations', { mode: 'recherche' }); id = c.id; setConvId(id) }
    const question = q.trim()
    setFil(f => [...f, { role: 'user', contenu: question }]); setQ('')
    try {
      const d = await api.post('/recherche', { q: question, mode, periode, conv_id: id })
      setFil(f => [...f, { role: 'assistant', contenu: d.reponse, sources: d.sources }])
      chargerConvs()
    } catch (e) { setErr(e.message) } finally { setCharge(false) }
  }

  return (
    <div>
      <EnTete section="GÉNÉRAL" titre="Recherche IA" action={
        <Bouton variante="primaire" onClick={() => { setConvId(null); setFil([]) }}><Plus size={16} /> Nouvelle</Bouton>
      } />

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Carte className="w-56 shrink-0 p-2 overflow-auto hidden md:block">
          <div className="eyebrow px-2 pb-2">Recherches</div>
          {convs.map(c => (
            <div key={c.id} className={`group flex items-center gap-1 rounded ${convId === c.id ? 'bg-surface-haute' : 'hover:bg-surface-haute'}`}>
              <button onClick={() => ouvrir(c.id)} className="flex-1 text-left px-2 py-2 text-xs text-normal truncate">{c.titre}</button>
              <button onClick={() => supprimer(c.id)} className="opacity-0 group-hover:opacity-100 text-faible hover:text-alerte pr-2"><Trash2 size={12} /></button>
            </div>
          ))}
          {convs.length === 0 && <div className="px-2 py-4 text-faible text-xs">Aucune recherche.</div>}
        </Carte>

        <Carte className="flex-1 flex flex-col min-w-0 p-4">
          {/* Choix de la source */}
          <div className="flex items-center gap-1.5 flex-wrap pb-3 mb-3 border-b border-[var(--bordure)]">
            {MODES.map(([v, l, Ic, aide]) => (
              <button key={v} onClick={() => setMode(v)} title={aide}
                className={`t inline-flex items-center gap-1.5 h-8 px-3 rounded border text-xs ${mode === v ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>
                <Ic size={13} /> {l}
              </button>
            ))}
            {mode !== 'local' && (
              <button onClick={() => setPeriode(p => p === 'jour' ? null : 'jour')} title="Limiter aux dernières 24 heures"
                className={`t inline-flex items-center gap-1.5 h-8 px-3 rounded border text-xs ${periode === 'jour' ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>
                <Clock size={13} /> 24 h
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto space-y-4 pr-1">
            {fil.length === 0 && (
              <div className="text-faible text-sm space-y-1">
                <p>Pose une question : l'IA cherche et te répond en citant ses sources.</p>
                <p>Exemples : « définition de l'osmose », « actualité IA des dernières 24 h », « mes fiches sur la Révolution ».</p>
              </div>
            )}
            {fil.map((m, i) => m.role === 'user' ? (
              <div key={i} className="text-sm text-fort font-medium flex items-start gap-2">
                <Search size={14} className="text-accent mt-0.5 shrink-0" />{m.contenu}
              </div>
            ) : (
              <div key={i}>
                <p className="text-sm text-normal whitespace-pre-wrap leading-relaxed">{m.contenu}</p>
                {m.sources?.length > 0 && (
                  <div className="mt-3">
                    <div className="eyebrow mb-1.5">Sources</div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.sources.map((s, k) => (
                        s.url ? (
                          <a key={k} href={s.url} target="_blank" rel="noreferrer"
                            className="t inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--bordure)] text-faible hover:text-accent">
                            <ExternalLink size={10} /> [{s.ref}] {s.titre.slice(0, 40)}
                          </a>
                        ) : (
                          <span key={k} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--bordure)] text-faible">
                            <HardDrive size={10} /> [{s.ref}] {s.type} · {s.titre.slice(0, 34)}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {charge && <div className="eyebrow">{mode === 'local' ? 'Recherche dans tes données…' : 'Recherche en cours…'}</div>}
            {err && <p className="text-alerte text-sm">{err}</p>}
            <div ref={bas} />
          </div>

          <form onSubmit={chercher} className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faible" />
              <Champ value={q} onChange={e => setQ(e.target.value)} placeholder="Ta question…" className="pl-9" />
            </div>
            <Bouton variante="primaire" type="submit" disabled={charge}><Sparkles size={16} /></Bouton>
          </form>
        </Carte>
      </div>
    </div>
  )
}
