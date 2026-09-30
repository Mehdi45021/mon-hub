// Bus de navigation minimal : permet à n'importe quel module de changer de section
// (ex : widget cliquable de l'Accueil). App s'abonne et met à jour la section active.
const abonnes = new Set()
export function naviguer(id) { abonnes.forEach(f => f(id)) }
export function onNaviguer(f) { abonnes.add(f); return () => abonnes.delete(f) }
