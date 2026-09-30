/** @type {import('tailwindcss').Config} */
// Tous les tokens pointent vers les variables CSS (jamais de couleur en dur).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        fond: 'var(--fond)',
        surface: 'var(--surface)',
        'surface-haute': 'var(--surface-haute)',
        fort: 'var(--fort)',
        normal: 'var(--normal)',
        faible: 'var(--faible)',
        accent: 'var(--accent)',
        succes: 'var(--succes)',
        alerte: 'var(--alerte)'
      },
      borderColor: { DEFAULT: 'var(--bordure)' },
      borderRadius: { DEFAULT: '8px', md: '8px', lg: '8px', xl: '8px', '2xl': '8px' },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      // En rem : la densité (taille de racine) fait l'échelle de toute l'interface
      fontSize: {
        xs: '0.75rem', sm: '0.8125rem', base: '0.875rem', lg: '1rem', xl: '1.25rem', '2xl': '1.75rem'
      }
    }
  },
  plugins: []
}
