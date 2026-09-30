import { useEffect, useRef, useState } from 'react'
import { Brain, Plus, Trash2, User, Briefcase, Activity, Sparkles, X } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'

// ===== Réseau neuronal animé : chaque nœud = une catégorie de ce que le cerveau sait =====
function Reseau({ groupes }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    let anim, t = 0
    const style = getComputedStyle(document.documentElement)
    const accent = style.getPropertyValue('--accent').trim() || '#E0915C'
    const faible = style.getPropertyValue('--faible').trim() || '#5C616B'

    function dimensionner() {
      const r = canvas.getBoundingClientRect()
      canvas.width = r.width * dpr; canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    dimensionner()
    window.addEventListener('resize', dimensionner)

    // Positions en couches : noyau central → sphères → catégories
    const noeuds = []
    const L = canvas.getBoundingClientRect()
    const cx = L.width / 2, cy = L.height / 2
    noeuds.push({ x: cx, y: cy, r: 13, label: 'MOI', couche: 0 })
    const spheres = Object.keys(groupes)
    spheres.forEach((s, i) => {
      const a = (i / Math.max(spheres.length, 1)) * Math.PI * 2 - Math.PI / 2
      noeuds.push({ x: cx + Math.cos(a) * 78, y: cy + Math.sin(a) * 78, r: 8, label: s, couche: 1, parent: 0 })
    })
    spheres.forEach((s, i) => {
      const cats = groupes[s]
      const base = 1 + i
      cats.forEach((c, j) => {
        const a = (i / Math.max(spheres.length, 1)) * Math.PI * 2 - Math.PI / 2
          + (j - (cats.length - 1) / 2) * 0.42
        const d = 160 + (j % 2) * 26
        noeuds.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: 3 + Math.min(c.n, 6) * 0.8, label: c.nom, couche: 2, parent: base })
      })
    })

    function boucle() {
      t += 0.016
      ctx.clearRect(0, 0, L.width, L.height)
      // Connexions avec impulsion lumineuse
      noeuds.forEach((n, i) => {
        if (n.parent === undefined) return
        const p = noeuds[n.parent]
        ctx.strokeStyle = faible + '55'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke()
        // impulsion qui circule le long de l'axone
        const k = ((t * 0.35 + i * 0.13) % 1)
        const px = p.x + (n.x - p.x) * k, py = p.y + (n.y - p.y) * k
        ctx.fillStyle = accent; ctx.globalAlpha = 0.85 * (1 - Math.abs(k - 0.5) * 2) + 0.15
        ctx.beginPath(); ctx.arc(px, py, 1.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1
      })
      // Nœuds (pulsation douce)
      noeuds.forEach((n, i) => {
        const pulse = 1 + Math.sin(t * 1.6 + i) * 0.09
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * pulse, 0, 7)
        ctx.fillStyle = n.couche === 0 ? accent : n.couche === 1 ? accent + 'AA' : faible
        ctx.fill()
        if (n.couche === 0) { ctx.strokeStyle = accent + '44'; ctx.lineWidth = 8; ctx.stroke() }
        if (n.couche <= 1) {
          ctx.fillStyle = style.getPropertyValue('--fort').trim() || '#ECEDEF'
          ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(n.label.toUpperCase(), n.x, n.y - n.r - 7)
        }
      })
      anim = requestAnimationFrame(boucle)
    }
    boucle()
    return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', dimensionner) }
  }, [groupes])

  return <canvas ref={ref} className="w-full h-[300px]" />
}

const SPHERES = [['perso', 'Perso', User], ['pro', 'Pro / Scolaire', Briefcase]]

export default function Cerveau() {
  const [faits, setFaits] = useState([])
  const [syn, setSyn] = useState(null)
  const [sphere, setSphere] = useState('perso')
  const [ajout, setAjout] = useState(null) // {categorie, cle, valeur}

  const charger = () => {
    api.get('/cerveau/facts').then(setFaits)
    api.get('/cerveau/synthese').then(setSyn)
  }
  useEffect(() => { charger() }, [])

  // Regroupe les faits par sphère → catégorie (pour le réseau et l'affichage)
  const groupes = {}
  for (const s of ['perso', 'pro']) {
    const cats = {}
    faits.filter(f => f.sphere === s).forEach(f => { cats[f.categorie] = (cats[f.categorie] || 0) + 1 })
    const liste = Object.entries(cats).map(([nom, n]) => ({ nom, n }))
    if (liste.length) groupes[s] = liste
  }

  async function ajouter(e) {
    e.preventDefault()
    if (!ajout.cle?.trim() || !ajout.valeur?.trim()) return
    await api.post('/cerveau/facts', { ...ajout, sphere })
    setAjout(null); charger()
  }
  const supprimer = (id) => api.del('/cerveau/facts/' + id).then(charger)

  const visibles = faits.filter(f => f.sphere === sphere)
  const parCat = {}
  visibles.forEach(f => { (parCat[f.categorie] ||= []).push(f) })

  return (
    <div className="max-w-4xl">
      <EnTete section="CERVEAU" titre="Mémoire de l'IA" action={
        <span className="eyebrow flex items-center gap-1.5"><Brain size={12} className="text-accent" /> {faits.length} faits</span>
      } />

      {/* Visualisation */}
      <Carte className="mb-4 overflow-hidden">
        <Reseau groupes={groupes} />
        <div className="px-5 pb-4 -mt-2">
          <p className="text-xs text-faible text-center">
            Chaque nœud est une chose que l'IA sait de toi. Elle utilise ce réseau dans le Chat et la Recherche.
          </p>
        </div>
      </Carte>

      {/* Ce que le cerveau a appris de ton comportement */}
      {syn?.insights?.length > 0 && (
        <Carte className="p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-accent" />
            <span className="text-sm text-fort flex-1">Ce qu'il a appris en t'observant</span>
            <span className="eyebrow">{syn.total} observations</span>
          </div>
          <ul className="space-y-1.5">
            {syn.insights.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-normal">
                <Sparkles size={12} className="text-accent mt-1 shrink-0" />{s}
              </li>
            ))}
          </ul>
          {syn.taches?.taux != null && (
            <div className="mt-4">
              <div className="flex justify-between eyebrow mb-1"><span>Tâches terminées</span><span>{syn.taches.taux}%</span></div>
              <div className="h-1 rounded bg-surface-haute overflow-hidden">
                <div className="h-full bg-accent t" style={{ width: syn.taches.taux + '%' }} />
              </div>
            </div>
          )}
        </Carte>
      )}

      {/* Faits, par sphère */}
      <div className="flex gap-1 mb-3">
        {SPHERES.map(([v, l, Ic]) => (
          <button key={v} onClick={() => { setSphere(v); setAjout(null) }}
            className={`t inline-flex items-center gap-2 h-9 px-3 rounded border text-sm ${sphere === v ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>
            <Ic size={14} /> {l}
          </button>
        ))}
        <div className="flex-1" />
        <Bouton variante="primaire" onClick={() => setAjout({ categorie: 'général', cle: '', valeur: '' })}>
          <Plus size={16} /> Ajouter
        </Bouton>
      </div>

      {ajout && (
        <Carte className="p-4 mb-3 module-enter">
          <form onSubmit={ajouter} className="space-y-2">
            <div className="flex gap-2">
              <Champ value={ajout.categorie} onChange={e => setAjout({ ...ajout, categorie: e.target.value })} placeholder="Catégorie" className="w-40" />
              <Champ value={ajout.cle} onChange={e => setAjout({ ...ajout, cle: e.target.value })} placeholder="Quoi ? (ex : Sport pratiqué)" autoFocus />
            </div>
            <div className="flex gap-2">
              <Champ value={ajout.valeur} onChange={e => setAjout({ ...ajout, valeur: e.target.value })} placeholder="Détail à mémoriser" />
              <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
              <BoutonIcone onClick={() => setAjout(null)}><X size={16} /></BoutonIcone>
            </div>
          </form>
        </Carte>
      )}

      <div className="space-y-3">
        {Object.entries(parCat).map(([cat, items]) => (
          <Carte key={cat}>
            <div className="eyebrow px-4 pt-3 pb-2">{cat}</div>
            <div className="divide-y divide-[var(--bordure)]">
              {items.map(f => (
                <div key={f.id} className="group flex items-start gap-3 px-4 py-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-fort">{f.cle}</div>
                    <div className="text-sm text-normal">{f.valeur}</div>
                  </div>
                  {f.source === 'seed' && <span className="eyebrow shrink-0">appris</span>}
                  <BoutonIcone onClick={() => supprimer(f.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte w-7 h-7"><Trash2 size={14} /></BoutonIcone>
                </div>
              ))}
            </div>
          </Carte>
        ))}
        {visibles.length === 0 && <Carte className="px-4 py-8 text-center text-faible text-sm">Rien de mémorisé dans cette sphère.</Carte>}
      </div>
    </div>
  )
}
