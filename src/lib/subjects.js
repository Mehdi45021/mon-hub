import { useEffect, useState } from 'react'
import { api } from './api'

// Charge la liste des matières (réutilisé par tous les modules école)
export function useSubjects() {
  const [subjects, setSubjects] = useState([])
  const charger = () => api.get('/subjects').then(setSubjects)
  useEffect(() => { charger() }, [])
  return { subjects, recharger: charger }
}
export const matiere = (subjects, id) => subjects.find(s => s.id === id)
