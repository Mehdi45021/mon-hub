import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Sparkles, Layers, FileDown, FileImage, Upload, HelpCircle } from 'lucide-react'
import { api } from '../lib/api'
import { EnTete, Carte, Bouton, BoutonIcone } from '../components/ui'
import TagBar from '../components/Tags'
import Liens from '../components/Liens'
import RichEditor, { exportPDF, exportPNG } from '../components/RichEditor'
import Quiz from '../components/Quiz'
import { md } from '../lib/markdown'

const texteBrut = (html) => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.innerText }

export default function Notes() {
  const [notes, setNotes] = useState([])
  const [sel, setSel] = useState(null)
  const [etat, setEtat] = useState('')
  const [resume, setResume] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [iaCharge, setIaCharge] = useState('')
  const timer = useRef(null)
  const fichier = useRef(null)

  const charger = () => api.get('/notes').then(setNotes)
  useEffect(() => { charger() }, [])

  async function nouvelle() { const n = await api.post('/notes', { titre: 'Sans titre', contenu: '' }); await charger(); ouvrir(n) }
  function ouvrir(n) { setSel(n); setEtat(''); setResume(''); setQuiz(null) }
  async function supprimer(id) { await api.del('/notes/' + id); if (sel?.id === id) setSel(null); charger() }
  function modifier(champ, val) {
    const maj = { ...sel, [champ]: val }
    setSel(maj); setEtat('Modifié…')
    setNotes(ns => ns.map(n => n.id === maj.id ? maj : n))
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => { await api.put('/notes/' + maj.id, { titre: maj.titre, contenu: maj.contenu }); setEtat('Enregistré'); charger() }, 600)
  }
  // Import fichier .md/.txt/.html
  async function importer(e) {
    const f = e.target.files[0]; if (!f) return
    const txt = await f.text()
    const html = f.name.endsWith('.md') ? md(txt) : f.name.endsWith('.html') ? txt : '<p>' + txt.replace(/\n/g, '</p><p>') + '</p>'
    const n = await api.post('/notes', { titre: f.name.replace(/\.[^.]+$/, ''), contenu: html })
    await charger(); ouvrir(n); e.target.value = ''
  }

  async function resumer() {
    setIaCharge('resume'); setResume('')
    try { const d = await api.post('/ai/summarize', { text: texteBrut(sel.contenu) }); setResume(d.resume) }
    catch (e) { setResume('⚠️ ' + e.message) } finally { setIaCharge('') }
  }
  async function genererFlashcards() {
    setIaCharge('cartes')
    try { const d = await api.post('/ai/flashcards', { text: texteBrut(sel.contenu), save: true }); setResume(`✓ ${d.cartes.length} flashcards créées (section Flashcards).`) }
    catch (e) { setResume('⚠️ ' + e.message) } finally { setIaCharge('') }
  }
  async function genererQuiz() {
    setIaCharge('quiz'); setQuiz(null); setResume('')
    try { const d = await api.post('/ai/quiz', { text: texteBrut(sel.contenu) }); d.questions?.length ? setQuiz(d.questions) : setResume('Quiz indisponible (contenu trop court ?).') }
    catch (e) { setResume('⚠️ ' + e.message) } finally { setIaCharge('') }
  }

  return (
    <div>
      <EnTete section="NOTES" titre="Notes" action={
        <div className="flex gap-2">
          <Bouton onClick={() => fichier.current.click()}><Upload size={16} /> Importer</Bouton>
          <Bouton variante="primaire" onClick={nouvelle}><Plus size={16} /> Nouvelle</Bouton>
          <input ref={fichier} type="file" accept=".md,.txt,.html" className="hidden" onChange={importer} />
        </div>
      } />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Carte className="w-60 shrink-0 p-2 overflow-auto">
          {notes.map(n => (
            <button key={n.id} onClick={() => ouvrir(n)}
              className={`t w-full text-left px-3 h-9 flex items-center rounded text-sm truncate ${sel?.id === n.id ? 'bg-surface-haute text-fort' : 'text-normal hover:bg-surface-haute hover:text-fort'}`}>
              {n.titre || 'Sans titre'}
            </button>
          ))}
          {notes.length === 0 && <div className="px-3 py-6 text-faible text-sm">Aucune note.</div>}
        </Carte>
        <Carte className="flex-1 p-4 flex flex-col min-w-0">
          {sel ? <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <input value={sel.titre} onChange={e => modifier('titre', e.target.value)} className="flex-1 min-w-[8rem] bg-transparent titre text-lg outline-none" placeholder="Titre" />
              <span className="eyebrow">{etat}</span>
              <BoutonIcone onClick={() => exportPDF(sel.contenu, sel.titre)} title="Export PDF"><FileDown size={16} /></BoutonIcone>
              <BoutonIcone onClick={() => exportPNG(sel.contenu, sel.titre)} title="Export PNG"><FileImage size={16} /></BoutonIcone>
              <BoutonIcone onClick={() => supprimer(sel.id)} className="hover:text-alerte"><Trash2 size={16} /></BoutonIcone>
            </div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <TagBar type="notes" id={sel.id} />
              <div className="flex-1" />
              <Bouton onClick={resumer} disabled={iaCharge}><Sparkles size={14} />{iaCharge === 'resume' ? '…' : 'Résumer'}</Bouton>
              <Bouton onClick={genererFlashcards} disabled={iaCharge}><Layers size={14} />{iaCharge === 'cartes' ? '…' : 'Flashcards'}</Bouton>
              <Bouton onClick={genererQuiz} disabled={iaCharge}><HelpCircle size={14} />{iaCharge === 'quiz' ? '…' : 'Quiz'}</Bouton>
            </div>
            {resume && <Carte className="p-3 mb-3 text-sm text-normal whitespace-pre-wrap bg-fond">{resume}</Carte>}
            {quiz && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4" onMouseDown={() => setQuiz(null)}>
                <div className="w-full max-w-lg" onMouseDown={e => e.stopPropagation()}>
                  <Quiz questions={quiz} onFermer={() => setQuiz(null)} />
                </div>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <RichEditor docKey={sel.id} value={sel.contenu} onChange={v => modifier('contenu', v)} />
            </div>
            <div className="border-t border-[var(--bordure)] pt-3 mt-3"><Liens type="notes" id={sel.id} /></div>
          </> : <div className="m-auto text-faible text-sm">Sélectionne ou crée une note.</div>}
        </Carte>
      </div>
    </div>
  )
}
