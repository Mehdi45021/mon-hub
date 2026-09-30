import { useEffect, useState } from 'react'
import { QrCode, Fingerprint, Plus, Trash2, ShieldCheck, ScrollText, AlertTriangle, Smartphone, Copy, Check } from 'lucide-react'
import { api, utilisateur } from '../lib/api'
import { EnTete, Carte, Bouton, BoutonIcone } from '../components/ui'
import { isWebAuthnSupported, registerBiometric } from '../lib/webauthn'

// Interrupteur réutilisable
function Switch({ actif, onChange }) {
  return (
    <button onClick={onChange} role="switch" aria-checked={actif}
      className={`t w-11 h-6 rounded-full border relative shrink-0 ${actif ? 'bg-[color-mix(in_srgb,var(--accent)_35%,transparent)] border-accent/60' : 'bg-surface-haute border-[var(--bordure)]'}`}>
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-fort t ${actif ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  )
}

const LIBELLE = {
  connexion_reussie: 'Connexion réussie', connexion_echouee: 'Connexion échouée',
  connexion_qr: 'Connexion par QR Code', connexion_biometrique: 'Connexion biométrique',
  changement_mdp: 'Mot de passe changé', reinitialisation_mdp: 'Mot de passe réinitialisé',
  deconnexion: 'Déconnexion', inscription: 'Création du compte', message_envoye: 'Message envoyé',
  biometrie_enregistree: 'Appareil biométrique ajouté', biometrie_supprimee: 'Appareil biométrique retiré',
  session_rejetee: 'Session rejetée', csrf_invalide: 'Requête CSRF bloquée',
  blocage_force_brute: 'Blocage anti-force-brute', option_securite: 'Option de sécurité modifiée',
  qr_scan_reussi: 'QR Code scanné', qr_otp_incorrect: 'Code QR incorrect', email_verifie: 'E-mail vérifié'
}
const SENSIBLE = ['connexion_echouee', 'session_rejetee', 'csrf_invalide', 'blocage_force_brute', 'qr_otp_incorrect']

export default function Securite() {
  const [user, setUser] = useState(utilisateur())
  const [devices, setDevices] = useState([])
  const [logs, setLogs] = useState([])
  const [msg, setMsg] = useState('')
  const [reseau, setReseau] = useState(null)
  const [copie, setCopie] = useState(false)
  const bioDispo = isWebAuthnSupported()

  const charger = () => {
    api.get('/webauthn/credentials').then(setDevices).catch(() => {})
    api.get('/auth/logs').then(setLogs).catch(() => {})
    api.get('/reseau').then(setReseau).catch(() => {})
  }
  useEffect(() => { charger() }, [])

  async function option(cle) {
    const actif = !user[cle]
    await api.post('/auth/option', { cle, actif })
    const maj = { ...user, [cle]: actif ? 1 : 0 }
    setUser(maj); localStorage.setItem('user', JSON.stringify(maj))
  }
  async function ajouterAppareil() {
    setMsg('')
    try {
      const nom = prompt('Nom de cet appareil ?', 'Mon Mac') || 'Mon appareil'
      await registerBiometric(nom)
      setMsg('✓ Appareil enregistré — tu peux maintenant te connecter avec Face ID / Touch ID.')
      const maj = { ...user, biometric_enabled: 1 }
      setUser(maj); localStorage.setItem('user', JSON.stringify(maj))
      charger()
    } catch (e) { setMsg('⚠️ ' + (e.message || 'Enregistrement annulé')) }
  }
  async function supprimerAppareil(id) {
    await api.post('/webauthn/delete', { id }); charger()
  }

  return (
    <div className="max-w-2xl">
      <EnTete section="PLATEFORME" titre="Sécurité" />

      {/* Accès depuis le téléphone */}
      <Carte className="p-5 mb-4">
        <div className="flex items-start gap-3">
          <Smartphone size={16} className="text-faible mt-1" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-fort mb-1">Accès depuis ton téléphone</div>
            <p className="text-xs text-faible mb-3">
              Sur le <b>même Wi-Fi</b>, ouvre cette adresse. « localhost » ne marche pas depuis
              un téléphone : c'est l'adresse réseau de ton Mac qu'il faut utiliser.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-sm text-accent bg-fond border border-[var(--bordure)] rounded px-3 py-2 truncate">
                {reseau?.lan ? `http://${reseau.lan}:3001` : 'Aucun réseau détecté'}
              </code>
              {reseau?.lan && (
                <BoutonIcone title="Copier" onClick={() => {
                  navigator.clipboard.writeText(`http://${reseau.lan}:3001`)
                  setCopie(true); setTimeout(() => setCopie(false), 1500)
                }}>{copie ? <Check size={16} className="text-succes" /> : <Copy size={16} />}</BoutonIcone>
              )}
            </div>
            <p className="text-xs text-faible mt-2">
              Le QR Code et les liens d'e-mail utilisent automatiquement cette adresse.
            </p>
          </div>
        </div>
      </Carte>

      {/* QR Code */}
      <Carte className="p-5 mb-4">
        <div className="flex items-start gap-3">
          <QrCode size={16} className="text-faible mt-1" />
          <div className="flex-1">
            <div className="text-sm text-fort mb-1">Connexion par QR Code</div>
            <p className="text-xs text-faible">
              Connecte-toi en scannant un QR Code avec ton téléphone. Un code à 6 chiffres
              te sera affiché pour confirmer.
            </p>
          </div>
          <Switch actif={!!user.qr_login_enabled} onChange={() => option('qr_login_enabled')} />
        </div>
        {!!user.qr_login_enabled && (
          <p className="text-succes text-xs mt-3 flex items-center gap-1.5"><ShieldCheck size={12} /> Activé — le bouton apparaît sur la page de connexion.</p>
        )}
      </Carte>

      {/* Biométrie */}
      <Carte className="p-5 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <Fingerprint size={16} className="text-faible mt-1" />
          <div className="flex-1">
            <div className="text-sm text-fort mb-1">Authentification biométrique</div>
            <p className="text-xs text-faible">
              Compatible Face ID, Touch ID, Windows Hello et empreintes Android.
              Ta biométrie ne quitte jamais ton appareil.
            </p>
          </div>
          <Switch actif={!!user.biometric_enabled} onChange={() => option('biometric_enabled')} />
        </div>

        {!bioDispo ? (
          <p className="text-xs text-faible flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {window.location.hostname !== 'localhost' && window.location.protocol === 'http:'
              ? <>La biométrie exige HTTPS. Elle fonctionne uniquement via <b>http://localhost:3001</b> sur ce Mac, pas via l'adresse réseau.</>
              : <>Ce navigateur ne supporte pas WebAuthn.</>}
          </p>
        ) : <>
          <div className="space-y-1 mb-3">
            {devices.map(d => (
              <div key={d.id} className="group flex items-center gap-3 px-3 h-10 rounded border border-[var(--bordure)]">
                <Fingerprint size={14} className="text-accent shrink-0" />
                <span className="flex-1 text-sm text-fort truncate">{d.device_name}</span>
                <span className="eyebrow">{d.last_used_at ? 'utilisé le ' + new Date(d.last_used_at + 'Z').toLocaleDateString('fr-FR') : 'jamais utilisé'}</span>
                <BoutonIcone onClick={() => supprimerAppareil(d.id)} className="opacity-0 group-hover:opacity-100 hover:text-alerte w-7 h-7"><Trash2 size={14} /></BoutonIcone>
              </div>
            ))}
            {devices.length === 0 && <p className="text-xs text-faible">Aucun appareil enregistré.</p>}
          </div>
          <Bouton variante="primaire" onClick={ajouterAppareil}><Plus size={16} /> Ajouter cet appareil</Bouton>
          {msg && <p className={`text-sm mt-3 ${msg.startsWith('✓') ? 'text-succes' : 'text-alerte'}`}>{msg}</p>}
        </>}
      </Carte>

      {/* Journal de sécurité */}
      <Carte className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText size={16} className="text-faible" />
          <span className="text-sm text-fort flex-1">Journal de sécurité</span>
          <span className="eyebrow">50 derniers évènements</span>
        </div>
        <div className="space-y-1 max-h-72 overflow-auto">
          {logs.map((l, i) => (
            <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-[var(--bordure)] last:border-0">
              <span className={`flex-1 ${SENSIBLE.includes(l.action) ? 'text-alerte' : 'text-normal'}`}>
                {LIBELLE[l.action] || l.action}
              </span>
              <span className="font-mono text-faible">{l.ip || '—'}</span>
              <span className="text-faible">{new Date(l.created_at + 'Z').toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-xs text-faible">Aucun évènement.</p>}
        </div>
      </Carte>
    </div>
  )
}
