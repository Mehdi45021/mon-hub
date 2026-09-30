import { useEffect, useState } from 'react'
import { api } from '../lib/api'

// Le compagnon : un petit renard dessiné en SVG (aucune dépendance, aucun poids).
// Son visage change selon l'humeur, et il bouge doucement en permanence.
// taille : 'petit' (barre), 'grand' (accueil)
export default function Mascotte({ taille = 'grand', onClick }) {
  const [m, setM] = useState(null)
  const [salue, setSalue] = useState(false)

  useEffect(() => {
    api.get('/mascotte').then(setM).catch(() => {})
  }, [])

  // Petit signe de la main quand on le touche
  function coucou() {
    setSalue(true); setTimeout(() => setSalue(false), 1200)
    onClick?.()
  }

  if (!m) return null
  const px = taille === 'petit' ? 44 : 132
  const dort = m.humeur === 'endormi'

  return (
    <div className={taille === 'grand' ? 'flex flex-col items-center' : ''}>
      <button onClick={coucou} aria-label={`${m.nom} — ${m.humeur}`}
        className={`t block ${salue ? 'masc-saute' : dort ? 'masc-dort' : 'masc-respire'} active:scale-95`}
        style={{ width: px, height: px }}>
        <Renard humeur={m.humeur} salue={salue} />
      </button>

      {taille === 'grand' && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <span className="titre text-[15px]">{m.nom}</span>
            {m.serie > 1 && (
              <span className="text-[12px] px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent font-medium">
                {m.serie} j
              </span>
            )}
          </div>
          <p className="text-faible text-[13px] mt-1 text-center px-4">{m.phrase}</p>

          {/* Jauge de satiété : le travail, c'est sa nourriture */}
          <div className="w-32 h-1.5 rounded-full bg-surface-haute mt-3 overflow-hidden">
            <div className="h-full rounded-full jauge"
              style={{
                width: m.satiete + '%',
                background: m.satiete < 25 ? 'var(--alerte)' : m.satiete < 60 ? 'var(--accent)' : 'var(--succes)'
              }} />
          </div>
        </>
      )}
    </div>
  )
}

// ===== Le renard, en SVG pur =====
function Renard({ humeur, salue }) {
  const A = 'var(--accent)'
  const dort = humeur === 'endormi'
  const bas = humeur === 'affame' || humeur === 'fatigue'
  const joie = humeur === 'rayonnant'

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      {/* Oreilles */}
      <path d="M22 34 L28 12 L44 26 Z" fill={A} />
      <path d="M78 34 L72 12 L56 26 Z" fill={A} />
      <path d="M26 32 L29 20 L38 27 Z" fill="var(--fond)" opacity=".5" />
      <path d="M74 32 L71 20 L62 27 Z" fill="var(--fond)" opacity=".5" />

      {/* Tête */}
      <ellipse cx="50" cy="52" rx="30" ry="27" fill={A} />
      {/* Museau clair */}
      <ellipse cx="50" cy="62" rx="18" ry="14" fill="var(--fond)" opacity=".35" />

      {/* Yeux */}
      {dort ? (
        <>
          <path d="M34 50 q5 4 10 0" stroke="var(--fond)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M56 50 q5 4 10 0" stroke="var(--fond)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Zzz */}
          <text x="74" y="30" fontSize="13" fill={A} opacity=".8" className="masc-zzz">z</text>
        </>
      ) : (
        <>
          <ellipse cx="39" cy={bas ? 51 : 49} rx="4.2" ry={bas ? 3 : 4.6} fill="var(--fond)" />
          <ellipse cx="61" cy={bas ? 51 : 49} rx="4.2" ry={bas ? 3 : 4.6} fill="var(--fond)" />
          {/* Reflet vivant */}
          <circle cx="40.5" cy="47.5" r="1.5" fill="#fff" opacity=".9" />
          <circle cx="62.5" cy="47.5" r="1.5" fill="#fff" opacity=".9" />
        </>
      )}

      {/* Truffe */}
      <ellipse cx="50" cy="60" rx="4" ry="3" fill="var(--fond)" />

      {/* Bouche selon l'humeur */}
      {joie && <path d="M42 66 q8 8 16 0" stroke="var(--fond)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {humeur === 'content' && <path d="M44 66 q6 5 12 0" stroke="var(--fond)" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {humeur === 'neutre' && <path d="M45 67 h10" stroke="var(--fond)" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {bas && <path d="M44 69 q6 -4 12 0" stroke="var(--fond)" strokeWidth="2.2" fill="none" strokeLinecap="round" />}

      {/* Joues roses quand il est heureux */}
      {joie && <>
        <ellipse cx="28" cy="59" rx="5" ry="3" fill="#fff" opacity=".25" />
        <ellipse cx="72" cy="59" rx="5" ry="3" fill="#fff" opacity=".25" />
      </>}

      {/* Patte qui salue */}
      {salue && (
        <g className="masc-patte" style={{ transformOrigin: '78px 74px' }}>
          <ellipse cx="80" cy="70" rx="7" ry="9" fill={A} />
        </g>
      )}
    </svg>
  )
}
