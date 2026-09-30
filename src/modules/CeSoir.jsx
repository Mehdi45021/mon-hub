import { useEffect, useRef, useState } from 'react'
import {
  Battery, BatteryLow, Zap, Play, Check, Clock, MoonStar, Plus, X,
  ChevronDown, ChevronUp, Sparkles, Flame, ArrowRight, Coffee
} from 'lucide-react'
import { api } from '../lib/api'
import { Carte, Champ, Bouton } from '../components/ui'
import Mascotte from '../components/Mascotte'

const ETATS = [
  { id: 'cuit', label: 'Cuit', I: BatteryLow, aide: 'On fait le minimum' },
  { id: 'moyen', label: 'Ça va', I: Battery, aide: 'Rythme normal' },
  { id: 'forme', label: 'En forme', I: Zap, aide: 'On avance bien' }
]

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function CeSoir() {
  const [etat, setEtat] = useState(null)       // données serveur
  const [etape, setEtape] = useState('chargement') // pause | checkin | ajout | plan | fini
  const [energie, setEnergie] = useState('moyen')
  const [extras, setExtras] = useState([])
  const [saisie, setSaisie] = useState('')
  const [actif, setActif] = useState(null)     // bloc en cours
  const [reste, setReste] = useState(0)
  const [enMarche, setEnMarche] = useState(false)
  const [bilan, setBilan] = useState(null)
  const [serie, setSerie] = useState(0)
  const [voirTout, setVoirTout] = useState(false)
  const [celebre, setCelebre] = useState(false)
  const tick = useRef(null)

  const charger = async () => {
    const d = await api.get('/soir')
    setEtat(d)
    if (d.plan?.statut === 'fini') setEtape('fini')
    else if (d.plan) setEtape('plan')
    else if (d.enPause) setEtape('pause')
    else setEtape('checkin')
  }
  useEffect(() => { charger(); api.get('/soir/serie').then(r => setSerie(r.serie)) }, [])

  // Minuteur du bloc en cours
  useEffect(() => {
    if (!enMarche) return
    tick.current = setInterval(() => setReste(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(tick.current)
  }, [enMarche])

  const blocs = etat?.blocs || []
  const faits = blocs.filter(b => b.statut === 'fait')
  const restants = blocs.filter(b => b.statut === 'a_faire')
  const courant = restants[0]
  const progression = blocs.length ? Math.round((faits.length / blocs.length) * 100) : 0

  async function generer() {
    const d = await api.post('/soir/generer', { energie, extras })
    setEtat(e => ({ ...e, ...d })); setEtape('plan'); setExtras([])
  }
  async function terminerBloc(b, termine = true) {
    setCelebre(true); setEnMarche(false); setActif(null)
    await api.post(`/soir/bloc/${b.id}/fait`, { termine })
    setTimeout(() => setCelebre(false), 900)
    await charger()
  }
  async function reporter(b) {
    await api.post(`/soir/bloc/${b.id}/reporter`, { quand: 'demain' })
    setActif(null); setEnMarche(false); await charger()
  }
  async function cloturer() {
    const d = await api.post('/soir/terminer', {})
    setBilan(d); setEtape('fini')
    api.get('/soir/serie').then(r => setSerie(r.serie))
  }
  function lancer(b) {
    setActif(b); setReste(b.minutes * 60); setEnMarche(true)
  }

  if (etape === 'chargement') return <div className="text-faible text-sm py-10 text-center">…</div>

  // ===== Célébration (le plaisir : court, net, jamais bloquant) =====
  const Celebration = () => celebre ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pop-check w-24 h-24 rounded-full bg-accent flex items-center justify-center">
        <Check size={44} className="text-fond" strokeWidth={3} />
      </div>
    </div>
  ) : null

  // ===== 1. Pause : l'app légitime le repos AVANT le scroll =====
  if (etape === 'pause') return (
    <div className="max-w-md mx-auto">
      <Celebration />
      <Carte className="p-7 text-center module-enter">
        <div className="w-14 h-14 rounded-2xl bg-surface-haute flex items-center justify-center mx-auto mb-4">
          <Coffee size={26} className="text-accent" />
        </div>
        <h2 className="titre text-xl mb-2">Pose ton sac.</h2>
        <p className="text-normal text-sm mb-1">Tu viens de rentrer, c'est normal d'être mort.</p>
        <p className="text-faible text-sm mb-6">
          Repos validé jusqu'à <span className="text-fort font-medium">{etat.horaires.reprise}</span>. Je te préviens.
        </p>
        <Bouton variante="primaire" onClick={() => setEtape('checkin')} className="w-full h-11">
          Je m'y mets maintenant <ArrowRight size={16} />
        </Bouton>
        <p className="text-faible text-xs mt-4">Ce soir : on s'arrête à {etat.horaires.fin}. Promis.</p>
      </Carte>
    </div>
  )

  // ===== 2. Check-in d'énergie =====
  if (etape === 'checkin') return (
    <div className="max-w-md mx-auto">
      <Celebration />
      <div className="module-enter">
        <div className="mb-6"><Mascotte /></div>
        <h2 className="titre text-xl text-center mb-1">Comment tu te sens ?</h2>
        <p className="text-faible text-sm text-center mb-6">J'adapte le plan à ton état, pas l'inverse.</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {ETATS.map(e => (
            <button key={e.id} onClick={() => setEnergie(e.id)}
              className={`t p-4 rounded-xl border flex flex-col items-center gap-2
                ${energie === e.id ? 'border-accent/60 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'border-[var(--bordure)] active:bg-surface-haute'}`}>
              <e.I size={24} className={energie === e.id ? 'text-accent' : 'text-faible'} />
              <span className={`text-sm ${energie === e.id ? 'text-fort font-medium' : 'text-normal'}`}>{e.label}</span>
              <span className="text-[11px] text-faible text-center leading-tight">{e.aide}</span>
            </button>
          ))}
        </div>
        <Bouton variante="primaire" onClick={() => setEtape('ajout')} className="w-full h-11">
          Continuer <ArrowRight size={16} />
        </Bouton>
      </div>
    </div>
  )

  // ===== 3. « Qu'est-ce que tu as à faire ? » =====
  if (etape === 'ajout') return (
    <div className="max-w-md mx-auto module-enter">
      <Celebration />
      <h2 className="titre text-xl mb-1">Quelque chose à ajouter ?</h2>
      <p className="text-faible text-sm mb-5">Ce que je sais déjà est en dessous — inutile de le retaper.</p>

      <form onSubmit={e => { e.preventDefault(); if (!saisie.trim()) return; setExtras([...extras, { titre: saisie.trim(), minutes: 25 }]); setSaisie('') }}
        className="flex gap-2 mb-3">
        <Champ value={saisie} onChange={e => setSaisie(e.target.value)} placeholder="Ex : finir la fiche de SVT" />
        <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
      </form>

      {extras.map((x, i) => (
        <div key={i} className="flex items-center gap-2 px-3 h-10 mb-1.5 rounded-lg bg-surface border border-[var(--bordure)]">
          <span className="flex-1 text-sm text-fort">{x.titre}</span>
          <button onClick={() => setExtras(extras.filter((_, k) => k !== i))} className="text-faible active:text-alerte"><X size={15} /></button>
        </div>
      ))}

      {etat.connu?.length > 0 && (
        <div className="mt-5 mb-6">
          <div className="eyebrow mb-2">Déjà noté ({etat.connu.length})</div>
          <Carte className="divide-y divide-[var(--bordure)]">
            {etat.connu.slice(0, 6).map((c, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <span className="flex-1 text-sm text-normal truncate">{c.titre}</span>
                {c.echeance && <span className="eyebrow shrink-0">{c.echeance.slice(5)}</span>}
              </div>
            ))}
          </Carte>
        </div>
      )}

      <Bouton variante="primaire" onClick={generer} className="w-full h-11">
        <Sparkles size={16} /> Fais-moi le plan
      </Bouton>
      <button onClick={() => setEtape('checkin')} className="w-full text-center text-xs text-faible mt-3 active:text-fort">Retour</button>
    </div>
  )

  // ===== 5. Journée close =====
  if (etape === 'fini') {
    const b = bilan
    return (
      <div className="max-w-md mx-auto module-enter">
        <Celebration />
        <Carte className="p-7 text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-haute flex items-center justify-center mx-auto mb-4">
            <MoonStar size={26} className="text-accent" />
          </div>
          <h2 className="titre text-xl mb-2">C'est fini pour aujourd'hui.</h2>
          {b ? <>
            <p className="text-normal text-sm mb-1">
              {b.faits} bloc{b.faits > 1 ? 's' : ''} · <span className="text-fort font-medium">{b.minutes} min</span> de travail réel.
            </p>
            {serie > 1 && <p className="text-accent text-sm mb-4 flex items-center justify-center gap-1.5"><Flame size={14} /> {serie} soirs d'affilée</p>}
            {b.demain?.length > 0 && (
              <div className="text-left mt-5 mb-2">
                <div className="eyebrow mb-2">Demain, je m'en occupe</div>
                <Carte className="divide-y divide-[var(--bordure)] bg-fond">
                  {b.demain.map((t, i) => (
                    <div key={i} className="px-3 py-2 text-sm text-normal truncate">{t}</div>
                  ))}
                </Carte>
              </div>
            )}
          </> : <p className="text-normal text-sm mb-2">Ta soirée est déjà close.</p>}
          <p className="text-faible text-sm mt-5">Rien n'est oublié. Tu peux fermer, vraiment.</p>
        </Carte>
      </div>
    )
  }

  // ===== 4. Le plan : UNE chose à la fois =====
  return (
    <div className="max-w-md mx-auto">
      <Celebration />

      {/* Jauge de progression */}
      <div className="mb-5">
        <div className="flex items-end justify-between mb-2">
          <span className="eyebrow">{faits.length} / {blocs.length} fait{faits.length > 1 ? 's' : ''}</span>
          <span className="eyebrow">{restants.reduce((s, b) => s + b.minutes, 0)} min restantes</span>
        </div>
        <div className="h-2 rounded-full bg-surface-haute overflow-hidden">
          <div className="h-full rounded-full bg-accent jauge" style={{ width: progression + '%' }} />
        </div>
      </div>

      {/* Tout est fait → clôture */}
      {!courant ? (
        <Carte className="p-7 text-center module-enter">
          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Check size={30} className="text-fond" strokeWidth={3} />
          </div>
          <h2 className="titre text-xl mb-2">Tout est fait.</h2>
          <p className="text-normal text-sm mb-6">{faits.reduce((s, b) => s + b.minutes, 0)} minutes. C'est réglé pour ce soir.</p>
          <Bouton variante="primaire" onClick={cloturer} className="w-full h-11">
            <MoonStar size={16} /> Clore ma journée
          </Bouton>
        </Carte>
      ) : actif ? (
        // ===== Bloc en cours =====
        <Carte className="p-7 text-center module-enter">
          <div className="eyebrow mb-3">{actif.matiere || 'En cours'}</div>
          <h2 className="titre text-lg mb-5">{actif.titre}</h2>
          <div className="titre tabular-nums mb-1" style={{ fontSize: '56px', lineHeight: 1 }}>{mmss(reste)}</div>
          <p className="text-faible text-sm mb-6">
            {reste > actif.minutes * 60 - 120
              ? 'Juste 2 minutes. Après, tu fais ce que tu veux.'
              : 'Tu es lancé. Continue.'}
          </p>
          {actif.partiel ? (
            <div className="space-y-2">
              <Bouton variante="primaire" onClick={() => terminerBloc(actif, false)} className="w-full">
                <Check size={16} /> J'ai avancé
              </Bouton>
              <Bouton onClick={() => terminerBloc(actif, true)} className="w-full">
                J'ai carrément fini
              </Bouton>
              <Bouton onClick={() => reporter(actif)} className="w-full text-xs">Pas ce soir</Bouton>
            </div>
          ) : (
            <div className="flex gap-2">
              <Bouton onClick={() => reporter(actif)} className="flex-1">Pas ce soir</Bouton>
              <Bouton variante="primaire" onClick={() => terminerBloc(actif)} className="flex-1">
                <Check size={16} /> C'est fait
              </Bouton>
            </div>
          )}
          <button onClick={() => { setActif(null); setEnMarche(false) }}
            className="w-full text-center text-xs text-faible mt-4 active:text-fort">Mettre en pause</button>
        </Carte>
      ) : (
        // ===== La carte unique : quoi faire maintenant =====
        <>
          <Carte className="p-6 module-enter">
            <div className="eyebrow mb-2">Commence par ça</div>
            <h2 className="titre text-xl mb-1">{courant.titre}</h2>
            <p className="text-faible text-sm mb-4">
              {courant.minutes} min{courant.matiere ? ` · ${courant.matiere}` : ''}
            </p>

            {/* Le « pourquoi » : la confiance + l'apprentissage de la méthode */}
            <div className="rounded-lg bg-fond border border-[var(--bordure)] p-3 mb-3">
              <p className="text-sm text-normal italic">{courant.pourquoi}</p>
            </div>

            {/* Le gain futur : « si je le fais maintenant, je ne le regretterai pas » */}
            {courant.gain && (
              <div className="flex items-start gap-2 mb-5">
                <Sparkles size={14} className="text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-accent">{courant.gain}</p>
              </div>
            )}

            <Bouton variante="primaire" onClick={() => lancer(courant)} className="w-full h-12">
              <Play size={17} /> Juste 2 minutes
            </Bouton>
            <div className="flex gap-2 mt-2">
              <Bouton onClick={() => reporter(courant)} className="flex-1 text-xs">Pas ce soir</Bouton>
              {restants.length > 1 && (
                <Bouton onClick={async () => {
                  await api.post(`/soir/bloc/${courant.id}/reporter`, { quand: 'matin' }); charger()
                }} className="flex-1 text-xs">Autre chose</Bouton>
              )}
            </div>
          </Carte>

          {/* Le reste, replié : voir 6 tâches d'un coup, c'est ce qui paralyse */}
          {restants.length > 1 && (
            <div className="mt-4">
              <button onClick={() => setVoirTout(v => !v)}
                className="t w-full flex items-center justify-center gap-1.5 text-xs text-faible py-2 active:text-fort">
                {voirTout ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {voirTout ? 'Masquer' : `Voir le reste (${restants.length - 1})`}
              </button>
              {voirTout && (
                <Carte className="divide-y divide-[var(--bordure)] module-enter">
                  {restants.slice(1).map(b => (
                    <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Clock size={14} className="text-faible shrink-0" />
                      <span className="flex-1 text-sm text-normal truncate">{b.titre}</span>
                      <span className="eyebrow shrink-0">{b.minutes} min</span>
                    </div>
                  ))}
                </Carte>
              )}
            </div>
          )}

          {/* Déjà fait */}
          {faits.length > 0 && (
            <div className="mt-4">
              <div className="eyebrow mb-2">Déjà fait ce soir</div>
              <Carte className="divide-y divide-[var(--bordure)]">
                {faits.map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Check size={14} className="text-accent shrink-0" />
                    <span className="flex-1 text-sm text-faible line-through truncate">{b.titre}</span>
                  </div>
                ))}
              </Carte>
            </div>
          )}

          {/* Sortie de secours : on peut clore avant la fin, sans culpabilité */}
          <button onClick={cloturer}
            className="t w-full text-center text-xs text-faible mt-6 py-2 active:text-fort">
            J'arrête là pour ce soir
          </button>
        </>
      )}
    </div>
  )
}
