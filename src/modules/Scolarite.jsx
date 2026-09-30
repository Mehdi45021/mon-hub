import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Save } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton } from '../components/ui'

// Les notes/moyennes sont gérées par Pronote/Skolengo : on pointe directement dessus.
export default function Scolarite() {
  const [url, setUrl] = useState('')
  const [saved, setSaved] = useState(true)
  useEffect(() => { api.get('/settings/pronote_url').then(d => { if (d.valeur) { setUrl(d.valeur); setSaved(true) } }) }, [])

  async function sauver() {
    const u = url.match(/^https?:\/\//) ? url : 'https://' + url
    setUrl(u); await api.put('/settings/pronote_url', { valeur: u }); setSaved(true)
  }
  const ouvrir = (u) => window.open(u, '_blank')

  return (
    <div className="max-w-2xl">
      <EnTete section="ÉCOLE" titre="Scolarité" />
      <p className="text-faible text-sm mb-5">Tes notes et moyennes sont dans Pronote / Skolengo. Accès direct ci-dessous.</p>

      <Carte className="p-5 mb-4">
        <div className="eyebrow mb-2">Mon espace Pronote</div>
        <div className="flex gap-2">
          <Champ value={url} onChange={e => { setUrl(e.target.value); setSaved(false) }} placeholder="https://...index-education.net/pronote/..." />
          <Bouton variante={saved ? 'normal' : 'primaire'} onClick={sauver}><Save size={16} /></Bouton>
          {url && <Bouton onClick={() => ouvrir(url.match(/^https?:/) ? url : 'https://' + url)}><ExternalLink size={16} /> Ouvrir</Bouton>}
        </div>
      </Carte>

      <div className="grid sm:grid-cols-2 gap-3">
        <Carte className="p-5 cursor-pointer hover:bg-surface-haute t" onClick={() => ouvrir('https://www.index-education.com/fr/pronote-info298.htm')}>
          <div className="flex items-center gap-2 text-fort"><ExternalLink size={16} className="text-faible" /> Pronote</div>
          <p className="text-faible text-sm mt-1">Notes, moyennes, bulletins.</p>
        </Carte>
        <Carte className="p-5 cursor-pointer hover:bg-surface-haute t" onClick={() => ouvrir('https://www.skolengo.com/')}>
          <div className="flex items-center gap-2 text-fort"><ExternalLink size={16} className="text-faible" /> Skolengo</div>
          <p className="text-faible text-sm mt-1">Espace numérique de travail.</p>
        </Carte>
      </div>
    </div>
  )
}
