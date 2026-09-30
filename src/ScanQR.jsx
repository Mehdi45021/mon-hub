import { useState } from 'react'
import { Smartphone, ShieldCheck, ArrowRight } from 'lucide-react'
import { api } from './lib/api'
import { Carte, Champ, ChampMdp, Bouton } from './components/ui'

// BLOC 7C — Page ouverte par le téléphone après le scan du QR Code.
// Elle authentifie l'utilisateur puis AFFICHE un code à 6 chiffres.
// Le téléphone n'est volontairement PAS connecté : seul le PC le sera.
export default function ScanQR() {
  const token = new URLSearchParams(location.search).get('token') || ''
  const [f, setF] = useState({ email: '', mdp: '' })
  const [otp, setOtp] = useState(null)
  const [erreur, setErreur] = useState('')
  const [charge, setCharge] = useState(false)

  async function valider(e) {
    e.preventDefault()
    setErreur(''); setCharge(true)
    try {
      const d = await api.post('/qr/scan', { token, ...f })
      setOtp(d.otp)
    } catch (err) { setErreur(err.message) } finally { setCharge(false) }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <span className="titre text-lg">Mon&nbsp;Hub</span>
          <span className="eyebrow flex items-center gap-1"><Smartphone size={11} /> Connexion</span>
        </div>

        {otp ? (
          // Le code à afficher, en grand
          <Carte className="p-8 text-center module-enter">
            <div className="eyebrow mb-3">Saisis ce code sur ton ordinateur</div>
            <div className="titre tabular-nums" style={{ fontSize: '48px', letterSpacing: '.15em' }}>{otp}</div>
            <p className="text-faible text-sm mt-4">Valable quelques minutes, utilisable une seule fois.</p>
            <div className="flex items-center justify-center gap-1.5 mt-5 text-succes text-sm">
              <ShieldCheck size={14} /> Identité vérifiée
            </div>
          </Carte>
        ) : !token ? (
          <Carte className="p-6 text-center text-faible text-sm">Lien invalide : aucun QR Code détecté.</Carte>
        ) : (
          <Carte className="p-6 module-enter">
            <div className="titre text-base mb-1">Confirme ton identité</div>
            <p className="text-faible text-xs mb-5">Un code s'affichera ensuite pour débloquer ton ordinateur.</p>
            <form onSubmit={valider} className="space-y-3">
              <div>
                <label className="eyebrow block mb-1.5">E-mail</label>
                <Champ type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="toi@exemple.com" autoFocus />
              </div>
              <div>
                <label className="eyebrow block mb-1.5">Mot de passe</label>
                <ChampMdp value={f.mdp} onChange={e => setF({ ...f, mdp: e.target.value })} placeholder="••••••••" />
              </div>
              {erreur && <p className="text-alerte text-sm">{erreur}</p>}
              <Bouton variante="primaire" type="submit" disabled={charge} className="w-full h-10">
                {charge ? '…' : 'Obtenir mon code'} <ArrowRight size={16} />
              </Bouton>
            </form>
          </Carte>
        )}
      </div>
    </div>
  )
}
