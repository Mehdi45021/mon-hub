import { useState } from 'react'
import { Download } from 'lucide-react'
import { Bouton } from './ui'

// Télécharge des données en JSON ou CSV. rows = tableau d'objets plats, nom = fichier.
function telecharger(contenu, type, nom) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([contenu], { type }))
  a.download = nom; a.click()
}
function versCSV(rows) {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
}

export default function ExportData({ rows, nom = 'export' }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <div className="relative">
      <Bouton onClick={() => setOuvert(o => !o)}><Download size={16} /> Export</Bouton>
      {ouvert && (
        <div className="absolute right-0 z-20 mt-1 w-32 bg-surface border border-[var(--bordure)] rounded shadow-2xl p-1" onMouseLeave={() => setOuvert(false)}>
          <button onClick={() => { telecharger(JSON.stringify(rows, null, 2), 'application/json', nom + '.json'); setOuvert(false) }} className="t w-full text-left px-2 h-7 rounded text-xs text-normal hover:bg-surface-haute hover:text-fort">JSON</button>
          <button onClick={() => { telecharger(versCSV(rows), 'text/csv', nom + '.csv'); setOuvert(false) }} className="t w-full text-left px-2 h-7 rounded text-xs text-normal hover:bg-surface-haute hover:text-fort">CSV</button>
        </div>
      )}
    </div>
  )
}
