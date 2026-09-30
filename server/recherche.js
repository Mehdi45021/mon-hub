// Recherche unifiée : dans TES données (local) ou sur le WEB (DuckDuckGo + Wikipédia),
// puis synthèse par l'IA avec citation des sources. Aucune clé API nécessaire.
import express from 'express'
import db from './db.js'
import { ia } from './ai.js'
import { texte } from './security.js'
import { contexteCerveau, observer, ajouterMessage } from './cerveau.js'

const router = express.Router()
const nettoyer = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

// ===== Recherche web via DuckDuckGo (HTML, sans clé) =====
// periode : 'jour' limite aux dernières 24 h
export async function chercherWeb(q, periode = null, max = 6) {
  const params = new URLSearchParams({ q, kl: 'fr-fr' })
  if (periode === 'jour') params.set('df', 'd')
  else if (periode === 'semaine') params.set('df', 'w')
  const r = await fetch('https://html.duckduckgo.com/html/?' + params, {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  })
  const html = await r.text()
  const resultats = []
  const bloc = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g
  let m
  while ((m = bloc.exec(html)) && resultats.length < max) {
    let url = m[1]
    // DuckDuckGo enveloppe parfois les liens dans une redirection
    const vrai = url.match(/uddg=([^&]+)/)
    if (vrai) url = decodeURIComponent(vrai[1])
    resultats.push({ titre: nettoyer(m[2]), url, extrait: nettoyer(m[3]).slice(0, 300) })
  }
  return resultats
}

// ===== Définition via Wikipédia (fiable pour "c'est quoi …") =====
export async function definitionWiki(terme) {
  try {
    const r = await fetch('https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(terme), {
      headers: { 'user-agent': 'MonHub/1.0' }
    })
    if (!r.ok) return null
    const d = await r.json()
    if (!d.extract) return null
    return { titre: d.title, url: d.content_urls?.desktop?.page, extrait: d.extract }
  } catch { return null }
}

// ===== Recherche locale dans les données de l'utilisateur =====
export function chercherLocal(userId, q, max = 8) {
  const like = `%${q}%`
  const brut = (s) => nettoyer(s).slice(0, 200)
  const f = (sql, type, champ) => db.prepare(sql).all(userId, like, like).map(r => ({
    type, titre: r.titre, extrait: brut(r[champ] || '')
  }))
  return [
    ...f('SELECT titre, contenu FROM notes WHERE user_id=? AND (titre LIKE ? OR contenu LIKE ?) LIMIT 5', 'Note', 'contenu'),
    ...f('SELECT titre, contenu FROM revisions WHERE user_id=? AND (titre LIKE ? OR contenu LIKE ?) LIMIT 5', 'Fiche', 'contenu'),
    ...f('SELECT titre, titre AS contenu FROM tasks WHERE user_id=? AND (titre LIKE ? OR titre LIKE ?) LIMIT 5', 'Tâche', 'contenu'),
    ...f('SELECT titre, titre AS contenu FROM homework WHERE user_id=? AND (titre LIKE ? OR titre LIKE ?) LIMIT 5', 'Devoir', 'contenu'),
    ...f('SELECT question AS titre, reponse AS contenu FROM flashcards WHERE user_id=? AND (question LIKE ? OR reponse LIKE ?) LIMIT 5', 'Flashcard', 'contenu'),
    ...f('SELECT mot AS titre, traduction AS contenu FROM vocab WHERE user_id=? AND (mot LIKE ? OR traduction LIKE ?) LIMIT 5', 'Vocabulaire', 'contenu')
  ].slice(0, max)
}

// ===== Endpoint principal =====
// mode : 'local' | 'web' | 'auto'  ·  periode : null | 'jour' | 'semaine'
router.post('/', async (req, res) => {
  const q = texte(req.body.q, 400)
  const mode = ['local', 'web', 'auto'].includes(req.body.mode) ? req.body.mode : 'auto'
  const periode = ['jour', 'semaine'].includes(req.body.periode) ? req.body.periode : null
  if (!q) return res.status(400).json({ erreur: 'Question vide' })
  observer(req.user.id, 'recherche', mode)

  try {
    const locaux = (mode === 'local' || mode === 'auto') ? chercherLocal(req.user.id, q) : []
    let web = [], wiki = null
    if (mode === 'web' || (mode === 'auto' && locaux.length === 0)) {
      ;[web, wiki] = await Promise.all([
        chercherWeb(q, periode).catch(() => []),
        periode ? Promise.resolve(null) : definitionWiki(q.replace(/^(c'est quoi|définition de|qu'est[- ]ce que)\s+/i, '').trim()).catch(() => null)
      ])
    }

    // Contexte transmis à l'IA
    const parties = []
    if (locaux.length) parties.push('DANS TES DONNÉES :\n' + locaux.map((r, i) => `[L${i + 1}] (${r.type}) ${r.titre} — ${r.extrait}`).join('\n'))
    if (wiki) parties.push(`WIKIPÉDIA :\n[W] ${wiki.titre} — ${wiki.extrait}`)
    if (web.length) parties.push('RÉSULTATS WEB :\n' + web.map((r, i) => `[${i + 1}] ${r.titre} — ${r.extrait} (${r.url})`).join('\n'))

    if (!parties.length) return res.json({ reponse: 'Aucun résultat trouvé, ni dans tes données ni sur le web.', sources: [] })

    const consigne = periode === 'jour' ? ' Concentre-toi sur les informations des dernières 24 heures.' : ''
    const { reponse } = await ia([{
      role: 'user',
      content: `Question : "${q}"\n\n${parties.join('\n\n')}\n\nRéponds en français, de façon claire et concise.${consigne} Cite tes sources avec leur numéro entre crochets (ex. [1], [L2]). Si les sources ne répondent pas, dis-le franchement.`
    }], { system: 'Tu es l\'assistant de recherche de Mon Hub. Tu réponds uniquement à partir des sources fournies.\n\n' + contexteCerveau(req.user.id), max: 900 })

    const sources = [
      ...locaux.map((r, i) => ({ ref: `L${i + 1}`, type: r.type, titre: r.titre, local: true })),
      ...(wiki ? [{ ref: 'W', type: 'Wikipédia', titre: wiki.titre, url: wiki.url }] : []),
      ...web.map((r, i) => ({ ref: String(i + 1), type: 'Web', titre: r.titre, url: r.url }))
    ]

    // Historique
    if (req.body.conv_id) {
      ajouterMessage(req.user.id, req.body.conv_id, 'user', q)
      ajouterMessage(req.user.id, req.body.conv_id, 'assistant', reponse, sources)
    }
    res.json({ reponse, sources, mode: locaux.length && mode !== 'web' ? 'local' : 'web' })
  } catch (e) {
    res.status(e.code || 500).json({ erreur: e.message })
  }
})

export default router
