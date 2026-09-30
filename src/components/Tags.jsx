import { useEffect, useState } from 'react'
import { Tag, Plus, X } from 'lucide-react'
import { api } from '../lib/api'

const COULEURS = ['#E0915C', '#5FB37A', '#E5675E', '#9CA0A8', '#7AA2E3', '#C792E0']

// Pastille tag (point couleur + nom)
export function Pastille({ t, onRetirer }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded border border-[var(--bordure)] text-xs text-normal">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.couleur }} />
      {t.nom}
      {onRetirer && <button onClick={onRetirer} className="text-faible hover:text-alerte"><X size={12} /></button>}
    </span>
  )
}

// Barre d'étiquettes d'un élément : afficher / ajouter / retirer. Réutilisable partout.
export default function TagBar({ type, id, onChange }) {
  const [mine, setMine] = useState([])
  const [tous, setTous] = useState([])
  const [ouvert, setOuvert] = useState(false)
  const [nouveau, setNouveau] = useState('')

  const charger = () => {
    api.get(`/tags/of/${type}/${id}`).then(m => { setMine(m); onChange?.(m) })
    api.get('/tags').then(setTous)
  }
  useEffect(() => { if (id) charger() }, [type, id])

  const aMoi = (tid) => mine.some(t => t.id === tid)
  async function basculer(t) {
    if (aMoi(t.id)) await api.post('/tags/detach', { tag_id: t.id, item_type: type, item_id: id })
    else await api.post('/tags/attach', { tag_id: t.id, item_type: type, item_id: id })
    charger()
  }
  async function creer() {
    if (!nouveau.trim()) return
    const t = await api.post('/tags', { nom: nouveau.trim(), couleur: COULEURS[tous.length % COULEURS.length] })
    setNouveau(''); await api.post('/tags/attach', { tag_id: t.id, item_type: type, item_id: id }); charger()
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap relative">
      {mine.map(t => <Pastille key={t.id} t={t} onRetirer={() => basculer(t)} />)}
      <button onClick={() => setOuvert(o => !o)} className="t inline-flex items-center justify-center h-6 px-2 rounded border border-[var(--bordure)] text-faible hover:text-fort hover:bg-surface-haute text-xs">
        <Tag size={12} className="mr-1" />Tag
      </button>
      {ouvert && (
        <div className="absolute z-20 top-7 left-0 w-56 bg-surface border border-[var(--bordure)] rounded shadow-2xl p-2">
          <div className="max-h-40 overflow-auto space-y-0.5 mb-2">
            {tous.map(t => (
              <button key={t.id} onClick={() => basculer(t)}
                className={`t w-full flex items-center gap-2 px-2 h-7 rounded text-xs ${aMoi(t.id) ? 'bg-surface-haute text-fort' : 'text-normal hover:bg-surface-haute'}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.couleur }} />
                <span className="flex-1 text-left">{t.nom}</span>
                {aMoi(t.id) && <X size={11} className="text-faible" />}
              </button>
            ))}
            {tous.length === 0 && <div className="text-faible text-xs px-2 py-1">Aucun tag.</div>}
          </div>
          <div className="flex gap-1">
            <input value={nouveau} onChange={e => setNouveau(e.target.value)} onKeyDown={e => e.key === 'Enter' && creer()}
              placeholder="Nouveau tag…" className="flex-1 h-7 px-2 rounded border border-[var(--bordure)] bg-fond text-xs text-fort outline-none focus:border-accent/60" />
            <button onClick={creer} className="h-7 w-7 flex items-center justify-center rounded border border-[var(--bordure)] text-faible hover:text-fort"><Plus size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
