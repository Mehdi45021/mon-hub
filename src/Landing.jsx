import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight, QrCode, Fingerprint, MailCheck, ShieldCheck, MoonStar,
  Sparkles, ChevronLeft, Loader2, Sunrise, Sun, CloudSun, Moon, Coffee,
  BatteryLow, Clock, BookOpen, Brain
} from 'lucide-react'

import { api, ouvrirSession } from './lib/api'
import { Champ, ChampMdp } from './components/ui'
import { isWebAuthnSupported, loginWithBiometric } from './lib/webauthn'

// ===== Le moment de la journée : l'accueil ne parle pas pareil à 7h et à 22h =====
function moment() {
  const h = new Date().getHours()
  if (h >= 5 && h < 9) return {
    cle: 'aube', salut: 'Bien matinal', I: Sunrise,
    titre: ['Aujourd\'hui,', 'tu commences', 'au clair.'],
    sous: "Ta journée est déjà organisée. Tu n'as qu'à suivre.",
    ambiance: 'Le calme du matin, avant que ça s\'agite.'
  }
  if (h >= 9 && h < 13) return {
    cle: 'matin', salut: 'Bonne matinée', I: Sun,
    titre: ['Une chose', 'à la fois,', 'jusqu\'au bout.'],
    sous: "Ton assistant garde le fil pendant que tu es en cours.",
    ambiance: 'Pendant les cours, il note tout à ta place.'
  }
  if (h >= 13 && h < 19) return {
    cle: 'aprem', salut: 'Bon après-midi', I: CloudSun,
    titre: ['Rentre.', 'Pose ton sac.', 'On s\'en occupe.'],
    sous: "Repose-toi d'abord — l'app te dira quand t'y mettre.",
    ambiance: 'Pause validée en rentrant : ce n\'est pas de la procrastination.'
  }
  if (h >= 19 && h < 23) return {
    cle: 'soir', salut: 'Bonne soirée', I: MoonStar,
    titre: ['Ce soir,', 'tu sais quoi', 'faire.'],
    sous: "Par quoi commencer — et quand tu peux vraiment t'arrêter.",
    ambiance: 'Une fin de soirée nette, sans culpabilité.'
  }
  return {
    cle: 'nuit', salut: 'Il se fait tard', I: Moon,
    titre: ['Demain', 'sera plus', 'simple.'],
    sous: "Ce qui reste est déjà noté. Tu peux dormir tranquille.",
    ambiance: 'Après 23 h, l\'app te dit d\'arrêter. Vraiment.'
  }
}

// ===== Bouton principal, plein, façon iOS =====
function BoutonPlein({ children, charge, ...p }) {
  return (
    <button {...p}
      className="t w-full h-[52px] rounded-2xl bg-accent text-fond font-semibold text-[16px]
        flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100">
      {charge ? <Loader2 size={19} className="animate-spin" /> : children}
    </button>
  )
}

// ===== Bouton secondaire (verre) =====
function BoutonVerre({ children, ...p }) {
  return (
    <button {...p}
      className="t w-full h-[50px] rounded-2xl liquid-glass text-fort text-[15px] font-medium
        flex items-center justify-center gap-2 active:scale-[0.98]">
      {children}
    </button>
  )
}

// ===== Champ avec libellé flottant =====
function ChampLabel({ label, mdp, ...p }) {
  const C = mdp ? ChampMdp : Champ
  return (
    <div>
      <label className="block text-[13px] font-medium text-normal mb-1.5 ml-1">{label}</label>
      <C {...p} className="h-[52px] rounded-2xl bg-surface border-[var(--bordure)] text-[16px] px-4" />
    </div>
  )
}

// ===== Connexion par QR Code =====
function BlocQR({ onRetour }) {
  const [qr, setQr] = useState(null)
  const [reste, setReste] = useState(180)
  const [code, setCode] = useState('')
  const [etat, setEtat] = useState('En attente du scan…')
  const [erreur, setErreur] = useState('')
  const tokenRef = useRef(null)

  const generer = async () => {
    setErreur(''); setCode(''); setEtat('En attente du scan…')
    const d = await api.post('/qr/generate', {})
    tokenRef.current = d.token; setQr(d.qr); setReste(d.expires_in)
  }
  useEffect(() => { generer() }, [])
  useEffect(() => {
    const t = setInterval(() => setReste(r => (r <= 1 ? (generer(), 180) : r - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const t = setInterval(async () => {
      if (!tokenRef.current) return
      const d = await api.get('/qr/poll?token=' + tokenRef.current)
      if (d.status === 'scanned') setEtat('Téléphone reconnu — entre le code')
      else if (d.status === 'expired') generer()
    }, 2000)
    return () => clearInterval(t)
  }, [])

  async function verifier(e) {
    e.preventDefault(); setErreur('')
    try {
      const d = await api.post('/qr/verify', { token: tokenRef.current, code })
      ouvrirSession(d); window.location.reload()
    } catch (err) { setErreur(err.message) }
  }

  return (
    <div className="module-enter">
      <button onClick={onRetour} className="t flex items-center gap-1 text-[15px] text-accent mb-5 active:opacity-60">
        <ChevronLeft size={18} /> Retour
      </button>
      <h2 className="titre text-[26px] mb-1">Scanne pour entrer</h2>
      <p className="text-normal text-[15px] mb-6">Ouvre l'appareil photo de ton téléphone.</p>
      {qr && (
        <div className="bg-white p-3 rounded-3xl w-fit mx-auto mb-5">
          <img src={qr} alt="QR Code" className="w-44 h-44 block" />
        </div>
      )}
      <form onSubmit={verifier} className="space-y-3">
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="• • • • • •" inputMode="numeric"
          className="w-full h-[60px] rounded-2xl bg-surface border border-[var(--bordure)] text-center
            text-[26px] tracking-[0.5em] text-fort outline-none focus:border-accent/60" />
        {erreur && <p className="text-alerte text-[14px] text-center">{erreur}</p>}
        <BoutonPlein type="submit" disabled={code.length !== 6}>Valider</BoutonPlein>
      </form>
      <div className="flex items-center justify-between mt-4 text-[13px] text-faible">
        <span>{etat}</span><span>{reste}s</span>
      </div>
    </div>
  )
}

export default function Landing() {
  const lienReset = new URLSearchParams(location.search).get('token')
  const [mode, setMode] = useState(lienReset ? 'reset' : 'accueil') // accueil | login | register | forgot | reset | qr
  const [f, setF] = useState({ nom: '', email: '', mdp: '', code: '', token: lienReset || '' })
  const [erreur, setErreur] = useState('')
  const [info, setInfo] = useState('')
  const [charge, setCharge] = useState(false)
  const [attente, setAttente] = useState(null)
  const [bioDispo] = useState(() => isWebAuthnSupported())
  // Le moment de la journée, figé à l'ouverture de la page
  const [momentJour] = useState(() => moment())
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const reset = (m) => { setMode(m); setErreur(''); setInfo('') }

  async function connexionBio() {
    setErreur('')
    if (!f.email) return setErreur("Entre d'abord ton e-mail.")
    try { await loginWithBiometric(f.email); window.location.reload() }
    catch (err) { setErreur(err.message === 'Failed to fetch' ? 'Biométrie indisponible' : err.message) }
  }

  async function envoyer(e) {
    e.preventDefault()
    setErreur(''); setInfo(''); setCharge(true)
    try {
      if (mode === 'forgot') {
        const d = await api.post('/auth/forgot', { email: f.email })
        setMode('reset')
        if (d.secours && d.code) { setF(x => ({ ...x, code: d.code })); setInfo(`Ton code : ${d.code}`) }
        else setInfo('Code envoyé par e-mail. Ouvre le plus récent.')
      } else if (mode === 'reset') {
        await api.post('/auth/reset', { email: f.email, code: f.code, token: f.token, nouveau: f.mdp })
        history.replaceState({}, '', '/')
        setMode('login'); setF({ ...f, mdp: '', code: '', token: '' })
        setInfo('Mot de passe changé. Connecte-toi.')
      } else {
        const d = mode === 'register'
          ? await api.post('/auth/register', f)
          : await api.post('/auth/login', { email: f.email, mdp: f.mdp })
        if (d.verification) { setAttente(d.email); return }
        ouvrirSession(d); window.location.reload()
      }
    } catch (err) {
      if (/pas encore confirmée/i.test(err.message)) setAttente(f.email)
      else setErreur(err.message)
    } finally { setCharge(false) }
  }

  // ===== Attente de confirmation d'e-mail =====
  if (attente) return (
    <Ecran>
      <div className="module-enter text-center pt-8">
        <div className="w-20 h-20 rounded-[26px] liquid-glass flex items-center justify-center mx-auto mb-6">
          <MailCheck size={34} className="text-accent" />
        </div>
        <h1 className="titre text-[26px] mb-2">Vérifie tes e-mails</h1>
        <p className="text-normal text-[15px] mb-1">On a envoyé un lien à</p>
        <p className="text-fort text-[15px] font-semibold mb-6">{attente}</p>
        <p className="text-faible text-[14px] mb-8 leading-relaxed">
          Clique dessus pour activer ton compte.<br />Regarde aussi dans les spams.
        </p>
        {info && <p className="text-succes text-[14px] mb-4">{info}</p>}
        <BoutonVerre onClick={async () => { await api.post('/auth/resend-verification', { email: attente }); setInfo('E-mail renvoyé.') }}>
          Renvoyer l'e-mail
        </BoutonVerre>
        <button onClick={() => { setAttente(null); setInfo(''); setMode('login') }}
          className="t text-[15px] text-accent mt-5 active:opacity-60">Retour</button>
      </div>
    </Ecran>
  )

  // ===== Écran d'accueil : la première impression, selon l'heure =====
  if (mode === 'accueil') {
    const m = momentJour
    return (
    <Ecran>
      <div className="flex-1 flex flex-col justify-center module-enter">
        {/* Salutation selon l'heure */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-[52px] h-[52px] rounded-[18px] liquid-glass flex items-center justify-center">
            <m.I size={25} className="text-accent" />
          </div>
          <div>
            <div className="text-fort text-[15px] font-medium">{m.salut}</div>
            <div className="text-faible text-[13px]">{heure}</div>
          </div>
        </div>

        <h1 className="titre text-[40px] leading-[1.08] mb-4">
          {m.titre[0]}<br />{m.titre[1]}<br />{m.titre[2]}
        </h1>
        <p className="text-normal text-[17px] leading-relaxed mb-8 max-w-[19rem]">{m.sous}</p>

        {/* Ce qui change vraiment, à ce moment de la journée */}
        <div className="rounded-2xl liquid-glass px-4 py-3 mb-8 flex items-start gap-3">
          <Sparkles size={15} className="text-accent shrink-0 mt-0.5" />
          <p className="text-normal text-[14px] leading-relaxed">{m.ambiance}</p>
        </div>

        {/* Trois promesses, sobres */}
        <div className="space-y-3.5 mb-10">
          {[
            [Sparkles, 'Une seule chose à la fois', "Fini la liste qui fait paniquer."],
            [BatteryLow, "Adapté à ta fatigue", "Cuit ? Le plan se réduit tout seul."],
            [ShieldCheck, 'Chez toi, à toi', 'Tes données ne partent nulle part.']
          ].map(([I, t, d], i) => (
            <div key={t} style={{ animationDelay: (i * 70 + 100) + 'ms' }} className="item-enter flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0 mt-0.5">
                <I size={17} className="text-accent" />
              </div>
              <div>
                <div className="text-fort text-[15px] font-medium">{t}</div>
                <div className="text-faible text-[14px]">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 pb-2">
        <BoutonPlein onClick={() => reset('register')}>Commencer <ArrowRight size={18} /></BoutonPlein>
        <button onClick={() => reset('login')}
          className="t w-full h-[50px] text-[16px] text-normal font-medium active:opacity-60">
          J'ai déjà un compte
        </button>
      </div>
    </Ecran>
  )}

  // ===== QR =====
  if (mode === 'qr') return <Ecran><BlocQR onRetour={() => reset('login')} /></Ecran>

  // ===== Formulaires =====
  const salutations = {
    aube: 'Déjà debout', matin: 'Bonjour', aprem: 'Bon après-midi',
    soir: 'Bonsoir', nuit: 'Bonsoir'
  }
  const titres = {
    login: [salutations[momentJour.cle] || 'Bonjour', 'Content de te revoir.'],
    register: ['On commence', 'Deux minutes, et c\'est réglé.'],
    forgot: ['Mot de passe oublié', 'On t\'envoie un code par e-mail.'],
    reset: ['Nouveau mot de passe', f.token ? 'Lien vérifié — choisis-en un nouveau.' : 'Entre le code reçu.']
  }
  const [titre, sous] = titres[mode]
  const cta = { login: 'Se connecter', register: 'Créer mon compte', forgot: 'Envoyer le code', reset: 'Enregistrer' }[mode]

  return (
    <Ecran>
      <button onClick={() => reset(mode === 'login' || mode === 'register' ? 'accueil' : 'login')}
        className="t flex items-center gap-1 text-[15px] text-accent mb-6 active:opacity-60 -ml-1">
        <ChevronLeft size={18} /> Retour
      </button>

      <div className="module-enter">
        <h1 className="titre text-[30px] leading-tight mb-1.5">{titre}</h1>
        <p className="text-normal text-[15px] mb-8">{sous}</p>

        <form onSubmit={envoyer} className="space-y-4">
          {mode === 'register' && (
            <ChampLabel label="Ton prénom" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })}
              placeholder="Mehdi" autoFocus />
          )}
          <ChampLabel label="E-mail" type="email" inputMode="email" autoComplete="email"
            value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="toi@exemple.com" />

          {mode === 'reset' && !f.token && (
            <ChampLabel label="Code reçu" value={f.code} inputMode="numeric"
              onChange={e => setF({ ...f, code: e.target.value })} placeholder="6 chiffres" autoFocus />
          )}

          {mode !== 'forgot' && (
            <ChampLabel mdp label={mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
              value={f.mdp} onChange={e => setF({ ...f, mdp: e.target.value })}
              placeholder={mode === 'login' ? '••••••••' : '6 caractères minimum'} />
          )}

          {mode === 'login' && (
            <button type="button" onClick={() => reset('forgot')}
              className="t block ml-auto text-[14px] text-accent active:opacity-60">Mot de passe oublié ?</button>
          )}

          {erreur && (
            <div className="rounded-2xl bg-[color-mix(in_srgb,var(--alerte)_12%,transparent)] px-4 py-3">
              <p className="text-alerte text-[14px]">{erreur}</p>
            </div>
          )}
          {info && <p className="text-succes text-[14px] px-1">{info}</p>}

          <div className="pt-1">
            <BoutonPlein type="submit" charge={charge}>{cta} <ArrowRight size={18} /></BoutonPlein>
          </div>
        </form>

        {/* Autres méthodes */}
        {mode === 'login' && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[var(--bordure)]" />
              <span className="text-faible text-[13px]">ou</span>
              <div className="flex-1 h-px bg-[var(--bordure)]" />
            </div>
            <div className="space-y-3">
              <BoutonVerre onClick={() => reset('qr')}><QrCode size={18} /> Connexion par QR Code</BoutonVerre>
              {bioDispo && <BoutonVerre onClick={connexionBio}><Fingerprint size={18} /> Face ID / Touch ID</BoutonVerre>}
            </div>
          </>
        )}

        {mode === 'register' && (
          <p className="text-faible text-[13px] leading-relaxed mt-6 flex items-start gap-2">
            <ShieldCheck size={15} className="text-succes shrink-0 mt-0.5" />
            Tes données restent sur ta machine. Mot de passe chiffré, messages illisibles par le serveur.
          </p>
        )}

        {(mode === 'login' || mode === 'register') && (
          <p className="text-center text-[15px] text-normal mt-7">
            {mode === 'login' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
            <button onClick={() => reset(mode === 'login' ? 'register' : 'login')}
              className="t text-accent font-medium active:opacity-60">
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        )}
      </div>
    </Ecran>
  )
}

// Cadre commun : plein écran sur iPhone, centré sur grand écran
function Ecran({ children }) {
  return (
    <div className="min-h-full flex justify-center overflow-auto">
      <div className="w-full max-w-[26rem] flex flex-col px-6"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)',
          minHeight: '100%'
        }}>
        {children}
      </div>
    </div>
  )
}
