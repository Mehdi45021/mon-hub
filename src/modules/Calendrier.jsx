import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Plus, BookCheck } from 'lucide-react'
import { api } from '../lib/api'
import { naviguer } from '../lib/nav'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const JOURS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
const iso = (d) => d.toISOString().slice(0, 10)
const lundi = (d) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }

export default function Calendrier() {
  const [vue, setVue] = useState('mois')
  const [curseur, setCurseur] = useState(new Date())
  const [events, setEvents] = useState([])
  const [devoirs, setDevoirs] = useState([])
  const [jour, setJour] = useState(null)
  const [titre, setTitre] = useState('')

  const charger = () => { api.get('/events').then(setEvents); api.get('/homework').then(setDevoirs) }
  useEffect(() => { charger() }, [])

  const evJour = (d) => events.filter(e => e.date === d)
  const dvJour = (d) => devoirs.filter(h => h.echeance === d && !h.fait)

  async function ajouter(e) {
    e.preventDefault()
    if (!titre.trim() || !jour) return
    await api.post('/events', { titre: titre.trim(), date: jour }); setTitre(''); charger()
  }

  const annee = curseur.getFullYear(), mois = curseur.getMonth()
  const decalage = (new Date(annee, mois, 1).getDay() + 6) % 7
  const nbJours = new Date(annee, mois + 1, 0).getDate()
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => i + 1)]
  const semaine = Array.from({ length: 7 }, (_, i) => { const d = lundi(curseur); d.setDate(d.getDate() + i); return d })

  function pastille(d) {
    const e = evJour(d).length, dv = dvJour(d).length
    return (e || dv) ? <span className="mt-auto flex gap-0.5">{e > 0 && <span className="w-1 h-1 rounded-full bg-accent" />}{dv > 0 && <span className="w-1 h-1 rounded-full bg-alerte" />}</span> : null
  }
  const titreVue = vue === 'mois' ? `${MOIS[mois]} ${annee}` : `Semaine du ${lundi(curseur).getDate()} ${MOIS[lundi(curseur).getMonth()]}`
  const pas = (n) => vue === 'mois' ? setCurseur(new Date(annee, mois + n, 1)) : setCurseur(d => { const x = new Date(d); x.setDate(x.getDate() + n * 7); return x })

  return (
    <div>
      <EnTete section="CALENDRIER" titre={titreVue} action={
        <div className="flex gap-2">
          <div className="flex gap-1">
            <button onClick={() => setVue('mois')} className={`t h-9 px-3 rounded border text-sm ${vue === 'mois' ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>Mois</button>
            <button onClick={() => setVue('semaine')} className={`t h-9 px-3 rounded border text-sm ${vue === 'semaine' ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>Semaine</button>
          </div>
          <div className="flex gap-1">
            <BoutonIcone onClick={() => pas(-1)}><ChevronLeft size={16} /></BoutonIcone>
            <BoutonIcone onClick={() => pas(1)}><ChevronRight size={16} /></BoutonIcone>
          </div>
        </div>
      } />
      <div className="flex gap-6 flex-wrap items-start">
        {vue === 'mois' ? (
          <Carte className="flex-1 min-w-[20rem] p-4">
            <div className="grid grid-cols-7 gap-1 mb-2">{JOURS.map(j => <div key={j} className="eyebrow text-center">{j}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {cases.map((n, i) => {
                if (!n) return <div key={i} />
                const d = iso(new Date(annee, mois, n)), auj = d === iso(new Date()), on = jour === d
                return (
                  <button key={i} onClick={() => setJour(d)} className={`t aspect-square rounded p-1.5 text-sm flex flex-col items-start border ${on ? 'border-accent text-fort' : 'border-transparent hover:bg-surface-haute'} ${auj && !on ? 'text-fort' : 'text-normal'}`}>
                    <span className={`tabular-nums ${auj ? 'text-accent font-medium' : ''}`}>{n}</span>
                    {pastille(d)}
                  </button>
                )
              })}
            </div>
          </Carte>
        ) : (
          // Vue semaine : colonnes avec événements + devoirs
          <Carte className="flex-1 min-w-[20rem] p-3">
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {semaine.map((d, i) => {
                const dd = iso(d), auj = dd === iso(new Date())
                return (
                  <div key={i} className="min-h-[8rem]">
                    <button onClick={() => setJour(dd)} className={`w-full text-left eyebrow mb-1 ${auj ? 'text-accent' : ''}`}>{JOURS[i]} {d.getDate()}</button>
                    <div className="space-y-1">
                      {evJour(dd).map(e => <div key={'e' + e.id} className="text-xs px-1.5 py-1 rounded bg-surface-haute text-fort truncate">{e.titre}</div>)}
                      {dvJour(dd).map(h => <button key={'h' + h.id} onClick={() => naviguer('devoirs')} className="w-full text-left text-xs px-1.5 py-1 rounded border border-alerte/40 text-alerte truncate flex items-center gap-1"><BookCheck size={11} />{h.titre}</button>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </Carte>
        )}
        <div className="w-72">
          <div className="eyebrow mb-3">{jour || 'Choisis un jour'}</div>
          {jour && <>
            <form onSubmit={ajouter} className="flex gap-2 mb-3">
              <Champ value={titre} onChange={e => setTitre(e.target.value)} placeholder="Événement…" />
              <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
            </form>
            <Carte className="divide-y divide-[var(--bordure)] mb-3">
              {evJour(jour).map(e => (
                <div key={e.id} className="group flex items-center gap-2 px-3 h-10">
                  <span className="flex-1 text-sm text-fort truncate">{e.titre}</span>
                  <BoutonIcone onClick={() => api.del('/events/' + e.id).then(charger)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
                </div>
              ))}
              {evJour(jour).length === 0 && <div className="px-3 py-4 text-faible text-sm">Aucun événement.</div>}
            </Carte>
            {dvJour(jour).length > 0 && <>
              <div className="eyebrow mb-2">Devoirs ce jour</div>
              <Carte className="divide-y divide-[var(--bordure)]">
                {dvJour(jour).map(h => <button key={h.id} onClick={() => naviguer('devoirs')} className="w-full flex items-center gap-2 px-3 h-10 text-left hover:bg-surface-haute t"><BookCheck size={14} className="text-alerte" /><span className="flex-1 text-sm text-fort truncate">{h.titre}</span></button>)}
              </Carte>
            </>}
          </>}
        </div>
      </div>
    </div>
  )
}
