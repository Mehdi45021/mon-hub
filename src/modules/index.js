import { Home, Calendar, CheckSquare, StickyNote, FolderOpen, MessageSquare, Trash2, Settings, Timer, Repeat } from 'lucide-react'
import Accueil from './Accueil.jsx'
import CeSoir from './CeSoir.jsx'
import Calendrier from './Calendrier.jsx'
import Taches from './Taches.jsx'
import Notes from './Notes.jsx'
import Fichiers from './Fichiers.jsx'
import ChatIA from './ChatIA.jsx'
import Corbeille from './Corbeille.jsx'
import Reglages from './Reglages.jsx'
import Pomodoro from './Pomodoro.jsx'
import Habitudes from './Habitudes.jsx'
import EmploiDuTemps from './EmploiDuTemps.jsx'
import Devoirs from './Devoirs.jsx'
import Scolarite from './Scolarite.jsx'
import Flashcards from './Flashcards.jsx'
import Fiches from './Fiches.jsx'
import Bibliotheque from './Bibliotheque.jsx'
import Vocabulaire from './Vocabulaire.jsx'
import Markdown from './Markdown.jsx'
import Favoris from './Favoris.jsx'
import RechercheIA from './RechercheIA.jsx'
import Messages from './Messages.jsx'
import Securite from './Securite.jsx'
import Cerveau from './Cerveau.jsx'
import { CalendarClock, BookCheck, GraduationCap, Layers, FileText, Languages, Hash, Bookmark, Sparkles, Mail, Shield, Brain, MoonStar, BookOpen } from 'lucide-react'

// REGISTRE DES MODULES.
// Ajouter une section = créer un composant + ajouter une ligne ici (avec son groupe).
export const MODULES = [
  { id: 'soir', nom: 'Ce soir', icone: MoonStar, composant: CeSoir, groupe: 'Général' },
  { id: 'calendrier', nom: 'Calendrier', icone: Calendar, composant: Calendrier, groupe: 'Général' },
  { id: 'chat', nom: 'Chat IA', icone: MessageSquare, composant: ChatIA, groupe: 'Général' },
  { id: 'cerveau', nom: 'Cerveau', icone: Brain, composant: Cerveau, groupe: 'Général' },

  { id: 'taches', nom: 'Tâches', icone: CheckSquare, composant: Taches, groupe: 'Productivité' },
  { id: 'pomodoro', nom: 'Focus', icone: Timer, composant: Pomodoro, groupe: 'Productivité' },
  { id: 'habitudes', nom: 'Habitudes', icone: Repeat, composant: Habitudes, groupe: 'Productivité' },
  { id: 'notes', nom: 'Notes', icone: StickyNote, composant: Notes, groupe: 'Productivité' },
  { id: 'fichiers', nom: 'Fichiers', icone: FolderOpen, composant: Fichiers, groupe: 'Productivité' },

  { id: 'edt', nom: 'Emploi du temps', icone: CalendarClock, composant: EmploiDuTemps, groupe: 'École' },
  { id: 'devoirs', nom: 'Devoirs', icone: BookCheck, composant: Devoirs, groupe: 'École' },
  { id: 'scolarite', nom: 'Scolarité', icone: GraduationCap, composant: Scolarite, groupe: 'École' },
  { id: 'flashcards', nom: 'Flashcards', icone: Layers, composant: Flashcards, groupe: 'École' },
  { id: 'fiches', nom: 'Fiches de révision', icone: FileText, composant: Fiches, groupe: 'École' },
  { id: 'bibliotheque', nom: 'Bibliothèque', icone: BookOpen, composant: Bibliotheque, groupe: 'École' },

  { id: 'vocab', nom: 'Vocabulaire', icone: Languages, composant: Vocabulaire, groupe: 'Langues' },

  { id: 'securite', nom: 'Sécurité', icone: Shield, composant: Securite, groupe: 'Système' },
  { id: 'corbeille', nom: 'Corbeille', icone: Trash2, composant: Corbeille, groupe: 'Système' },
  { id: 'reglages', nom: 'Réglages', icone: Settings, composant: Reglages, groupe: 'Système' }
]

// Ordre des groupes pour le menu
export const GROUPES = ['Général', 'Productivité', 'École', 'Langues', 'Système']
