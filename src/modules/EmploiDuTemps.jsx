import { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, Maximize2, X } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Bouton } from '../components/ui'

// Emploi du temps = simple photo importée (stockée en base64 dans les réglages).
export default function EmploiDuTemps() {
  const [image, setImage] = useState(null)
  const [plein, setPlein] = useState(false)
  const fichier = useRef(null)

  useEffect(() => { api.get('/settings/edt_image').then(d => setImage(d.valeur)) }, [])

  async function importer(e) {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = async () => { setImage(r.result); await api.put('/settings/edt_image', { valeur: r.result }) }
    r.readAsDataURL(f); e.target.value = ''
  }
  async function retirer() { setImage(null); await api.put('/settings/edt_image', { valeur: null }) }

  return (
    <div className="max-w-4xl">
      <EnTete section="ÉCOLE" titre="Emploi du temps" action={
        <div className="flex gap-2">
          {image && <Bouton onClick={retirer} className="hover:text-alerte"><Trash2 size={16} /></Bouton>}
          <Bouton variante="primaire" onClick={() => fichier.current.click()}><Upload size={16} /> Importer une photo</Bouton>
          <input ref={fichier} type="file" accept="image/*" className="hidden" onChange={importer} />
        </div>
      } />
      {image ? (
        <Carte className="p-2 relative group">
          <img src={image} alt="Emploi du temps" className="w-full rounded cursor-zoom-in" onClick={() => setPlein(true)} />
          <button onClick={() => setPlein(true)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 t w-9 h-9 rounded border border-[var(--bordure)] bg-surface text-faible hover:text-fort flex items-center justify-center"><Maximize2 size={16} /></button>
        </Carte>
      ) : (
        <Carte className="p-12 text-center">
          <p className="text-faible text-sm mb-4">Aucun emploi du temps. Importe une photo ou une capture d'écran.</p>
          <Bouton variante="primaire" onClick={() => fichier.current.click()} className="mx-auto"><Upload size={16} /> Importer une photo</Bouton>
        </Carte>
      )}
      {/* Affichage plein écran */}
      {plein && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setPlein(false)}>
          <button className="absolute top-4 right-4 text-faible hover:text-fort"><X size={24} /></button>
          <img src={image} alt="Emploi du temps" className="max-w-full max-h-full rounded" />
        </div>
      )}
    </div>
  )
}
