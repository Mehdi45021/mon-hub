// Appel IA mutualisé : essaie les fournisseurs DANS L'ORDRE, renvoie le 1er opérationnel.
function fournisseurs() {
  return [
    { nom: 'anthropic', cle: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', type: 'anthropic' },
    { nom: 'openai', cle: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', base: 'https://api.openai.com/v1', type: 'openai' },
    { nom: 'gemini', cle: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || 'gemini-2.0-flash', base: 'https://generativelanguage.googleapis.com/v1beta/openai', type: 'openai' },
    { nom: 'groq', cle: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', base: 'https://api.groq.com/openai/v1', type: 'openai' },
    { nom: 'mistral', cle: process.env.MISTRAL_API_KEY, model: process.env.MISTRAL_MODEL || 'mistral-small-latest', base: 'https://api.mistral.ai/v1', type: 'openai' },
    { nom: 'openrouter', cle: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct', base: 'https://openrouter.ai/api/v1', type: 'openai' }
  ].filter(f => f.cle && f.cle.trim())
}

async function appelAnthropic(f, sys, messages, max) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': f.cle, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: f.model, max_tokens: max, system: sys, messages })
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message)
  return d.content?.map(c => c.text).join('') || ''
}
async function appelOpenAI(f, sys, messages, max) {
  const r = await fetch(f.base + '/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + f.cle },
    body: JSON.stringify({ model: f.model, max_tokens: max, messages: [{ role: 'system', content: sys }, ...messages] })
  })
  const d = await r.json()
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error))
  return d.choices?.[0]?.message?.content || ''
}

// ia(messages, {system, max}) → { reponse, via } ; lève une erreur si aucun fournisseur.
export async function ia(messages, { system = '', max = 800 } = {}) {
  const dispo = fournisseurs()
  if (!dispo.length) { const e = new Error('Aucune clé IA dans .env'); e.code = 400; throw e }
  const erreurs = []
  for (const f of dispo) {
    try {
      const reponse = f.type === 'anthropic' ? await appelAnthropic(f, system, messages, max) : await appelOpenAI(f, system, messages, max)
      if (reponse) return { reponse, via: f.nom }
      erreurs.push(`${f.nom}: vide`)
    } catch (e) { erreurs.push(`${f.nom}: ${e.message}`) }
  }
  const e = new Error('Aucun fournisseur opérationnel — ' + erreurs.join(' | ')); e.code = 502; throw e
}

// Extrait le premier bloc JSON d'un texte (pour les actions/quiz). Renvoie null si absent.
export function extraireJSON(txt) {
  const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/) || txt.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}
