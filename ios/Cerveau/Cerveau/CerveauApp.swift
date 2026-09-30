import SwiftUI
import SwiftData

// Le point de départ de l'application.
@main
struct CerveauApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        // On branche la base de données SwiftData sur toute l'app,
        // en lui disant qu'elle stocke des objets de type Carte.
        .modelContainer(for: Carte.self)
    }
}
