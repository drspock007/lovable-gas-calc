# Gas Transfer Calculator - File Structure

## 📁 Project Structure
```
├── public/
│   ├── icon-192.png           # PWA app icon (192x192)
│   ├── icon-512.png           # PWA app icon (512x512)
│   ├── manifest.json          # Web App Manifest for PWA
│   ├── sw.js                  # Service Worker for offline functionality
│   └── robots.txt             # SEO crawler instructions
│
├── src/
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (48 components)
│   │   ├── BottomActionBar.tsx    # Sticky mobile action bar
│   │   ├── ExplanationCard.tsx    # Physics equations & explanations
│   │   ├── InputForm.tsx          # Form with validation & unit selectors
│   │   ├── ModeSelector.tsx       # Diameter vs Time calculation mode
│   │   ├── ResultsDisplay.tsx     # Results with unit conversions
│   │   └── ThemeToggle.tsx        # Dark/light mode switcher
│   │
│   ├── i18n/
│   │   ├── context.tsx        # React context for i18n
│   │   └── translations.ts    # FR/EN/IT translation dictionaries
│   │
│   ├── lib/
│   │   ├── __tests__/
│   │   │   └── units.test.ts  # Unit conversion tests
│   │   ├── physics.ts         # Gas transfer calculations (placeholder)
│   │   ├── pwa.ts            # PWA installation & service worker management
│   │   ├── rootfind.ts       # Numerical root finding algorithms
│   │   ├── units.ts          # Unit conversion system
│   │   └── utils.ts          # Utility functions
│   │
│   ├── pages/
│   │   ├── Calculator.tsx     # Main calculator page
│   │   ├── Index.tsx          # App entry point with I18n provider
│   │   └── NotFound.tsx       # 404 error page
│   │
│   ├── test/
│   │   └── setup.ts          # Vitest test configuration
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx    # Mobile detection hook
│   │   └── use-toast.ts      # Toast notifications hook
│   │
│   ├── App.tsx               # Root app component with PWA initialization
│   ├── index.css             # Design system & Tailwind styles
│   └── main.tsx              # React app entry point
│
├── index.html                # HTML template with PWA meta tags
├── tailwind.config.ts        # Tailwind CSS configuration
├── vitest.config.ts          # Testing configuration
└── vite.config.ts            # Vite bundler configuration
```

## 🎨 Design System Features
- **Professional Engineering Theme**: Blue/teal gradient color scheme
- **Mobile-First**: 48px touch targets, responsive design
- **PWA Ready**: Installable, offline-capable with service worker
- **Dark/Light Mode**: Theme toggle with localStorage persistence
- **i18n Support**: French/English/Italian with browser detection

## 🧮 Calculator Features
- **Dual Modes**: Calculate orifice diameter OR transfer time
- **Multiple Units**: Metric/Imperial/SI unit systems
- **Gas Database**: Common gases with thermodynamic properties
- **Real Physics**: Choked flow calculations, pressure ratios
- **Export Results**: JSON download of calculations

## 📱 PWA Capabilities
- **Installable**: Add to home screen on mobile/desktop
- **Offline Mode**: Core functionality works without internet
- **Background Sync**: Service worker for performance
- **App-like Experience**: Standalone display mode

## 🔬 Testing & Development
- **Vitest**: Unit testing framework configured
- **TypeScript**: Full type safety
- **ESLint**: Code quality enforcement
- **Component Tests**: Unit conversion validation

## 🚀 Future Extensibility
- **API Ready**: Structure prepared for backend integration
- **Modular Physics**: Easy to expand calculation methods
- **Plugin Architecture**: Root finding algorithms can be swapped
- **User Accounts**: Ready for authentication integration