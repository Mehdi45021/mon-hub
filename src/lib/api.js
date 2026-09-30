// Petit helper fetch JSON pour l'API (jeton de session inclus automatiquement)
async function req(url, opts) {
  const token = localStorage.getItem('token')
  const csrf = localStorage.getItem('csrf')
  const r = await fetch('/api' + url, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}), // BLOC 2B — protection CSRF
      ...(opts?.headers || {})
    }
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && !url.startsWith('/auth')) {
    // Session expirée / rejetée : retour à la page d'accueil
    localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('csrf')
    window.location.reload()
  }
  if (!r.ok) throw new Error(d.erreur || 'Erreur API')
  return d
}

export const api = {
  get: (u) => req(u),
  post: (u, body) => req(u, { method: 'POST', body: JSON.stringify(body) }),
  put: (u, body) => req(u, { method: 'PUT', body: JSON.stringify(body) }),
  del: (u) => req(u, { method: 'DELETE' })
}

// ===== Session =====
export const utilisateur = () => { try { return JSON.parse(localStorage.getItem('user')) } catch { return null } }
export function ouvrirSession(d) {
  localStorage.setItem('token', d.token)
  if (d.csrf) localStorage.setItem('csrf', d.csrf)
  localStorage.setItem('user', JSON.stringify(d.user))
}
export async function fermerSession() {
  try { await api.post('/auth/logout', {}) } catch {}
  localStorage.removeItem('token'); localStorage.removeItem('user'); localStorage.removeItem('csrf')
  window.location.reload()
}
