// BLOC 8 — Helpers WebAuthn côté navigateur (équivalent /assets/js/webauthn.js)
// La biométrie reste sur l'appareil : seul un défi signé transite.
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { api, ouvrirSession } from './api'

// Le navigateur supporte-t-il WebAuthn ? (sinon on masque le bouton silencieusement)
export const isWebAuthnSupported = () =>
  typeof window !== 'undefined' && !!window.PublicKeyCredential && window.isSecureContext

// Enregistre l'appareil courant (Face ID / Touch ID / Windows Hello / empreinte)
export async function registerBiometric(nomAppareil) {
  const options = await api.post('/webauthn/register/begin', {})
  const credential = await startRegistration(options)
  return api.post('/webauthn/register/finish', { credential, device_name: nomAppareil })
}

// Connexion biométrique depuis la page d'accueil
export async function loginWithBiometric(email) {
  const options = await api.post('/webauthn/auth/begin', { email })
  const credential = await startAuthentication(options)
  const d = await api.post('/webauthn/auth/finish', { uid: options.uid, credential })
  ouvrirSession(d)
  return d
}
