import { useEffect, useRef, useState } from 'react'
import { Send, Trash2, ShieldCheck, Lock, Plus, X } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Champ, Bouton, BoutonIcone } from '../components/ui'

// BLOC 3 — Messagerie chiffrée de bout en bout.
// Le serveur ne stocke que du chiffré ; le déchiffrement utilise la clé privée
// déverrouillée par le mot de passe au moment de la connexion.
export default function Messages() {
  const [convs, setConvs] = useState([])
  const [contacts, setContacts] = useState([])
  const [actif, setActif] = useState(null)   // id du contact
  const [fil, setFil] = useState(null)
  const [texte, setTexte] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [erreur, setErreur] = useState('')
  const bas = useRef(null)

  const charger = () => api.get('/messages').then(setConvs)
  useEffect(() => { charger(); api.get('/messages/contacts').then(setContacts) }, [])

  function ouvrir(id) {
    setActif(id); setNouveau(false); setErreur('')
    api.get('/messages/with/' + id).then(d => { setFil(d); charger() })
  }
  useEffect(() => { bas.current?.scrollIntoView({ behavior: 'smooth' }) }, [fil])

  async function envoyer(e) {
    e.preventDefault()
    if (!texte.trim() || !actif) return
    setErreur('')
    try {
      await api.post('/messages/send', { receiver_id: actif, body: texte.trim() })
      setTexte(''); ouvrir(actif)
    } catch (err) { setErreur(err.message) }
  }
  async function supprimer(id) {
    await api.post('/messages/delete/' + id, {})
    ouvrir(actif)
  }

  return (
    <div>
      <EnTete section="MESSAGERIE" titre="Messages" action={
        <Bouton variante="primaire" onClick={() => { setNouveau(true); setActif(null); setFil(null) }}>
          <Plus size={16} /> Nouveau
        </Bouton>
      } />
      <div className="flex items-center gap-2 mb-4 text-xs text-faible">
        <ShieldCheck size={13} className="text-succes" />
        Chiffré de bout en bout — le serveur ne peut pas lire tes messages.
      </div>

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        {/* Liste des conversations */}
        <Carte className="w-64 shrink-0 p-2 overflow-auto">
          {convs.map(c => (
            <button key={c.contact.id} onClick={() => ouvrir(c.contact.id)}
              className={`t w-full text-left px-3 py-2 rounded ${actif === c.contact.id ? 'bg-surface-haute' : 'hover:bg-surface-haute'}`}>
              <div className="flex items-center gap-2">
                <span className={`flex-1 text-sm truncate ${c.nonLus ? 'text-fort font-medium' : 'text-normal'}`}>{c.contact.nom}</span>
                {c.nonLus > 0 && <span className="text-xs px-1.5 rounded-full bg-accent text-fond font-medium">{c.nonLus}</span>}
              </div>
              <div className="text-xs text-faible truncate">{c.apercu || '—'}</div>
            </button>
          ))}
          {convs.length === 0 && <div className="px-3 py-6 text-faible text-sm">Aucune conversation.</div>}
        </Carte>

        {/* Fil / nouveau message */}
        <Carte className="flex-1 flex flex-col min-w-0 p-4">
          {nouveau ? (
            <>
              <div className="eyebrow mb-3">Choisis un destinataire</div>
              <div className="space-y-1 overflow-auto">
                {contacts.map(u => (
                  <button key={u.id} onClick={() => ouvrir(u.id)}
                    className="t w-full text-left px-3 h-10 flex items-center rounded text-sm text-normal hover:bg-surface-haute hover:text-fort">
                    {u.nom} <span className="text-faible ml-2 text-xs">{u.email}</span>
                  </button>
                ))}
                {contacts.length === 0 && <p className="text-faible text-sm">Aucun autre compte inscrit.</p>}
              </div>
            </>
          ) : fil ? (
            <>
              <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[var(--bordure)]">
                <span className="titre text-base flex-1">{fil.contact.nom}</span>
                <span className="eyebrow flex items-center gap-1"><Lock size={11} /> E2EE</span>
              </div>
              {fil.verrouille && (
                <div className="mb-3 p-3 rounded border border-alerte/40 text-alerte text-sm">
                  Clé de chiffrement verrouillée — reconnecte-toi avec ton mot de passe pour lire et écrire.
                </div>
              )}
              <div className="flex-1 overflow-auto space-y-2 pr-1">
                {fil.messages.map(m => (
                  <div key={m.id} className={`group flex ${m.moi ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded border text-sm whitespace-pre-wrap
                      ${m.moi ? 'bg-surface-haute border-[var(--bordure)] text-fort' : 'bg-fond border-[var(--bordure)] text-normal'}`}>
                      {m.texte}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="eyebrow">{new Date(m.date + 'Z').toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <button onClick={() => supprimer(m.id)} className="opacity-0 group-hover:opacity-100 text-faible hover:text-alerte"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {fil.messages.length === 0 && <p className="text-faible text-sm">Aucun message. Écris le premier.</p>}
                <div ref={bas} />
              </div>
              {erreur && <p className="text-alerte text-sm mt-2">{erreur}</p>}
              <form onSubmit={envoyer} className="flex gap-2 mt-3">
                <Champ value={texte} onChange={e => setTexte(e.target.value)} placeholder="Ton message (chiffré)…" disabled={fil.verrouille} />
                <Bouton variante="primaire" type="submit" disabled={fil.verrouille}><Send size={16} /></Bouton>
              </form>
            </>
          ) : <div className="m-auto text-faible text-sm">Sélectionne une conversation.</div>}
        </Carte>
      </div>
    </div>
  )
}
