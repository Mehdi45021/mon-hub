import Foundation
import SwiftData

// Le modèle de données : une "Carte" de notes.
// @Model dit à SwiftData de sauvegarder automatiquement cette classe sur le téléphone.
@Model
final class Carte {
    var titre: String
    var texte: String
    var dateCreation: Date

    // Le tag de couleur ("" = pas de tag). On stocke le nom de la couleur en texte,
    // car SwiftData ne sait enregistrer que des types simples.
    var tag: String = ""

    // Quand on crée une carte, elle est vide par défaut et datée de maintenant.
    init(titre: String = "", texte: String = "", dateCreation: Date = .now) {
        self.titre = titre
        self.texte = texte
        self.dateCreation = dateCreation
    }
}
