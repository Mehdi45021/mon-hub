import { useEffect, useState } from 'react'
import { Settings2, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { api } from '../lib/api'
import { naviguer } from '../lib/nav'
import { EnTete, Carte, Bouton, BoutonIcone } from '../components/ui'

// Widgets disponibles : id → libellé + valeur + section cible (clic).
const WIDGETS = {
  tachesAFaire: { label: 'Tâches à faire', val: s => s.tachesAFaire, vers: 'taches' },
  devoirs: { label: 'Devoirs à rendre', val: s => s.devoirs, vers: 'devoirs' },
  revisions: { label: 'Cartes à réviser', val: s => s.revisions, vers: 'flashcards' },
  evenementsJour: { label: "Événements aujourd'hui", val: s => s.evenementsJour.length, vers: 'calendrier' },
  nbNotes: { label: 'Notes', val: s => s.nbNotes, vers: 'notes' },
  pomodoro: { label: 'Sessions focus', val: s => s.pomodoro, vers: 'pomodoro' }
}
const DEFAUT = ['tachesAFaire', 'devoirs', 'revisions', 'evenementsJour', 'nbNotes', 'pomodoro']

function Stat({ valeur, label, vers }) {
  return (
    <Carte className="p-5 cursor-pointer hover:bg-surface-haute t" onClick={() => naviguer(vers)}>
      <div className="titre text-2xl tabular-nums">{valeur}</div>
      <div className="eyebrow mt-1">{label}</div>
    </Carte>
  )
}

export default function Accueil() {
  const [s, setS] = useState({ tachesAFaire: 0, evenementsJour: [], nbNotes: 0, devoirs: 0, revisions: 0, pomodoro: 0, heuresVol: 0 })
  const [config, setConfig] = useState(DEFAUT)
  const [edit, setEdit] = useState(false)

  useEffect(() => {
    api.get('/summary').then(setS)
    api.get('/settings/dashboard').then(d => { if (Array.isArray(d.valeur)) setConfig(d.valeur) })
  }, [])

  const sauver = (c) => { setConfig(c); api.put('/settings/dashboard', { valeur: c }) }
  const toggle = (id) => sauver(config.includes(id) ? config.filter(x => x !== id) : [...config, id])
  function bouger(i, dir) {
    const c = [...config], j = i + dir
    if (j < 0 || j >= c.length) return
    [c[i], c[j]] = [c[j], c[i]]; sauver(c)
  }

  return (
    <div className="max-w-4xl">
      <EnTete section="ACCUEIL" titre="Résumé du jour" action={
        <Bouton onClick={() => setEdit(e => !e)}>{edit ? <><Check size={16} /> Terminé</> : <><Settings2 size={16} /> Personnaliser</>}</Bouton>
      } />

      {edit ? (
        // Mode édition : activer/désactiver + réordonner
        <Carte className="divide-y divide-[var(--bordure)] mb-6">
          {Object.keys(WIDGETS).map(id => {
            const on = config.includes(id)
            const i = config.indexOf(id)
            return (
              <div key={id} className="flex items-center gap-3 px-4 h-11">
                <button onClick={() => toggle(id)} className={`t w-4 h-4 rounded-sm border flex items-center justify-center ${on ? 'bg-accent border-accent text-fond' : 'border-faible'}`}>{on && <Check size={11} strokeWidth={3} />}</button>
                <span className={`flex-1 text-sm ${on ? 'text-fort' : 'text-faible'}`}>{WIDGETS[id].label}</span>
                {on && <>
                  <BoutonIcone onClick={() => bouger(i, -1)} className="w-7 h-7"><ChevronUp size={15} /></BoutonIcone>
                  <BoutonIcone onClick={() => bouger(i, 1)} className="w-7 h-7"><ChevronDown size={15} /></BoutonIcone>
                </>}
              </div>
            )
          })}
        </Carte>
      ) : (
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {config.filter(id => WIDGETS[id]).map(id => <Stat key={id} valeur={WIDGETS[id].val(s)} label={WIDGETS[id].label} vers={WIDGETS[id].vers} />)}
        </div>
      )}

      <Carte className="p-5 max-w-xl">
        <div className="eyebrow mb-3">Aujourd'hui</div>
        {s.evenementsJour.length === 0
          ? <p className="text-faible text-sm">Aucun événement.</p>
          : <ul className="space-y-2">{s.evenementsJour.map(e => (
              <li key={e.id} className="flex items-center gap-3 text-sm text-fort"><span className="w-1 h-1 rounded-full bg-accent shrink-0" />{e.titre}</li>
            ))}</ul>}
      </Carte>
    </div>
  )
}
