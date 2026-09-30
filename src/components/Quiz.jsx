import { useState } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'
import { Carte, Bouton } from './ui'

// QCM interactif à partir de questions [{question, choix:[], reponse:index}]
export default function Quiz({ questions, onFermer }) {
  const [i, setI] = useState(0)
  const [choix, setChoix] = useState(null)
  const [score, setScore] = useState(0)
  const [fini, setFini] = useState(false)

  if (!questions?.length) return null
  const q = questions[i]

  function repondre(idx) {
    if (choix !== null) return
    setChoix(idx)
    if (idx === q.reponse) setScore(s => s + 1)
  }
  function suivant() {
    if (i + 1 >= questions.length) setFini(true)
    else { setI(i + 1); setChoix(null) }
  }
  function recommencer() { setI(0); setChoix(null); setScore(0); setFini(false) }

  if (fini) return (
    <Carte className="p-6 text-center">
      <div className="eyebrow mb-2">Résultat</div>
      <div className="titre text-2xl tabular-nums mb-4">{score}/{questions.length}</div>
      <div className="flex gap-2 justify-center">
        <Bouton onClick={recommencer}><RotateCcw size={16} /> Recommencer</Bouton>
        {onFermer && <Bouton onClick={onFermer}>Fermer</Bouton>}
      </div>
    </Carte>
  )

  return (
    <Carte className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Question {i + 1}/{questions.length}</div>
        {onFermer && <button onClick={onFermer} className="text-faible hover:text-fort"><X size={16} /></button>}
      </div>
      <p className="text-fort text-base mb-4">{q.question}</p>
      <div className="space-y-2 mb-4">
        {q.choix.map((c, idx) => {
          const correct = idx === q.reponse, choisi = choix === idx
          let cls = 'border-[var(--bordure)] text-normal hover:bg-surface-haute hover:text-fort'
          if (choix !== null) {
            if (correct) cls = 'border-succes/60 text-succes'
            else if (choisi) cls = 'border-alerte/60 text-alerte'
            else cls = 'border-[var(--bordure)] text-faible'
          }
          return (
            <button key={idx} onClick={() => repondre(idx)} disabled={choix !== null}
              className={`t w-full flex items-center gap-2 px-3 h-10 rounded border text-sm text-left ${cls}`}>
              <span className="flex-1">{c}</span>
              {choix !== null && correct && <Check size={15} />}
              {choix !== null && choisi && !correct && <X size={15} />}
            </button>
          )
        })}
      </div>
      {choix !== null && <Bouton variante="primaire" onClick={suivant} className="w-full">{i + 1 >= questions.length ? 'Voir le résultat' : 'Suivant'}</Bouton>}
    </Carte>
  )
}
