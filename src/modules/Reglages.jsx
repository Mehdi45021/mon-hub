import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Check, Sun, Moon, LogOut, Mail, KeyRound, Globe } from 'lucide-react'
import { api, utilisateur, fermerSession } from '../lib/api'
import { EnTete, Carte, Bouton, Champ, ChampMdp, Select } from '../components/ui'
import { usePrefs } from '../lib/theme'

// Couleurs d'accent proposées (valeur affichée = version sombre)
const ACCENTS = [
  ['ambre', '#E0915C'], ['rose', '#E0708C'], ['vert', '#5FB37A'],
  ['bleu', '#7AA2E3'], ['violet', '#A78BFA'], ['turquoise', '#5CC8C2']
]

export default function Reglages() {
  const [msg, setMsg] = useState('')
  const fichier = useRef(null)
  const { prefs, definir, basculerTheme } = usePrefs()
  // Compte
  const [user, setUser] = useState(utilisateur())
  const [mdp, setMdp] = useState({ ancien: '', nouveau: '' })
  const [msgCompte, setMsgCompte] = useState('')
  const [langues, setLangues] = useState([])
  const [langue, setLangue] = useState('auto')

  useEffect(() => {
    api.get('/profil/langues').then(setLangues).catch(() => {})
    api.get('/profil/langue').then(d => setLangue(d.langue)).catch(() => {})
  }, [])

  async function changerLangue(v) {
    setLangue(v); await api.put('/profil/langue', { langue: v })
  }

  async function basculerNotif() {
    const actif = !user.notif_connexion
    await api.post('/auth/notif', { actif })
    const maj = { ...user, notif_connexion: actif ? 1 : 0 }
    setUser(maj); localStorage.setItem('user', JSON.stringify(maj))
  }
  async function changerMdp(e) {
    e.preventDefault(); setMsgCompte('')
    try {
      await api.post('/auth/password', mdp)
      setMdp({ ancien: '', nouveau: '' })
      setMsgCompte('✓ Mot de passe changé — un e-mail de confirmation t\'a été envoyé.')
    } catch (err) { setMsgCompte('⚠️ ' + err.message) }
  }

  async function exporter() {
    const d = await api.get('/export')
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mon-hub-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }
  async function importer(e) {
    const f = e.target.files[0]
    if (!f) return
    if (!confirm('Remplacer TOUTES les données actuelles par ce fichier ?')) return
    const json = JSON.parse(await f.text())
    await api.post('/import', { data: json.data || json })
    setMsg('Import réussi — rechargement…')
    setTimeout(() => window.location.reload(), 600)
  }

  return (
    <div className="max-w-2xl">
      <EnTete section="PLATEFORME" titre="Réglages" />

      {/* ===== Compte ===== */}
      <Carte className="p-5 mb-4 space-y-5">
        <div className="eyebrow">Compte</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-fort">{user?.nom}</div>
            <div className="text-xs text-faible">{user?.email}</div>
          </div>
          <Bouton onClick={fermerSession} className="hover:text-alerte"><LogOut size={16} /> Déconnexion</Bouton>
        </div>

        {/* Option : e-mail à chaque connexion */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-normal"><Mail size={14} className="text-faible" /> E-mail à chaque connexion</div>
          <button onClick={basculerNotif} role="switch" aria-checked={!!user?.notif_connexion}
            className={`t w-11 h-6 rounded-full border relative ${user?.notif_connexion ? 'bg-[color-mix(in_srgb,var(--accent)_35%,transparent)] border-accent/60' : 'bg-surface-haute border-[var(--bordure)]'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-fort t ${user?.notif_connexion ? 'left-[1.375rem]' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Changement de mot de passe */}
        <form onSubmit={changerMdp} className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-normal"><KeyRound size={14} className="text-faible" /> Changer le mot de passe</div>
          <div className="flex gap-2 flex-wrap">
            <ChampMdp value={mdp.ancien} onChange={e => setMdp({ ...mdp, ancien: e.target.value })} placeholder="Actuel" className="flex-1 min-w-[8rem]" />
            <ChampMdp value={mdp.nouveau} onChange={e => setMdp({ ...mdp, nouveau: e.target.value })} placeholder="Nouveau (6 min.)" className="flex-1 min-w-[8rem]" />
            <Bouton variante="primaire" type="submit">Changer</Bouton>
          </div>
          {msgCompte && <p className={`text-sm ${msgCompte.startsWith('✓') ? 'text-succes' : 'text-alerte'}`}>{msgCompte}</p>}
        </form>
      </Carte>

      <Carte className="p-5 mb-4 space-y-5">
        <div className="eyebrow">Apparence</div>

        {/* Thème */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-normal">Thème</p>
          <div className="flex gap-1">
            {[['dark', 'Sombre', Moon], ['light', 'Clair', Sun]].map(([v, l, Ic]) => (
              <button key={v} onClick={() => definir('theme', v)}
                className={`t inline-flex items-center gap-2 h-9 px-3 rounded border text-sm ${prefs.theme === v ? 'border-accent/60 text-fort' : 'border-[var(--bordure)] text-faible hover:text-fort'}`}>
                <Ic size={14} /> {l}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur d'accent */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-normal">Couleur d'accent</p>
          <div className="flex gap-2">
            {ACCENTS.map(([nom, coul]) => (
              <button key={nom} onClick={() => definir('accent', nom)} title={nom}
                className={`t w-7 h-7 rounded-full flex items-center justify-center border-2 ${prefs.accent === nom ? 'border-fort' : 'border-transparent hover:border-faible'}`}
                style={{ background: coul }}>
                {prefs.accent === nom && <Check size={13} strokeWidth={3} className="text-black/70" />}
              </button>
            ))}
          </div>
        </div>

        {/* Langue */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-normal"><Globe size={14} className="text-faible" /> Langue</div>
          <Select value={langue} onChange={e => changerLangue(e.target.value)}>
            {langues.map(l => <option key={l.id} value={l.id}>{l.drapeau} {l.nom}</option>)}
          </Select>
        </div>

        {/* Densité */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-normal">Densité de l'interface</p>
          <Select value={prefs.densite} onChange={e => definir('densite', e.target.value)}>
            <option value="compact">Compacte</option>
            <option value="normal">Normale</option>
            <option value="grand">Spacieuse</option>
          </Select>
        </div>
      </Carte>

      <Carte className="p-5">
        <div className="eyebrow mb-1">Sauvegarde</div>
        <p className="text-sm text-faible mb-4">Exporte ou réimporte toutes tes données en un fichier JSON.</p>
        <div className="flex gap-2">
          <Bouton onClick={exporter}><Download size={16} /> Exporter</Bouton>
          <Bouton onClick={() => fichier.current.click()}><Upload size={16} /> Importer</Bouton>
          <input ref={fichier} type="file" accept="application/json" className="hidden" onChange={importer} />
        </div>
        {msg && <p className="text-sm text-succes mt-3">{msg}</p>}
      </Carte>
    </div>
  )
}
