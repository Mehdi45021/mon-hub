import { useState, useEffect } from 'react'
import { Search, Menu, X, Sun, Moon, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { MODULES, GROUPES } from './modules'
import CommandPalette from './components/CommandPalette'
import Landing from './Landing'
import ScanQR from './ScanQR'
import VerifierEmail from './VerifierEmail'
import MobileShell from './MobileShell'
import Onboarding from './Onboarding'
import { onNaviguer } from './lib/nav'
import { api } from './lib/api'
import { usePrefs } from './lib/theme'
import { useMobile } from './lib/useMobile'

export default function App() {
  // Pages publiques accessibles par lien direct (QR mobile, vérification e-mail)
  const chemin = window.location.pathname
  if (chemin === '/qr') return <ScanQR />
  if (chemin === '/verifier') return <VerifierEmail />
  // Pas de session → page d'accueil publique (inscription / connexion)
  if (!localStorage.getItem('token')) return <Landing />
  return <Session />
}

// Le questionnaire d'arrivée passe avant tout le reste
function Session() {
  const [profil, setProfil] = useState(null) // null = on vérifie
  useEffect(() => { api.get('/profil/statut').then(d => setProfil(d.fait)).catch(() => setProfil(true)) }, [])
  if (profil === null) return null
  if (!profil) return <Onboarding onFini={() => setProfil(true)} />
  return <Hub />
}

function Hub() {
  const [actif, setActif] = useState('soir')
  const [palette, setPalette] = useState(false)
  const [menuMobile, setMenuMobile] = useState(false)
  const [replie, setReplie] = useState(localStorage.getItem('sidebar') === 'replie')
  const { prefs, basculerTheme } = usePrefs()
  const mobile = useMobile()

  const Module = MODULES.find(m => m.id === actif).composant

  // Raccourci global ⌘K / Ctrl+K
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Navigation déclenchée depuis un module (widgets cliquables, etc.)
  useEffect(() => onNaviguer(id => { setActif(id); setMenuMobile(false) }), [])

  // Le cerveau observe les sections visitées pour apprendre tes habitudes
  useEffect(() => { api.post('/cerveau/observer', { type: 'section', cle: actif }).catch(() => {}) }, [actif])

  function aller(modId) { setActif(modId); setMenuMobile(false) }
  function basculerSidebar() {
    const v = !replie
    setReplie(v); localStorage.setItem('sidebar', v ? 'replie' : 'ouverte')
  }

  // ===== Interface iOS (iPhone / petit écran) : barre d'onglets en bas =====
  if (mobile) {
    return (
      <>
        <MobileShell actif={actif} aller={aller} Module={Module} onSearch={() => setPalette(true)} />
        <CommandPalette ouvert={palette} onFermer={() => setPalette(false)} onNaviguer={aller} />
      </>
    )
  }

  return (
    <div className="flex h-full">
      {/* ===== Barre latérale (repliable) ===== */}
      <aside className={`fixed md:static z-40 h-full shrink-0 bg-fond border-r border-[var(--bordure)] flex flex-col
        ${replie ? 'md:w-16' : 'md:w-60'} w-60
        ${menuMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} t`}>
        <div className={`h-14 flex items-center border-b border-[var(--bordure)] ${replie ? 'md:justify-center px-3' : 'justify-between px-5'}`}>
          <span className="titre text-base">{replie ? <span className="hidden md:inline">MH</span> : null}<span className={replie ? 'md:hidden' : ''}>Mon&nbsp;Hub</span></span>
          <button className="md:hidden text-faible" onClick={() => setMenuMobile(false)}><X size={16} /></button>
        </div>
        <nav className="flex-1 p-3 overflow-auto overflow-x-hidden">
          {GROUPES.map(groupe => {
            const items = MODULES.filter(m => m.groupe === groupe)
            if (!items.length) return null
            return (
              <div key={groupe} className="mb-3">
                <div className={`eyebrow px-3 pb-1.5 ${replie ? 'md:hidden' : ''}`}>{groupe}</div>
                {replie && <div className="hidden md:block border-t border-[var(--bordure)] mx-2 mb-2" />}
                <div className="space-y-0.5">
                  {items.map(m => {
                    const Icone = m.icone
                    const on = actif === m.id
                    return (
                      <button key={m.id} onClick={() => aller(m.id)} title={m.nom}
                        className={`t group relative w-full flex items-center gap-3 h-9 rounded text-sm
                          ${replie ? 'md:justify-center md:px-0 pl-3 pr-2' : 'pl-3 pr-2'}
                          ${on ? 'bg-surface text-fort' : 'text-normal hover:bg-surface-haute hover:text-fort'}`}>
                        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded bg-accent" />}
                        <Icone size={16} className={`shrink-0 ${on ? 'text-fort' : 'text-faible group-hover:text-fort'}`} />
                        <span className={replie ? 'md:hidden' : ''}>{m.nom}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>
        {/* Replier / déplier (desktop) */}
        <button onClick={basculerSidebar} title={replie ? 'Déplier' : 'Replier'}
          className="t hidden md:flex items-center justify-center h-11 border-t border-[var(--bordure)] text-faible hover:text-fort hover:bg-surface-haute">
          {replie ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </aside>

      {/* Voile mobile */}
      {menuMobile && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMenuMobile(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        {/* ===== En-tête fin ===== */}
        <header className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-[var(--bordure)]">
          <button className="md:hidden text-faible" onClick={() => setMenuMobile(true)}><Menu size={18} /></button>
          {/* Recherche alignée à gauche : ouvre la palette */}
          <button onClick={() => setPalette(true)}
            className="t group flex items-center gap-2 h-9 w-full max-w-sm px-3 rounded border border-[var(--bordure)] text-faible hover:bg-surface-haute text-left">
            <Search size={16} />
            <span className="flex-1 text-sm">Rechercher partout…</span>
            <kbd className="font-mono text-xs border border-[var(--bordure)] rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
          <div className="flex-1" />
          {/* Bascule thème rapide */}
          <button onClick={basculerTheme} title={prefs.theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
            className="t w-9 h-9 flex items-center justify-center rounded border border-transparent text-faible hover:bg-surface-haute hover:text-fort">
            {prefs.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex-1 p-6 md:p-8 overflow-auto">
          {/* Animation d'entrée discrète à chaque changement de section */}
          <div key={actif} className="module-enter">
            <Module />
          </div>
        </main>
      </div>

      <CommandPalette ouvert={palette} onFermer={() => setPalette(false)} onNaviguer={aller} />
    </div>
  )
}
