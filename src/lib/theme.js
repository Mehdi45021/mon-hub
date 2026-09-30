import { useEffect, useState } from 'react'

// Store de préférences d'apparence : thème, couleur d'accent, densité.
// Persisté en localStorage, appliqué via data-* sur <html>.
const DEFAUTS = { theme: 'dark', accent: 'ambre', densite: 'normal' }
let prefs = { ...DEFAUTS, ...(JSON.parse(localStorage.getItem('prefs') || '{}')) }
// Migration de l'ancienne clé 'theme'
const ancien = localStorage.getItem('theme')
if (ancien && !localStorage.getItem('prefs')) prefs.theme = ancien

const abonnes = new Set()
function appliquer() {
  const r = document.documentElement
  r.dataset.theme = prefs.theme
  r.dataset.accent = prefs.accent
  r.dataset.densite = prefs.densite
  localStorage.setItem('prefs', JSON.stringify(prefs))
  // Informe la coque iOS pour que la barre d'état reste lisible
  try { window.webkit?.messageHandlers?.theme?.postMessage(prefs.theme) } catch {}
  abonnes.forEach(f => f({ ...prefs }))
}
appliquer()

export function usePrefs() {
  const [p, setP] = useState({ ...prefs })
  useEffect(() => { abonnes.add(setP); return () => abonnes.delete(setP) }, [])
  return {
    prefs: p,
    definir(cle, valeur) { prefs = { ...prefs, [cle]: valeur }; appliquer() },
    basculerTheme() { prefs = { ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' }; appliquer() }
  }
}

// Compat : ancien hook utilisé par Réglages
export function useTheme() {
  const { prefs: p, basculerTheme } = usePrefs()
  return { theme: p.theme, basculer: basculerTheme }
}
