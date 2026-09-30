import { useEffect, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, Sparkles } from 'lucide-react'
import { api } from './lib/api'
import Mascotte from './components/Mascotte'

// Le questionnaire d'arrivée : une question par écran, comme Duolingo.
// Chaque réponse règle vraiment l'app — ce n'est pas un formulaire décoratif.
export default function Onboarding({ onFini }) {
  const [questions, setQuestions] = useState([])
  const [i, setI] = useState(-1)              // -1 = écran d'accueil
  const [rep, setRep] = useState({})
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => { api.get('/profil/questions').then(setQuestions) }, [])
  if (!questions.length) return null

  const q = questions[i]
  const valeur = q ? rep[q.id] : null
  const repondu = q?.multi ? (valeur?.length > 0) : !!valeur
  const progression = Math.round(((i + 1) / (questions.length + 1)) * 100)

  function choisir(opt) {
    if (q.multi) {
      const liste = rep[q.id] || []
      setRep({ ...rep, [q.id]: liste.includes(opt) ? liste.filter(x => x !== opt) : [...liste, opt] })
    } else {
      setRep({ ...rep, [q.id]: opt })
      setTimeout(() => suivant(opt), 220)     // enchaînement fluide sur choix unique
    }
  }

  async function suivant(forcee) {
    if (i + 1 < questions.length) return setI(i + 1)
    setEnvoi(true)
    await api.post('/profil', { reponses: { ...rep, ...(forcee && q ? { [q.id]: forcee } : {}) } })
    onFini()
  }

  // ===== Accueil du questionnaire =====
  if (i === -1) return (
    <Cadre>
      <div className="flex-1 flex flex-col justify-center items-center text-center module-enter">
        <Mascotte />
        <h1 className="titre text-[28px] mt-6 mb-3">Fais connaissance</h1>
        <p className="text-normal text-[16px] leading-relaxed max-w-[19rem] mb-2">
          15 questions rapides pour que ton assistant sache <span className="text-fort">comment tu fonctionnes</span>.
        </p>
        <p className="text-faible text-[14px]">Moins de deux minutes. Tout est modifiable après.</p>
      </div>
      <button onClick={() => setI(0)}
        className="t w-full h-[52px] rounded-2xl bg-accent text-fond font-semibold text-[16px]
          flex items-center justify-center gap-2 active:scale-[0.98]">
        C'est parti <ArrowRight size={18} />
      </button>
    </Cadre>
  )

  // ===== Une question par écran =====
  return (
    <Cadre>
      {/* Progression */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => setI(i - 1)} disabled={i === 0}
          className="t w-9 h-9 flex items-center justify-center rounded-full text-faible disabled:opacity-0 active:bg-surface-haute">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 h-2 rounded-full bg-surface-haute overflow-hidden">
          <div className="h-full rounded-full bg-accent jauge" style={{ width: progression + '%' }} />
        </div>
        <span className="text-faible text-[13px] tabular-nums w-10 text-right">{i + 1}/{questions.length}</span>
      </div>

      <div key={q.id} className="flex-1 module-enter">
        <h2 className="titre text-[24px] leading-snug mb-1">{q.q}</h2>
        <p className="text-faible text-[14px] mb-6">
          {q.multi ? 'Plusieurs réponses possibles' : 'Choisis une réponse'}
        </p>

        <div className="space-y-2.5">
          {q.options.map((opt, k) => {
            const on = q.multi ? (valeur || []).includes(opt) : valeur === opt
            return (
              <button key={opt} onClick={() => choisir(opt)}
                style={{ animationDelay: (k * 40) + 'ms' }}
                className={`item-enter t w-full min-h-[54px] px-4 rounded-2xl border flex items-center gap-3 text-left
                  ${on ? 'border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]'
                       : 'border-[var(--bordure)] bg-surface active:bg-surface-haute'}`}>
                <span className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center
                  ${on ? 'border-accent bg-accent' : 'border-[var(--bordure)]'}`}>
                  {on && <Check size={13} className="text-fond" strokeWidth={3.5} />}
                </span>
                <span className={`text-[16px] ${on ? 'text-fort font-medium' : 'text-normal'}`}>{opt}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Le bouton n'apparaît que pour les choix multiples */}
      {q.multi && (
        <button onClick={() => suivant()} disabled={!repondu || envoi}
          className="t w-full h-[52px] rounded-2xl bg-accent text-fond font-semibold text-[16px]
            flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-30">
          {envoi ? '…' : i + 1 === questions.length ? <>Terminer <Sparkles size={18} /></> : <>Continuer <ArrowRight size={18} /></>}
        </button>
      )}
    </Cadre>
  )
}

function Cadre({ children }) {
  return (
    <div className="min-h-full flex justify-center overflow-auto">
      <div className="w-full max-w-[26rem] flex flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
          minHeight: '100%'
        }}>
        {children}
      </div>
    </div>
  )
}
