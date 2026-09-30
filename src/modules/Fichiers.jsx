import { useEffect, useState } from 'react'
import { Folder, File, FileText, FileCode, FileImage, FileType, FolderPlus, FilePlus, Trash2, Save, ChevronRight, Home, Lock, Unlock, LayoutGrid, List } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'

// Icône + teinte selon l'extension
function typeFichier(nom) {
  const ext = (nom.split('.').pop() || '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return { I: FileImage, c: '#7AA2E3' }
  if (['js', 'jsx', 'ts', 'html', 'css', 'php', 'py', 'json', 'sh'].includes(ext)) return { I: FileCode, c: '#5FB37A' }
  if (['txt', 'md'].includes(ext)) return { I: FileText, c: '#9CA0A8' }
  if (['pdf', 'doc', 'docx'].includes(ext)) return { I: FileType, c: '#E5675E' }
  return { I: File, c: '#5C616B' }
}

export default function Fichiers() {
  const [chemin, setChemin] = useState('')
  const [items, setItems] = useState([])
  const [fichier, setFichier] = useState(null)
  const [contenu, setContenu] = useState('')
  const [sauve, setSauve] = useState(true)
  const [vue, setVue] = useState('grille')
  // Modale verrou : { action: 'lock'|'unlock', path, apres? }
  const [modal, setModal] = useState(null)
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')

  const lister = (p = chemin) => api.get('/files/list?path=' + encodeURIComponent(p))
    .then(d => { setItems(d.items); setChemin(d.path) })
    .catch(e => { if (e.message === 'Verrouillé') setModal({ action: 'unlock', path: p, apres: () => lister(p) }); else alert(e.message) })
  useEffect(() => { lister('') }, [])

  const relDe = (it) => chemin ? chemin + '/' + it.nom : it.nom

  function entrer(it) {
    const p = relDe(it)
    if (it.verrou) return setModal({ action: 'unlock', path: p, apres: () => entrerChemin(p, it.dossier) })
    entrerChemin(p, it.dossier)
  }
  function entrerChemin(p, dossier) {
    if (dossier) { setFichier(null); lister(p) }
    else api.get('/files/read?path=' + encodeURIComponent(p)).then(d => {
      setFichier({ path: p }); setContenu(d.contenu); setSauve(true)
    }).catch(e => alert(e.message))
  }
  const fil = chemin ? chemin.split('/') : []
  const allerNiveau = (i) => lister(fil.slice(0, i + 1).join('/'))

  async function creer(dossier) {
    const nom = prompt(dossier ? 'Nom du dossier' : 'Nom du fichier')
    if (!nom) return
    await api.post('/files/create', { path: chemin ? chemin + '/' + nom : nom, dossier }).catch(e => alert(e.message))
    lister()
  }
  async function supprimer(it) {
    if (it.verrou) return setModal({ action: 'unlock', path: relDe(it), apres: () => lister() })
    if (!confirm('Supprimer ' + it.nom + ' ?')) return
    await api.post('/files/delete', { path: relDe(it) }).catch(e => alert(e.message))
    if (fichier?.path === relDe(it)) setFichier(null)
    lister()
  }
  async function sauver() {
    await api.post('/files/write', { path: fichier.path, contenu }).catch(e => alert(e.message))
    setSauve(true)
  }

  // Verrouillage / déverrouillage avec code
  async function validerModal(e) {
    e.preventDefault(); setErreur('')
    try {
      await api.post('/files/' + modal.action, { path: modal.path, code })
      const apres = modal.apres
      setModal(null); setCode('')
      apres ? apres() : lister()
    } catch (err) { setErreur(err.message) }
  }

  // Élément (grille ou liste)
  function Item({ it, i }) {
    const { I, c } = it.dossier ? { I: Folder, c: 'var(--accent)' } : typeFichier(it.nom)
    const actions = (
      <>
        <button onClick={(e) => { e.stopPropagation(); it.verrou ? setModal({ action: 'unlock', path: relDe(it) }) : setModal({ action: 'lock', path: relDe(it) }) }}
          title={it.verrou ? 'Déverrouiller' : 'Verrouiller'}
          className={`t ${it.verrou ? 'text-accent' : 'opacity-0 group-hover:opacity-100 text-faible hover:text-fort'}`}>
          {it.verrou ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button onClick={(e) => { e.stopPropagation(); supprimer(it) }}
          className="t opacity-0 group-hover:opacity-100 text-faible hover:text-alerte"><Trash2 size={14} /></button>
      </>
    )
    if (vue === 'grille') return (
      <button onClick={() => entrer(it)} style={{ animationDelay: (i * 30) + 'ms' }}
        className="item-enter hover-lift t group relative flex flex-col items-center gap-2 p-4 rounded border border-[var(--bordure)] bg-surface hover:bg-surface-haute text-center">
        <span className="absolute top-2 right-2 flex gap-1.5">{actions}</span>
        <I size={30} strokeWidth={1.5} style={{ color: it.verrou ? 'var(--faible)' : c }} />
        <span className={`text-xs truncate w-full ${it.verrou ? 'text-faible' : 'text-fort'}`}>{it.nom}</span>
        {it.verrou && <span className="eyebrow flex items-center gap-1"><Lock size={9} /> Verrouillé</span>}
      </button>
    )
    return (
      <div style={{ animationDelay: (i * 20) + 'ms' }}
        className="item-enter group flex items-center gap-2 px-2 h-9 rounded hover:bg-surface-haute t">
        <button onClick={() => entrer(it)} className="flex items-center gap-2 flex-1 text-left truncate text-sm">
          <I size={16} className="shrink-0" style={{ color: it.verrou ? 'var(--faible)' : c }} />
          <span className={`truncate ${it.verrou ? 'text-faible' : 'text-fort'}`}>{it.nom}</span>
          {it.verrou && <Lock size={11} className="text-accent shrink-0" />}
        </button>
        {actions}
      </div>
    )
  }

  return (
    <div>
      <EnTete section="FICHIERS" titre="Explorateur" action={
        <div className="flex gap-1">
          <BoutonIcone onClick={() => setVue('grille')} className={vue === 'grille' ? 'text-fort bg-surface-haute' : ''} title="Grille"><LayoutGrid size={16} /></BoutonIcone>
          <BoutonIcone onClick={() => setVue('liste')} className={vue === 'liste' ? 'text-fort bg-surface-haute' : ''} title="Liste"><List size={16} /></BoutonIcone>
          <span className="w-px h-6 bg-[var(--bordure)] mx-1 self-center" />
          <BoutonIcone onClick={() => creer(true)} title="Nouveau dossier"><FolderPlus size={16} /></BoutonIcone>
          <BoutonIcone onClick={() => creer(false)} title="Nouveau fichier"><FilePlus size={16} /></BoutonIcone>
        </div>
      } />
      {/* Fil d'Ariane */}
      <div className="flex items-center flex-wrap gap-1 mb-3 text-faible">
        <button onClick={() => lister('')} className="hover:text-fort t"><Home size={14} /></button>
        {fil.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={13} />
            <button onClick={() => allerNiveau(i)} className="font-mono text-xs hover:text-fort t">{seg}</button>
          </span>
        ))}
      </div>
      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        {/* Explorateur */}
        <div className={`${fichier ? 'w-80' : 'flex-1'} shrink-0 overflow-auto t`}>
          {vue === 'grille'
            ? <div className={`grid gap-3 ${fichier ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}>
                {items.map((it, i) => <Item key={it.nom} it={it} i={i} />)}
              </div>
            : <Carte className="p-2">{items.map((it, i) => <Item key={it.nom} it={it} i={i} />)}</Carte>}
          {items.length === 0 && <Carte className="px-4 py-10 text-center text-faible text-sm">Dossier vide.</Carte>}
        </div>
        {/* Éditeur */}
        {fichier && (
          <Carte className="flex-1 p-4 flex flex-col module-enter">
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs text-normal flex-1 truncate">{fichier.path}</span>
              <Bouton variante={sauve ? 'normal' : 'primaire'} onClick={sauver} disabled={sauve}><Save size={16} /> {sauve ? 'Sauvé' : 'Sauver'}</Bouton>
              <BoutonIcone onClick={() => setFichier(null)} title="Fermer">✕</BoutonIcone>
            </div>
            <textarea value={contenu} onChange={e => { setContenu(e.target.value); setSauve(false) }}
              className="flex-1 resize-none bg-transparent font-mono text-sm text-fort leading-relaxed outline-none" />
          </Carte>
        )}
      </div>

      {/* Modale code (verrouiller / déverrouiller) */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[18vh] px-4" onMouseDown={() => { setModal(null); setCode(''); setErreur('') }}>
          <Carte className="w-full max-w-sm p-5 module-enter" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              {modal.action === 'lock' ? <Lock size={16} className="text-accent" /> : <Unlock size={16} className="text-accent" />}
              <span className="titre text-base">{modal.action === 'lock' ? 'Verrouiller' : 'Déverrouiller'}</span>
            </div>
            <p className="font-mono text-xs text-faible mb-4 truncate">{modal.path}</p>
            <form onSubmit={validerModal} className="space-y-3">
              <Champ type="password" value={code} onChange={e => setCode(e.target.value)} autoFocus
                placeholder={modal.action === 'lock' ? 'Code (min. 4 caractères)' : 'Code'} />
              {erreur && <p className="text-alerte text-sm">{erreur}</p>}
              <div className="flex gap-2">
                <Bouton type="button" onClick={() => { setModal(null); setCode(''); setErreur('') }} className="flex-1">Annuler</Bouton>
                <Bouton variante="primaire" type="submit" className="flex-1">{modal.action === 'lock' ? 'Verrouiller' : 'Ouvrir'}</Bouton>
              </div>
            </form>
          </Carte>
        </div>
      )}
    </div>
  )
}
