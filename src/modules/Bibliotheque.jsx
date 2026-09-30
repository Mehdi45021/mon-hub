import { useEffect, useRef, useState } from 'react'
import { BookOpen, Upload, Trash2, Search, Sparkles, Loader, AlertTriangle, ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { useSubjects } from '../lib/subjects'
import { EnTete, Carte, Champ, Select, Bouton, BoutonIcone } from '../components/ui'

// Bibliothèque : tes manuels, lus par l'app. L'IA peut expliquer une page précise.
export default function Bibliotheque() {
  const { subjects } = useSubjects()
  const [livres, setLivres] = useState([])
  const [matiere, setMatiere] = useState('')
  const [envoi, setEnvoi] = useState(null)     // nom du fichier en cours
  const [erreur, setErreur] = useState('')
  const [q, setQ] = useState('')
  const [resultats, setResultats] = useState(null)
  const [ouvert, setOuvert] = useState(null)   // livre sélectionné
  const [page, setPage] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')
  const [charge, setCharge] = useState(false)
  const fichier = useRef(null)

  const charger = () => api.get('/livres').then(setLivres)
  useEffect(() => { charger() }, [])

  // Un manuel en cours de lecture : on rafraîchit jusqu'à ce qu'il soit prêt
  useEffect(() => {
    if (!livres.some(l => l.statut === 'lecture')) return
    const t = setInterval(charger, 2500)
    return () => clearInterval(t)
  }, [livres])

  async function importer(e) {
    const f = e.target.files[0]
    if (!f) return
    setErreur(''); setEnvoi(f.name)
    const fd = new FormData()
    fd.append('fichier', f)
    fd.append('titre', f.name.replace(/\.(pdf|docx?|txt|md)$/i, ''))
    if (matiere) fd.append('subject_id', matiere)
    try {
      // FormData : on laisse le navigateur poser le bon en-tête
      const r = await fetch('/api/livres', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + localStorage.getItem('token'),
          'x-csrf-token': localStorage.getItem('csrf')
        },
        body: fd
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.erreur || 'Import impossible')
      charger()
    } catch (err) { setErreur(err.message) } finally { setEnvoi(null); e.target.value = '' }
  }

  async function chercher(e) {
    e.preventDefault()
    if (!q.trim()) return setResultats(null)
    setResultats(await api.get('/livres/search?q=' + encodeURIComponent(q.trim())))
  }

  async function expliquer(e) {
    e.preventDefault()
    if (!ouvert || !page) return
    setCharge(true); setReponse(''); setErreur('')
    try {
      const d = await api.post('/livres/expliquer', {
        livre_id: ouvert.id, page: Number(page),
        question: question.trim() || "Explique-moi cette page simplement."
      })
      setReponse(d.reponse)
    } catch (err) { setErreur(err.message) } finally { setCharge(false) }
  }

  const supprimer = async (id) => {
    if (!confirm('Retirer ce manuel de ta bibliothèque ?')) return
    await api.del('/livres/' + id); setOuvert(null); charger()
  }

  // ===== Manuel ouvert : poser une question sur une page =====
  if (ouvert) return (
    <div className="max-w-2xl module-enter">
      <button onClick={() => { setOuvert(null); setReponse('') }}
        className="t flex items-center gap-1.5 text-sm text-faible mb-3 active:text-fort">
        <ArrowLeft size={15} /> Bibliothèque
      </button>
      <h2 className="titre text-xl mb-1">{ouvert.titre}</h2>
      <p className="eyebrow mb-5">{ouvert.pages} pages lues{ouvert.matiere ? ` · ${ouvert.matiere}` : ''}</p>

      <Carte className="p-4 mb-4">
        <div className="eyebrow mb-3">Demande une explication</div>
        <form onSubmit={expliquer} className="space-y-2">
          <div className="flex gap-2">
            <Champ type="number" value={page} onChange={e => setPage(e.target.value)}
              placeholder="Page" className="w-24" min="1" max={ouvert.pages} />
            <Champ value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="Ex : je comprends pas l'exercice 4" />
          </div>
          <Bouton variante="primaire" type="submit" disabled={charge || !page} className="w-full">
            <Sparkles size={16} /> {charge ? 'Je lis ta page…' : 'Explique-moi'}
          </Bouton>
        </form>
      </Carte>

      {erreur && <Carte className="p-3 mb-3 text-sm text-alerte">{erreur}</Carte>}
      {reponse && (
        <Carte className="p-4 module-enter">
          <div className="eyebrow mb-2">Explication</div>
          <p className="text-sm text-normal whitespace-pre-wrap leading-relaxed">{reponse}</p>
        </Carte>
      )}
    </div>
  )

  return (
    <div className="max-w-2xl">
      <EnTete section="ÉCOLE" titre="Bibliothèque" action={
        <Bouton variante="primaire" onClick={() => fichier.current.click()} disabled={!!envoi}>
          <Upload size={16} /> {envoi ? 'Envoi…' : 'Importer'}
        </Bouton>
      } />
      <input ref={fichier} type="file" accept=".pdf,.docx,.doc,.txt,.md,application/pdf" className="hidden" onChange={importer} />

      <p className="text-faible text-sm mb-4">
        Dépose tes manuels et tes fiches — <span className="text-normal">PDF, Word, texte</span>.
        L'app les lit une fois, les range automatiquement par matière, puis l'IA peut t'expliquer
        n'importe quelle page : « je comprends pas l'exercice 4 page 142 ».
      </p>

      {subjects.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="eyebrow shrink-0">Matière du prochain import</span>
          <Select value={matiere} onChange={e => setMatiere(e.target.value)}>
            <option value="">Classement automatique</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </Select>
        </div>
      )}

      {envoi && (
        <Carte className="p-4 mb-3 flex items-center gap-3">
          <Loader size={16} className="text-accent animate-spin" />
          <span className="text-sm text-normal">Lecture de « {envoi} »…</span>
        </Carte>
      )}
      {erreur && <Carte className="p-3 mb-3 text-sm text-alerte">{erreur}</Carte>}

      {/* Recherche dans tous les manuels */}
      {livres.some(l => l.statut === 'pret') && (
        <form onSubmit={chercher} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faible" />
            <Champ value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher dans mes manuels…" className="pl-9" />
          </div>
          <Bouton variante="primaire" type="submit"><Search size={16} /></Bouton>
        </form>
      )}

      {resultats && (
        <div className="mb-5">
          <div className="eyebrow mb-2">{resultats.length} passage{resultats.length > 1 ? 's' : ''}</div>
          <Carte className="divide-y divide-[var(--bordure)]">
            {resultats.map((r, i) => (
              <button key={i} onClick={() => { const l = livres.find(x => x.id === r.livre_id); setOuvert(l); setPage(String(r.page)) }}
                className="w-full text-left px-3 py-2.5 active:bg-surface-haute t">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-fort truncate">{r.titre}</span>
                  <span className="eyebrow shrink-0">p.{r.page}</span>
                </div>
                <p className="text-xs text-faible line-clamp-2">{r.extrait}…</p>
              </button>
            ))}
            {resultats.length === 0 && <div className="px-3 py-6 text-center text-faible text-sm">Rien trouvé.</div>}
          </Carte>
        </div>
      )}

      {/* Mes manuels */}
      <div className="space-y-2">
        {livres.map(l => (
          <Carte key={l.id} className="group flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-lg bg-surface-haute flex items-center justify-center shrink-0">
              {l.statut === 'lecture' ? <Loader size={18} className="text-accent animate-spin" />
                : l.statut === 'erreur' ? <AlertTriangle size={18} className="text-alerte" />
                : <BookOpen size={18} className="text-accent" />}
            </div>
            <button onClick={() => l.statut === 'pret' && setOuvert(l)} className="flex-1 text-left min-w-0" disabled={l.statut !== 'pret'}>
              <div className="text-sm text-fort truncate">{l.titre}</div>
              <div className="eyebrow">
                {l.statut === 'lecture' ? 'Lecture en cours…'
                  : l.statut === 'erreur' ? (l.erreur || 'Lecture impossible')
                  : `${l.pages} pages${l.matiere ? ' · ' + l.matiere : ''}`}
              </div>
            </button>
            <BoutonIcone onClick={() => supprimer(l.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
          </Carte>
        ))}
        {livres.length === 0 && !envoi && (
          <Carte className="px-4 py-10 text-center">
            <BookOpen size={26} className="text-faible mx-auto mb-3" />
            <p className="text-faible text-sm">Aucun manuel pour l'instant.</p>
          </Carte>
        )}
      </div>

      <p className="text-faible text-xs mt-6">
        Tes manuels restent sur ta machine et ne sont partagés avec personne — copie privée,
        strictement pour ton usage personnel.
      </p>
    </div>
  )
}
