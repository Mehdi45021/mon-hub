import SwiftUI
import SwiftData

// Les couleurs de tag disponibles (couleurs système : douces et adaptées au mode sombre).
enum TagCouleur: String, CaseIterable, Identifiable {
    case bleu, vert, jaune, orange, rose

    var id: String { rawValue }

    // La vraie couleur SwiftUI correspondante.
    var couleur: Color {
        switch self {
        case .bleu: return .blue
        case .vert: return .green
        case .jaune: return .yellow
        case .orange: return .orange
        case .rose: return .pink
        }
    }

    // Le nom affiché dans le menu de filtre.
    var nom: String {
        switch self {
        case .bleu: return "Bleu"
        case .vert: return "Vert"
        case .jaune: return "Jaune"
        case .orange: return "Orange"
        case .rose: return "Rose"
        }
    }
}

// L'écran principal : la liste des cartes avec recherche.
struct ContentView: View {
    // Le "contexte" : notre lien avec la base de données (ajouter/supprimer).
    @Environment(\.modelContext) private var contexte

    // @Query lit toutes les cartes, triées de la plus récente à la plus ancienne.
    // La liste se met à jour toute seule dès qu'une carte change.
    @Query(sort: \Carte.dateCreation, order: .reverse) private var cartes: [Carte]

    // Le texte tapé dans la barre de recherche.
    @State private var recherche = ""

    // La carte fraîchement créée, qu'on ouvre tout de suite pour l'éditer.
    @State private var nouvelleCarte: Carte?

    // Le tag choisi comme filtre (nil = on montre tout).
    @State private var filtreTag: TagCouleur?

    // Les cartes filtrées par le tag choisi, puis par la recherche (titre OU texte).
    private var cartesFiltrees: [Carte] {
        var resultat = cartes
        if let filtreTag {
            resultat = resultat.filter { $0.tag == filtreTag.rawValue }
        }
        if !recherche.isEmpty {
            resultat = resultat.filter {
                $0.titre.localizedCaseInsensitiveContains(recherche)
                || $0.texte.localizedCaseInsensitiveContains(recherche)
            }
        }
        return resultat
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(cartesFiltrees) { carte in
                    // Toucher une carte ouvre l'écran de modification.
                    NavigationLink(value: carte) {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 8) {
                                // La petite pastille de couleur du tag, s'il y en a un.
                                if let tag = TagCouleur(rawValue: carte.tag) {
                                    Circle()
                                        .fill(tag.couleur)
                                        .frame(width: 10, height: 10)
                                }
                                Text(carte.titre.isEmpty ? "Sans titre" : carte.titre)
                                    .font(.headline)
                            }
                            if !carte.texte.isEmpty {
                                Text(carte.texte)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                            Text(carte.dateCreation, format: .dateTime.day().month().year())
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 4)
                    }
                }
                // Le glisser vers la gauche pour supprimer.
                .onDelete(perform: supprimer)
            }
            .listStyle(.plain) // style épuré, fond blanc
            .navigationTitle("Cerveau")
            .searchable(text: $recherche, prompt: "Rechercher")
            .navigationDestination(for: Carte.self) { carte in
                CarteDetailView(carte: carte)
            }
            // L'édition d'une nouvelle carte s'ouvre par-dessus la liste.
            // À la fermeture, on jette les cartes restées totalement vides.
            .sheet(item: $nouvelleCarte, onDismiss: supprimerCartesVides) { carte in
                NavigationStack {
                    CarteDetailView(carte: carte)
                }
            }
            .toolbar {
                // Le menu de filtre par tag, en haut à gauche.
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Button("Toutes les cartes") { filtreTag = nil }
                        ForEach(TagCouleur.allCases) { tag in
                            Button {
                                filtreTag = tag
                            } label: {
                                // Une coche indique le filtre actif.
                                if filtreTag == tag {
                                    Label(tag.nom, systemImage: "checkmark")
                                } else {
                                    Text(tag.nom)
                                }
                            }
                        }
                    } label: {
                        // L'icône se remplit quand un filtre est actif.
                        Image(systemName: filtreTag == nil
                              ? "line.3.horizontal.decrease.circle"
                              : "line.3.horizontal.decrease.circle.fill")
                    }
                }
                // Le bouton + en haut à droite.
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: creer) {
                        Image(systemName: "plus")
                    }
                }
            }
            .overlay {
                // Petit message quand il n'y a rien à afficher.
                if cartesFiltrees.isEmpty {
                    // "Aucune carte" si rien n'est filtré, "Aucun résultat" sinon.
                    let toutAfficher = recherche.isEmpty && filtreTag == nil
                    ContentUnavailableView(
                        toutAfficher ? "Aucune carte" : "Aucun résultat",
                        systemImage: toutAfficher ? "square.on.square" : "magnifyingglass"
                    )
                }
            }
        }
    }

    // Crée une carte vide, l'enregistre, puis l'ouvre pour l'éditer.
    private func creer() {
        let carte = Carte()
        contexte.insert(carte)
        nouvelleCarte = carte
    }

    // Supprime les cartes glissées vers la gauche.
    private func supprimer(aux indices: IndexSet) {
        for index in indices {
            contexte.delete(cartesFiltrees[index])
        }
    }

    // Supprime les cartes sans titre ni texte (ex : bouton + puis fermeture immédiate).
    private func supprimerCartesVides() {
        for carte in cartes where carte.titre.isEmpty && carte.texte.isEmpty {
            contexte.delete(carte)
        }
    }
}

// L'écran de modification d'une carte (aussi utilisé pour une nouvelle carte).
struct CarteDetailView: View {
    // @Bindable relie les champs de saisie directement à la carte :
    // chaque frappe est sauvegardée automatiquement par SwiftData.
    @Bindable var carte: Carte

    var body: some View {
        Form {
            TextField("Titre", text: $carte.titre)
                .font(.headline)
            TextEditor(text: $carte.texte)
                .frame(minHeight: 200)

            // Le choix du tag : une rangée de pastilles de couleur.
            Section("Tag") {
                HStack(spacing: 16) {
                    ForEach(TagCouleur.allCases) { tag in
                        Circle()
                            .fill(tag.couleur)
                            .frame(width: 28, height: 28)
                            .overlay {
                                // Une coche blanche sur le tag sélectionné.
                                if carte.tag == tag.rawValue {
                                    Image(systemName: "checkmark")
                                        .font(.caption.bold())
                                        .foregroundStyle(.white)
                                }
                            }
                            .onTapGesture {
                                // Retoucher le même tag l'enlève.
                                carte.tag = (carte.tag == tag.rawValue) ? "" : tag.rawValue
                            }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle(carte.titre.isEmpty ? "Nouvelle carte" : carte.titre)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// Aperçu pour Xcode (données en mémoire seulement, pas sauvegardées).
#Preview {
    ContentView()
        .modelContainer(for: Carte.self, inMemory: true)
}
