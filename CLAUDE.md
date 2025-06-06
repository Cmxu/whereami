# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development

- `npm run dev` - Start development server (localhost:5173)
- `npm run dev:functions` - Start with Cloudflare Workers simulation (localhost:8788)
- `npm run build` - Build for production (copies functions to .svelte-kit/cloudflare/)
- `npm run preview` - Preview production build

### Code Quality

- `npm run check` - TypeScript type checking
- `npm run lint` - ESLint + Prettier checking
- `npm run format` - Format code with Prettier

### Testing

- `npx playwright test` - Run all Playwright tests
- `npx playwright test --ui` - Run tests with UI
- `npx playwright test tests/specific-test.spec.ts` - Run specific test
- Test setup requires authenticated user state (see tests/README-PLAYWRIGHT-SETUP.md)

### Deployment

- `npm run deploy` - Build and deploy to Cloudflare Pages
- Manual deployment: `npm run build && npx wrangler pages deploy .svelte-kit/cloudflare --project-name whereami`
- Deployment reminder: `Run 'npm run build && npx wrangler pages deploy .svelte-kit/cloudflare' when you are done making changes`

## Architecture Overview

### Tech Stack

- **Frontend**: SvelteKit + TypeScript + Tailwind CSS 4.0
- **Backend**: Cloudflare Workers (Pages Functions)
- **Storage**: Cloudflare R2 (images) + KV (metadata/games/users)
- **Maps**: Leaflet with OpenStreetMap
- **Auth**: Supabase Authentication
- **Testing**: Playwright (E2E tests against production) - IMPORTANT: RUN HEADLESS whenever possible

### Project Structure

**Frontend (SvelteKit)**

- `src/routes/` - SvelteKit routes and API endpoints
- `src/lib/components/` - Reusable Svelte components
- `src/lib/stores/` - Reactive state management (gameStore, authStore, etc.)
- `src/lib/utils/` - Utility functions (gameLogic, api client)
- `src/lib/types/` - TypeScript type definitions

**Backend (Cloudflare Workers)**

- `functions/api/` - Cloudflare Pages Functions (deployed automatically)
- `functions/api/types.ts` - Backend-specific type definitions
- API routes mirror frontend routes: `/api/games/`, `/api/images/`, etc.

### Key Systems

**Game Flow**

1. Game creation/selection (random or custom games)
2. Round-based gameplay with map guessing
3. Distance calculation using Haversine formula
4. Scoring with exponential decay (0-10,000 points per round)
5. Results display and sharing

**Image Management**

- Upload to Cloudflare R2 with EXIF GPS extraction
- Metadata stored in IMAGE_DATA KV namespace
- Thumbnail generation and serving via `/api/images/` endpoints
- Public/private image visibility controls

**User System**

- Supabase authentication integration
- User profiles stored in USER_DATA KV
- Game statistics and upload tracking
- Profile pictures stored in R2 at `profile-pictures/{userId}`

**Data Storage (KV Namespaces)**

- `IMAGE_DATA` - Image metadata and locations
- `USER_DATA` - User profiles and statistics
- `GAME_DATA` - Custom games and game sessions

### Important Conventions

**Component Patterns**

- Follow existing Svelte 5 runes patterns (no legacy reactive statements)
- Use TypeScript for all components with proper type imports
- Maintain consistent styling with Tailwind utility classes
- Component props should be properly typed interfaces

**API Patterns**

- All API responses follow `APIResponse<T>` interface with success/error structure
- Use proper HTTP status codes and error handling
- CORS handling for cross-origin requests
- File uploads use multipart/form-data with validation

**State Management**

- Use Svelte stores for reactive state (gameStore, authStore, themeStore, toastStore)
- Game state includes rounds, scoring, and completion tracking
- Authentication state synchronized with Supabase

**Testing Requirements**

- All new features should have Playwright E2E tests
- Tests run against production environment (whereami-5kp.pages.dev)
- Use authenticated user state for tests requiring login
- After feature implementation, run tests to verify functionality

### Development Workflow

1. Make changes to code
2. Test locally with `npm run dev`
3. Run type checking: `npm run check`
4. Run linting: `npm run lint`
5. Deploy: `npm run deploy`
6. Run Playwright tests to verify deployment
7. Update DEVELOPMENT.md task status if applicable

### Configuration Files

- `wrangler.toml` - Cloudflare Workers configuration with R2/KV bindings
- `svelte.config.js` - SvelteKit config with Cloudflare adapter
- `playwright.config.ts` - E2E test configuration
- `.cursor/rules/web-development-rules.mdc` - Development completion checklist
