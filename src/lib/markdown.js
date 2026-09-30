// Mini convertisseur Markdown → HTML (sans dépendance). Couvre l'essentiel.
function echappe(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

export function md(src = '') {
  const lignes = echappe(src).split('\n')
  let html = '', liste = false, codeBloc = false
  const finListe = () => { if (liste) { html += '</ul>'; liste = false } }
  for (const l of lignes) {
    if (l.trim().startsWith('```')) { // bloc de code
      if (!codeBloc) { finListe(); html += '<pre><code>'; codeBloc = true }
      else { html += '</code></pre>'; codeBloc = false }
      continue
    }
    if (codeBloc) { html += l + '\n'; continue }
    const h = l.match(/^(#{1,6})\s+(.*)/)
    if (h) { finListe(); const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; continue }
    if (/^\s*[-*]\s+/.test(l)) { if (!liste) { html += '<ul>'; liste = true } html += `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`; continue }
    finListe()
    if (l.trim() === '') html += ''
    else html += `<p>${inline(l)}</p>`
  }
  finListe()
  if (codeBloc) html += '</code></pre>'
  return html
}
