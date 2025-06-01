# WhereAmI 2.0

A modern geography guessing game built with SvelteKit, TypeScript, and Tailwind CSS. Players guess the locations of photos to test their geographical knowledge.

## 🎯 Project Overview

WhereAmI 2.0 is a complete rewrite of the original React-based game, featuring:

- **Frontend**: SvelteKit + TypeScript + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono (planned)
- **Storage**: Cloudflare R2 (images) + KV (metadata) (planned)
- **Maps**: Leaflet for interactive mapping
- **Deployment**: Cloudflare Pages + Workers (planned)

## 🚀 Development Status

### ✅ Phase 1: Core Infrastructure (COMPLETED)

- [x] SvelteKit project setup with TypeScript and Tailwind
- [x] Core type definitions and game logic
- [x] Reactive game state management with Svelte stores
- [x] Basic UI components (Welcome, Game, Results)
- [x] Map integration with Leaflet
- [x] Game flow and scoring system

### 🔄 Phase 2: Core Game Features (IN PROGRESS)

- [ ] Random game mode with fallback data
- [ ] Enhanced map component with better UX
- [ ] Game sessions and state persistence
- [ ] Mobile optimization and responsive design

### 📋 Phase 3: User Features (PLANNED)

- [ ] Image upload interface with location editing
- [ ] EXIF GPS extraction (client-side)
- [ ] Image management dashboard
- [ ] Image validation and optimization

### 📋 Phase 4: Custom Games (PLANNED)

- [ ] Custom game creation interface
- [ ] Game sharing with unique URLs
- [ ] Game discovery and public game listing
- [ ] Social features and analytics

### 📋 Phase 5: Backend & Deployment (PLANNED)

- [ ] Cloudflare Workers API setup
- [ ] R2 and KV integration
- [ ] Authentication and user management
- [ ] Production deployment

## 🛠️ Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run check

# Build for production
npm run build
```

## 🎮 Game Features

### Current Features

- **Welcome Screen**: Choose between Quick Game (3 rounds) or Full Game (10 rounds)
- **Interactive Gameplay**: Click on map to make location guesses
- **Scoring System**: Distance-based scoring with exponential decay (max 10,000 points per round)
- **Results Screen**: Detailed breakdown with performance rating and tips
- **Responsive Design**: Works on desktop and mobile devices

### Planned Features

- **Custom Games**: Create games with your own photos
- **Image Upload**: Upload photos with GPS location data
- **Game Sharing**: Share custom games via unique URLs
- **Public Gallery**: Browse and play community-created games
- **Advanced Analytics**: Track performance and improvement over time

## 🏗️ Architecture

### Frontend Structure

```
src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── WelcomeScreen.svelte
│   │   ├── GameRound.svelte
│   │   ├── GameResults.svelte
│   │   └── Map.svelte
│   ├── stores/              # Reactive state management
│   │   └── gameStore.ts
│   ├── utils/               # Utility functions
│   │   ├── gameLogic.ts     # Core game mechanics
│   │   └── api.ts           # API client
│   └── types/               # TypeScript definitions
│       └── index.ts
├── routes/                  # SvelteKit routes
│   ├── +layout.svelte
│   ├── +page.svelte
│   ├── upload/
│   ├── create/
│   └── browse/
└── app.css                  # Global styles
```

### Game Logic

- **Distance Calculation**: Haversine formula for great-circle distance
- **Scoring Algorithm**: Exponential decay based on distance (0-10,000 points)
- **State Management**: Reactive Svelte stores for game state
- **Performance Ratings**: Percentage-based performance feedback

## 🎨 Design System

The game uses a modern, clean design with:

- **Color Palette**: Blue primary, gray neutrals, green success
- **Typography**: System fonts for optimal performance
- **Components**: Reusable button and card styles
- **Animations**: Smooth transitions and micro-interactions
- **Responsive**: Mobile-first design approach

## 🔧 Technical Decisions

### Why SvelteKit?

- **Performance**: Smaller bundle sizes and faster runtime
- **Developer Experience**: Simpler state management and reactivity
- **Modern**: Built-in TypeScript support and excellent tooling
- **Scalable**: Easy to add SSR and API routes

### Why Cloudflare?

- **Global CDN**: Fast image delivery worldwide
- **Serverless**: Scalable backend without server management
- **Cost-Effective**: Pay-per-use pricing model
- **Integrated**: R2, KV, Workers, and Pages work seamlessly together

## 📝 Contributing

This is currently a personal project, but contributions and feedback are welcome! Please check the development phases above to see what's currently being worked on.

## 📄 License

MIT License - feel free to use this code for your own projects!
