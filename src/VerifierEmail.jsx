import { useEffect, useState } from 'react'
import { MailCheck, XCircle } from 'lucide-react'
import { api } from './lib/api'
import { Carte, Bouton } from './components/ui'

// Page ouverte depuis le lien de l'e-mail de bienvenue (jeton usage unique, 24 h)
export default function VerifierEmail() {
  const [etat, setEtat] = useState('en cours')

  useEffect(() => {
    const token = new URLSearchParams(location.search).get('token')
    if (!token) return setEtat('erreur')
    api.post('/auth/verify-email', { token }).then(() => setEtat('ok')).catch(() => setEtat('erreur'))
  }, [])

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <Carte className="w-full max-w-sm p-8 text-center module-enter">
        <div className="titre text-lg mb-4">Mon&nbsp;Hub</div>
        {etat === 'en cours' && <p className="text-faible text-sm">Vérification en cours…</p>}
        {etat === 'ok' && <>
          <MailCheck size={32} className="text-succes mx-auto mb-3" />
          <p className="text-fort mb-1">Adresse confirmée</p>
          <p className="text-faible text-sm mb-5">Ton compte est entièrement vérifié.</p>
          <Bouton variante="primaire" onClick={() => location.href = '/'} className="w-full">Ouvrir Mon Hub</Bouton>
        </>}
        {etat === 'erreur' && <>
          <XCircle size={32} className="text-alerte mx-auto mb-3" />
          <p className="text-fort mb-1">Lien invalide ou expiré</p>
          <p className="text-faible text-sm mb-5">Les liens de vérification expirent après 24 heures.</p>
          <Bouton onClick={() => location.href = '/'} className="w-full">Retour</Bouton>
        </>}
      </Carte>
    </div>
  )
}
