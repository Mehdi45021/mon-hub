// ============ COMPOSANTS DE BASE (réutilisés partout) ============
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Bouton — un seul style, deux variantes. Rayon 8, bordure fine, survol surface haute.
export function Bouton({ variante = 'normal', className = '', children, ...p }) {
  const base = 't inline-flex items-center justify-center gap-2 h-9 px-3 rounded border text-sm font-medium disabled:opacity-40 disabled:pointer-events-none'
  const styles = {
    normal: 'border-[var(--bordure)] text-normal bg-transparent hover:bg-surface-haute hover:text-fort',
    primaire: 'btn-primaire', // teinte dérivée de l'accent choisi (voir index.css)
    fantome: 'border-transparent text-normal hover:bg-surface-haute hover:text-fort'
  }
  return <button className={`${base} ${styles[variante]} ${className}`} {...p}>{children}</button>
}

// Bouton icône carré 9x9 (icône 16px texte faible)
export function BoutonIcone({ className = '', children, ...p }) {
  return (
    <button className={`t inline-flex items-center justify-center w-9 h-9 rounded border border-transparent text-faible hover:bg-surface-haute hover:text-fort ${className}`} {...p}>
      {children}
    </button>
  )
}

// Carte — surface + bordure fine 1px, rayon 8.
export function Carte({ className = '', children, ...p }) {
  return <div className={`carte bg-surface border border-[var(--bordure)] rounded ${className}`} {...p}>{children}</div>
}

// Champ texte — fond fond, bordure fine, focus accent (via :focus-visible global + ring).
export function Champ({ className = '', ...p }) {
  return (
    <input
      className={`t w-full h-9 px-3 rounded border border-[var(--bordure)] bg-fond text-sm text-fort placeholder:text-faible focus:border-accent/60 outline-none ${className}`}
      {...p}
    />
  )
}

// Champ mot de passe avec œil « afficher / masquer »
export function ChampMdp({ className = '', ...p }) {
  const [voir, setVoir] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <Champ type={voir ? 'text' : 'password'} className="pr-10" {...p} />
      <button type="button" tabIndex={-1} onClick={() => setVoir(v => !v)}
        title={voir ? 'Masquer' : 'Afficher'}
        className="t absolute right-2.5 top-1/2 -translate-y-1/2 text-faible hover:text-fort">
        {voir ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

// Select aligné sur le style des champs
export function Select({ className = '', children, ...p }) {
  return (
    <select className={`t h-9 px-3 rounded border border-[var(--bordure)] bg-fond text-sm text-fort focus:border-accent/60 outline-none ${className}`} {...p}>
      {children}
    </select>
  )
}

// En-tête de section : eyebrow mono + titre 20.
export function EnTete({ section, titre, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="eyebrow mb-1">SECTION / {section}</div>
        <h1 className="titre text-xl">{titre}</h1>
      </div>
      {action}
    </div>
  )
}
