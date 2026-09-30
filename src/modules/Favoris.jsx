import { useEffect, useState } from 'react'
import { Plus, Trash2, ExternalLink, Search } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'
import TagBar from '../components/Tags'
import ExportData from '../components/ExportData'

export default function Favoris() {
  const [list, setList] = useState([])
  const [map, setMap] = useState({})
  const [f, setF] = useState({ titre: '', url: '' })
  const [q, setQ] = useState('')

  const charger = () => { api.get('/favoris').then(setList); api.get('/tags/map/favoris').then(setMap) }
  useEffect(() => { charger() }, [])

  async function ajouter(e) {
    e.preventDefault()
    if (!f.url.trim()) return
    const url = f.url.match(/^https?:\/\//) ? f.url.trim() : 'https://' + f.url.trim()
    await api.post('/favoris', { titre: f.titre.trim() || url, url })
    setF({ titre: '', url: '' }); charger()
  }
  const supprimer = (id) => api.del('/favoris/' + id).then(charger)
  const visibles = list.filter(x => !q || (x.titre + x.url).toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="max-w-2xl">
      <EnTete section="DÉVELOPPEMENT" titre="Favoris" action={<ExportData rows={list} nom="favoris" />} />
      <form onSubmit={ajouter} className="flex gap-2 mb-4 flex-wrap">
        <Champ value={f.titre} onChange={e => setF({ ...f, titre: e.target.value })} placeholder="Titre (optionnel)" className="flex-1 min-w-[8rem]" />
        <Champ value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="URL" className="flex-1 min-w-[10rem]" />
        <Bouton variante="primaire" type="submit"><Plus size={16} /></Bouton>
      </form>
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faible" />
        <Champ value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" className="pl-9" />
      </div>
      <div className="space-y-2">
        {visibles.map(x => (
          <Carte key={x.id} className="group p-3">
            <div className="flex items-center gap-3">
              <a href={x.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 flex-1 min-w-0 text-sm text-fort hover:text-accent">
                <ExternalLink size={14} className="text-faible shrink-0" />
                <span className="truncate">{x.titre}</span>
              </a>
              <span className="font-mono text-xs text-faible truncate max-w-[12rem] hidden sm:block">{x.url}</span>
              <BoutonIcone onClick={() => supprimer(x.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
            <div className="mt-2 pl-6"><TagBar type="favoris" id={x.id} onChange={() => api.get('/tags/map/favoris').then(setMap)} /></div>
          </Carte>
        ))}
        {visibles.length === 0 && <Carte className="px-4 py-8 text-center text-faible text-sm">Aucun favori.</Carte>}
      </div>
    </div>
  )
}
