import { useState } from 'react'
import { MoonStar, Home, CheckSquare, MessageSquare, Brain, LayoutGrid, Search, Sun, Moon, ChevronRight, X } from 'lucide-react'
import { MODULES, GROUPES } from './modules'
import { usePrefs } from './lib/theme'

// Onglets du bas (les 5 sections clés). Le reste passe par « Plus ».
const TABS = [
  { id: 'soir', nom: 'Ce soir', icone: MoonStar },
  { id: 'taches', nom: 'Tâches', icone: CheckSquare },
  { id: 'chat', nom: 'Chat', icone: MessageSquare },
  { id: 'cerveau', nom: 'Cerveau', icone: Brain },
  { id: '__plus', nom: 'Plus', icone: LayoutGrid }
]

// Interface iOS : grand titre en haut, contenu, barre d'onglets translucide en bas.
export default function MobileShell({ actif, aller, Module, onSearch }) {
  const [plus, setPlus] = useState(false)
  const { prefs, basculerTheme } = usePrefs()
  const courant = MODULES.find(m => m.id === actif)
  const titre = courant?.nom || 'Mon Hub'
  const tabActif = TABS.some(t => t.id === actif) ? actif : '__plus'
  // Le Chat gère lui-même son plein écran (barre de saisie flottante)
  const pleinEcran = actif === 'chat'

  function choisir(id) { aller(id); setPlus(false) }

  return (
    <div className="flex flex-col h-full">
      {/* En-tête : grand titre façon iOS (flottant au-dessus du chat plein écran) */}
      <header className="ios-blur fixed top-0 inset-x-0 z-30 border-b border-[var(--bordure)]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-end justify-between px-4 pt-2 pb-2.5">
          <h1 className="titre text-2xl">{titre}</h1>
          <div className="flex items-center gap-1">
            <button onClick={onSearch} aria-label="Rechercher"
              className="tap w-10 h-10 flex items-center justify-center rounded-full text-normal active:bg-surface-haute">
              <Search size={20} />
            </button>
            <button onClick={basculerTheme} aria-label="Thème"
              className="tap w-10 h-10 flex items-center justify-center rounded-full text-normal active:bg-surface-haute">
              {prefs.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className={`ios-scroll flex-1 ${pleinEcran ? '' : 'overflow-auto px-4'}`}
        style={pleinEcran ? undefined : {
          paddingTop: 'calc(env(safe-area-inset-top) + 3.75rem)',
          paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))'
        }}>
        {/* Pas d'animation sur le chat : un parent animé (transform) piégerait
            ses éléments en position fixe (barre de saisie flottante). */}
        <div key={actif} className={pleinEcran ? '' : 'module-enter'}>
          <Module />
        </div>
      </main>

      {/* Barre d'onglets flottante — Liquid Glass (iOS 26) */}
      <nav className="fixed inset-x-0 z-30 px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
        <div className="liquid-glass pointer-events-auto mx-auto max-w-md rounded-[26px] px-1.5 py-1.5 flex">
          {TABS.map(t => {
            const Icone = t.icone
            const on = tabActif === t.id
            return (
              <button key={t.id} onClick={() => t.id === '__plus' ? setPlus(true) : aller(t.id)}
                aria-label={t.nom}
                className={`relative flex-1 h-12 rounded-[20px] flex flex-col items-center justify-center gap-0.5 t
                  ${on ? 'glass-pill' : 'active:opacity-50'}`}>
                <Icone size={21} className={on ? 'text-accent' : 'text-faible'} strokeWidth={on ? 2.3 : 1.9} />
                <span className={`text-[10px] leading-none ${on ? 'text-accent font-semibold' : 'text-faible'}`}>{t.nom}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Feuille « Plus » : toutes les sections */}
      {plus && (
        <div className="fixed inset-0 z-40" onClick={() => setPlus(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="sheet-up absolute bottom-0 inset-x-0 max-h-[85%] flex flex-col bg-fond rounded-t-2xl border-t border-[var(--bordure)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>
            {/* Poignée + titre */}
            <div className="pt-2.5 pb-1 flex justify-center"><div className="w-9 h-1 rounded-full bg-surface-haute" /></div>
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="titre text-lg">Toutes les sections</span>
              <button onClick={() => setPlus(false)} className="tap w-9 h-9 flex items-center justify-center rounded-full text-faible active:bg-surface-haute"><X size={18} /></button>
            </div>
            <div className="ios-scroll overflow-auto px-4 pb-4">
              {GROUPES.map(groupe => {
                const items = MODULES.filter(m => m.groupe === groupe)
                if (!items.length) return null
                return (
                  <div key={groupe} className="mb-4">
                    <div className="eyebrow px-1 pb-1.5">{groupe}</div>
                    {/* Liste groupée iOS (coins arrondis, séparateurs internes) */}
                    <div className="bg-surface border border-[var(--bordure)] rounded-xl overflow-hidden">
                      {items.map((m, i) => {
                        const Icone = m.icone
                        const on = actif === m.id
                        return (
                          <button key={m.id} onClick={() => choisir(m.id)}
                            className={`tap w-full flex items-center gap-3 px-3.5 text-left active:bg-surface-haute ${i ? 'border-t border-[var(--bordure)]' : ''}`}>
                            <Icone size={19} className={on ? 'text-accent' : 'text-faible'} />
                            <span className={`flex-1 text-[15px] ${on ? 'text-fort font-medium' : 'text-fort'}`}>{m.nom}</span>
                            <ChevronRight size={17} className="text-faible" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
