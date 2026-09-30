import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, Heading1, Heading2, Heading3, List, ListOrdered, Highlighter, Image as ImageIcon, Square, AlignLeft, AlignCenter, Type } from 'lucide-react'
import { BoutonIcone } from './ui'

// Styles appliqués au contenu (écran ET export). Couleurs explicites pour l'export image.
const STYLE_RICHE = `
  .rich-doc { font-family:'Inter',sans-serif; font-size:14px; line-height:1.7; color:#1A1B1E; }
  .rich-doc h1{font-size:26px;font-weight:600;margin:.4em 0;letter-spacing:-.02em}
  .rich-doc h2{font-size:20px;font-weight:600;margin:.4em 0}
  .rich-doc h3{font-size:16px;font-weight:600;margin:.4em 0}
  .rich-doc p{margin:.4em 0}
  .rich-doc ul{list-style:disc;padding-left:1.4em;margin:.4em 0}
  .rich-doc ol{list-style:decimal;padding-left:1.4em;margin:.4em 0}
  .rich-doc img{max-width:100%;border-radius:8px;margin:.4em 0}
  .rich-doc .encadre{border:1px solid #E0915C;background:#FBEFE6;border-radius:8px;padding:10px 12px;margin:.5em 0}
  .rich-doc a{color:#B45309}
`
const POLICES = ['Inter', 'Georgia', 'Times New Roman', 'Courier New', 'Arial']
const COULEURS = ['#1A1B1E', '#E0915C', '#E5675E', '#5FB37A', '#7AA2E3', '#B45309']

// Éditeur de texte enrichi. value=HTML, onChange(html). docKey force le rechargement à chaque doc.
export default function RichEditor({ value, onChange, docKey }) {
  const ref = useRef(null)
  const img = useRef(null)

  // Charge le contenu quand on change de document
  useEffect(() => { if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '' }, [docKey])

  const cmd = (c, v = null) => { document.execCommand(c, false, v); ref.current.focus(); emit() }
  const emit = () => onChange(ref.current.innerHTML)

  function bloc(tag) { document.execCommand('formatBlock', false, tag); ref.current.focus(); emit() }
  function encadre() {
    const sel = window.getSelection()
    const txt = sel.toString() || 'Texte encadré'
    document.execCommand('insertHTML', false, `<div class="encadre">${txt}</div>`)
    emit()
  }
  function insererImage(e) {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = () => { document.execCommand('insertImage', false, r.result); emit() }
    r.readAsDataURL(f)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <style>{STYLE_RICHE}</style>
      {/* Barre d'outils */}
      <div className="flex items-center gap-0.5 flex-wrap pb-2 mb-2 border-b border-[var(--bordure)]">
        <BoutonIcone onClick={() => bloc('H1')} className="w-8 h-8" title="Titre 1"><Heading1 size={16} /></BoutonIcone>
        <BoutonIcone onClick={() => bloc('H2')} className="w-8 h-8" title="Titre 2"><Heading2 size={16} /></BoutonIcone>
        <BoutonIcone onClick={() => bloc('H3')} className="w-8 h-8" title="Titre 3"><Heading3 size={16} /></BoutonIcone>
        <span className="w-px h-5 bg-[var(--bordure)] mx-1" />
        <BoutonIcone onClick={() => cmd('bold')} className="w-8 h-8"><Bold size={15} /></BoutonIcone>
        <BoutonIcone onClick={() => cmd('italic')} className="w-8 h-8"><Italic size={15} /></BoutonIcone>
        <BoutonIcone onClick={() => cmd('underline')} className="w-8 h-8"><Underline size={15} /></BoutonIcone>
        <span className="w-px h-5 bg-[var(--bordure)] mx-1" />
        <BoutonIcone onClick={() => cmd('insertUnorderedList')} className="w-8 h-8"><List size={16} /></BoutonIcone>
        <BoutonIcone onClick={() => cmd('insertOrderedList')} className="w-8 h-8"><ListOrdered size={16} /></BoutonIcone>
        <BoutonIcone onClick={() => cmd('justifyLeft')} className="w-8 h-8"><AlignLeft size={16} /></BoutonIcone>
        <BoutonIcone onClick={() => cmd('justifyCenter')} className="w-8 h-8"><AlignCenter size={16} /></BoutonIcone>
        <span className="w-px h-5 bg-[var(--bordure)] mx-1" />
        {/* Couleur du texte */}
        <label className="t w-8 h-8 flex items-center justify-center rounded text-faible hover:bg-surface-haute cursor-pointer" title="Couleur">
          <Type size={15} />
          <input type="color" className="sr-only" onChange={e => cmd('foreColor', e.target.value)} />
        </label>
        {/* Surlignage */}
        <label className="t w-8 h-8 flex items-center justify-center rounded text-faible hover:bg-surface-haute cursor-pointer" title="Surligner">
          <Highlighter size={15} />
          <input type="color" className="sr-only" onChange={e => cmd('hiliteColor', e.target.value)} />
        </label>
        <BoutonIcone onClick={encadre} className="w-8 h-8" title="Encadré"><Square size={15} /></BoutonIcone>
        <BoutonIcone onClick={() => img.current.click()} className="w-8 h-8" title="Image"><ImageIcon size={15} /></BoutonIcone>
        <input ref={img} type="file" accept="image/*" className="hidden" onChange={insererImage} />
        {/* Police */}
        <select onChange={e => cmd('fontName', e.target.value)} className="t h-8 ml-1 px-2 rounded border border-[var(--bordure)] bg-fond text-xs text-normal outline-none">
          {POLICES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {/* Zone éditable (fond clair pour cohérence avec l'export imprimable) */}
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit}
        className="rich-doc flex-1 overflow-auto rounded p-5 outline-none"
        style={{ background: '#FFFFFF', minHeight: '12rem' }} />
    </div>
  )
}

// ===== Export (réutilisable) =====
export function exportPDF(html, titre = 'document') {
  const w = window.open('', '_blank')
  w.document.write(`<!doctype html><html><head><title>${titre}</title><meta charset="utf-8"><style>${STYLE_RICHE} body{margin:40px;background:#fff}</style></head><body><div class="rich-doc">${html}</div><script>onload=()=>{print()}<\/script></body></html>`)
  w.document.close()
}
export async function exportPNG(html, titre = 'document') {
  const largeur = 800
  const conteneur = document.createElement('div')
  conteneur.className = 'rich-doc'
  conteneur.style.cssText = `width:${largeur}px;padding:40px;background:#fff`
  conteneur.innerHTML = `<style>${STYLE_RICHE}</style>` + html
  document.body.appendChild(conteneur)
  const hauteur = conteneur.scrollHeight
  document.body.removeChild(conteneur)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="rich-doc" style="width:${largeur - 80}px;padding:40px;background:#fff"><style>${STYLE_RICHE}</style>${html}</div></foreignObject></svg>`
  const imgEl = new Image()
  imgEl.onload = () => {
    const c = document.createElement('canvas'); c.width = largeur; c.height = hauteur
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, largeur, hauteur); ctx.drawImage(imgEl, 0, 0)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = titre + '.png'; a.click()
  }
  imgEl.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}
