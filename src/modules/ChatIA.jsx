import { useEffect, useRef, useState } from 'react'
import { Send, Plus, Trash2, Globe, Brain, ExternalLink, MessageSquare, ArrowUp, History, X, Check } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'
import { useMobile } from '../lib/useMobile'
import { md } from '../lib/markdown'

export default function ChatIA() {
  const [convs, setConvs] = useState([])
  const [convId, setConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [texte, setTexte] = useState('')
  const [web, setWeb] = useState(false)   // forcer la recherche web
  const [charge, setCharge] = useState(false)
  const [histo, setHisto] = useState(false)  // feuille d'historique (mobile)
  const bas = useRef(null)
  const mobile = useMobile()

  const chargerConvs = () => api.get('/cerveau/conversations?mode=chat').then(setConvs)
  useEffect(() => { chargerConvs() }, [])
  useEffect(() => { bas.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function nouvelle() {
    const c = await api.post('/cerveau/conversations', { mode: 'chat' })
    setConvId(c.id); setMessages([]); chargerConvs()
    return c.id
  }
  async function ouvrir(id) {
    const d = await api.get('/cerveau/conversations/' + id)
    setConvId(id)
    setMessages(d.messages.map(m => ({ role: m.role, content: m.contenu, sources: m.sources })))
  }
  async function supprimer(id) {
    await api.del('/cerveau/conversations/' + id)
    if (convId === id) { setConvId(null); setMessages([]) }
    chargerConvs()
  }

  async function envoyer(e) {
    e.preventDefault()
    if (!texte.trim() || charge) return
    const id = convId || await nouvelle()
    const suite = [...messages, { role: 'user', content: texte.trim() }]
    setMessages(suite); setTexte(''); setCharge(true)
    try {
      const d = await api.post('/chat', { conv_id: id, web, messages: suite.map(m => ({ role: m.role, content: m.content })) })
      setMessages([...suite, { role: 'assistant', content: d.reponse, sources: d.sources }])
      chargerConvs()
    } catch (err) {
      setMessages([...suite, { role: 'assistant', content: err.message }])
    } finally { setCharge(false) }
  }

  // ===== Version iPhone : interface façon ChatGPT =====
  if (mobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 4.25rem)' }}>
        {/* Conversation */}
        <div className="ios-scroll flex-1 overflow-auto px-4"
          style={{ paddingBottom: 'calc(9.5rem + env(safe-area-inset-bottom))' }}>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 -mt-16">
              <div className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center mb-4">
                <Brain size={26} className="text-accent" />
              </div>
              <p className="titre text-lg mb-1">Comment puis-je t'aider ?</p>
              <p className="text-faible text-sm">Je connais tes tâches, tes devoirs et tes notes.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="py-1.5">
              {m.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-4 py-2.5 rounded-[20px] bg-surface-haute text-fort text-[15px] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="chat-md text-[15px] text-fort leading-relaxed px-0.5"
                  dangerouslySetInnerHTML={{ __html: md(m.content) }} />
              )}
              {m.sources?.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {m.sources.filter(s => s.url).map((s, k) => (
                    <a key={k} href={s.url} target="_blank" rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full liquid-glass text-normal">
                      <ExternalLink size={11} /> {s.titre.slice(0, 26)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {charge && (
            <div className="flex items-center gap-2 py-2 text-faible text-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {web ? 'Recherche sur le web…' : 'Réflexion…'}
            </div>
          )}
          <div ref={bas} />
        </div>

        {/* Barre de saisie flottante — Liquid Glass */}
        <div className="fixed inset-x-0 px-3 z-20"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)' }}>
          <form onSubmit={envoyer} className="liquid-glass rounded-[24px] flex items-end gap-1.5 p-1.5">
            <button type="button" onClick={() => { chargerConvs(); setHisto(true) }} aria-label="Mes discussions"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-normal active:opacity-50">
              <History size={21} />
            </button>
            <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(e) } }}
              placeholder="Message"
              className="saisie-chat flex-1 bg-transparent outline-none resize-none py-2.5 max-h-32 text-fort placeholder:text-faible" />
            <button type="button" onClick={() => setWeb(w => !w)} aria-label="Chercher sur le web"
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${web ? 'text-accent glass-pill' : 'text-normal'} active:opacity-50`}>
              <Globe size={20} />
            </button>
            <button type="submit" disabled={!texte.trim() || charge} aria-label="Envoyer"
              className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-accent text-fond disabled:opacity-25 active:opacity-70">
              <ArrowUp size={20} strokeWidth={2.6} />
            </button>
          </form>
        </div>

        {/* Historique des discussions (feuille iOS) */}
        {histo && (
          <div className="fixed inset-0 z-40" onClick={() => setHisto(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="sheet-up absolute bottom-0 inset-x-0 max-h-[80%] flex flex-col bg-fond rounded-t-2xl border-t border-[var(--bordure)]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
              <div className="pt-2.5 pb-1 flex justify-center"><div className="w-9 h-1 rounded-full bg-surface-haute" /></div>
              <div className="flex items-center justify-between px-4 pb-3">
                <span className="titre text-lg">Mes discussions</span>
                <div className="flex items-center gap-1">
                  <button onClick={async () => { await nouvelle(); setHisto(false) }}
                    className="tap px-3 h-9 flex items-center gap-1.5 rounded-full text-accent text-sm active:bg-surface-haute">
                    <Plus size={16} /> Nouvelle
                  </button>
                  <button onClick={() => setHisto(false)}
                    className="tap w-9 h-9 flex items-center justify-center rounded-full text-faible active:bg-surface-haute"><X size={18} /></button>
                </div>
              </div>
              <div className="ios-scroll overflow-auto px-4 pb-4">
                <div className="bg-surface border border-[var(--bordure)] rounded-xl overflow-hidden">
                  {convs.map((c, i) => (
                    <div key={c.id} className={`flex items-center ${i ? 'border-t border-[var(--bordure)]' : ''}`}>
                      <button onClick={async () => { await ouvrir(c.id); setHisto(false) }}
                        className="tap flex-1 text-left px-3.5 py-3 active:bg-surface-haute min-w-0">
                        <div className={`text-[15px] truncate ${convId === c.id ? 'text-accent' : 'text-fort'}`}>{c.titre}</div>
                        <div className="text-xs text-faible">{new Date(c.maj).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
                      </button>
                      {convId === c.id && <Check size={16} className="text-accent shrink-0" />}
                      <button onClick={() => supprimer(c.id)}
                        className="tap w-11 h-11 flex items-center justify-center text-faible active:text-alerte"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  {convs.length === 0 && <div className="px-3.5 py-6 text-faible text-sm text-center">Aucune discussion pour l'instant.</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <EnTete section="ASSISTANT" titre="Chat IA" action={
        <Bouton variante="primaire" onClick={nouvelle}><Plus size={16} /> Nouvelle</Bouton>
      } />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        {/* Historique */}
        <Carte className="w-56 shrink-0 p-2 overflow-auto hidden md:block">
          <div className="eyebrow px-2 pb-2">Discussions</div>
          {convs.map(c => (
            <div key={c.id} className={`group flex items-center gap-1 rounded ${convId === c.id ? 'bg-surface-haute' : 'hover:bg-surface-haute'}`}>
              <button onClick={() => ouvrir(c.id)} className="flex-1 text-left px-2 py-2 text-xs text-normal truncate">{c.titre}</button>
              <button onClick={() => supprimer(c.id)} className="opacity-0 group-hover:opacity-100 text-faible hover:text-alerte pr-2"><Trash2 size={12} /></button>
            </div>
          ))}
          {convs.length === 0 && <div className="px-2 py-4 text-faible text-xs">Aucune discussion.</div>}
        </Carte>

        {/* Fil */}
        <Carte className="flex-1 flex flex-col min-w-0 p-4">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[var(--bordure)]">
            <Brain size={14} className="text-accent" />
            <span className="text-xs text-faible flex-1">L'IA connaît ton profil et tes données.</span>
            <button onClick={() => setWeb(w => !w)} title="Chercher sur le web"
              className={`t inline-flex items-center gap-1.5 h-7 px-2.5 rounded border text-xs ${web ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>
              <Globe size={13} /> Web
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-3 pr-1">
            {messages.length === 0 && (
              <div className="text-faible text-sm">
                <p className="mb-2">Pose une question sur tes tâches, devoirs, notes, fiches — ou demande d'en créer.</p>
                <p>Active <b className="text-normal">Web</b> pour chercher une définition ou l'actualité des dernières 24 h.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`max-w-[85%] px-3 py-2 rounded border text-sm leading-relaxed
                  ${m.role === 'user' ? 'ml-auto bg-surface-haute border-[var(--bordure)] text-fort whitespace-pre-wrap' : 'bg-fond border-[var(--bordure)] text-normal chat-md'}`}>
                  {m.role === 'user' ? m.content : <span dangerouslySetInnerHTML={{ __html: md(m.content) }} />}
                </div>
                {m.sources?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 max-w-[85%]">
                    {m.sources.map((s, k) => s.url ? (
                      <a key={k} href={s.url} target="_blank" rel="noreferrer"
                        className="t inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--bordure)] text-faible hover:text-accent">
                        <ExternalLink size={10} /> [{s.ref}] {s.titre.slice(0, 34)}
                      </a>
                    ) : null)}
                  </div>
                )}
              </div>
            ))}
            {charge && <div className="eyebrow">{web ? 'Recherche sur le web…' : 'L\'assistant réfléchit…'}</div>}
            <div ref={bas} />
          </div>

          <form onSubmit={envoyer} className="flex gap-2 mt-3">
            <Champ value={texte} onChange={e => setTexte(e.target.value)}
              placeholder={web ? 'Cherche sur le web…' : 'Ton message…'} />
            <Bouton variante="primaire" type="submit" disabled={charge}><Send size={16} /></Bouton>
          </form>
        </Carte>
      </div>
    </div>
  )
}
