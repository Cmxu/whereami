# WhereAmI - Development Roadmap

## 🌍 Project Overview

**WhereAmI** is a modern geography guessing game built with SvelteKit, TypeScript, and Tailwind CSS. Players are shown photos from around the world and must guess the location by clicking on an interactive map. The game features distance-based scoring, custom game creation, social sharing, and a community-driven discovery system.

**Tech Stack:**

- Frontend: SvelteKit + TypeScript + Tailwind CSS
- Backend: Cloudflare Workers + R2 Storage + KV Database
- Maps: Leaflet with OpenStreetMap
- Deployment: Cloudflare Pages

---

## 🚀 Development Tasks & Features

### Gameplay Fixes/Tasks

### General

- [ ] If the user is already on the Gallery page and logs in, the gallery page says not authenticated until after some user action
- [ ] Fix game sharing link
- [ ] Optimize image loading and compression
- [ ] Add proper error boundaries for API failures
- [ ] Adjust profile picture, zoom and move

### Completed

- [x] **Share Tab Cleanup and Fixes** - Simplified and fixed the game sharing functionality
  - Removed misleading "Share links are valid for 30 days and track access for analytics" notice
  - Removed redundant "Share "{game name}" with friends" header text, keeping only score display when relevant
  - Fixed link generation by using direct game URLs instead of complex share token system
  - Replaced social media sharing buttons (Facebook, Twitter, Reddit) with simple copy link functionality
  - Added visual feedback for copy action with checkmark and "Copied" text
  - Streamlined UI focuses on core functionality: game preview and direct link copying
  - **Dark Mode Support**: Updated all hardcoded colors to use CSS custom properties for proper dark mode theming
    - Modal background uses `card` class and theme-aware variables
    - Text colors use `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
    - Game preview background uses `var(--bg-tertiary)`
    - Input field styling uses theme-aware border and background colors
    - Border separators use `var(--border-color)`
  - Successfully deployed to https://56a920f5.whereami-5kp.pages.dev
- [x] **Game Leaderboard and Average Score Feature** - Added comprehensive leaderboard system to game details pages
  - Created new API endpoints for score submission (`/api/games/[gameId]/scores`) and leaderboard retrieval (`/api/games/[gameId]/leaderboard`)
  - Implemented KV storage structure: `scores:user:${userId}:${gameId}` for user best scores and `scores:game:${gameId}` for all game scores
  - Added automatic score submission when completing custom games (authenticated users only)
  - Created `GameLeaderboard` component displaying average score, average accuracy, total plays, unique players, and top 20 leaderboard
  - Integrated leaderboard into game details pages with responsive design and dark mode support
  - Leaderboard shows player rankings with medals (🥇🥈🥉), scores, accuracy percentages, and play dates
  - Statistics include comprehensive game performance metrics for better player engagement
  - Successfully deployed to production at https://6565a779.whereami-5kp.pages.dev
  - **UI Improvements**: Removed duplicate Quick Actions sidebar and reorganized layout
    - Enhanced "Game Creator" section with larger avatar and creator stats (photos, plays)  
    - Added new "Game Details" section with structured information display (difficulty, locations, rating, total plays)
    - Moved tags to the sidebar Game Details section for better organization
    - Improved spacing and visual hierarchy for better user experience
    - Successfully deployed reorganized layout to https://af7a8d4b.whereami-5kp.pages.dev
  - **Final Layout Optimization**: Improved page structure and content organization
    - Moved leaderboard from full-width bottom section to right column (12-column grid: 5 for game info, 3 for sidebar, 4 for leaderboard)
    - Removed redundant "Ready to Play?" section and start playing button from About section (actions available in header)
    - Removed pre-game rating component - ratings should only happen after playing the game
    - Expanded max-width from 4xl to 7xl to accommodate wider three-column layout
    - Cleaner, more focused content presentation with better use of screen real estate
    - Successfully deployed final optimized layout to https://ebe6ec29.whereami-5kp.pages.dev
  - **Two-Column Layout with Enhanced Creator Stats**: Simplified layout and improved creator information
    - Changed from three-column (5-3-4) to cleaner two-column (1-1) layout for better mobile responsiveness
    - Updated max-width from 7xl to 6xl for optimal reading experience
    - Enhanced creator stats to show number of games created instead of photo count (fetched via getUserGames API)
    - Styled leaderboard statistics to match the "About This Game" section styling with consistent stat cards
    - Improved visual hierarchy and consistency across all statistical displays
    - Successfully deployed two-column layout with enhanced stats to https://fc688e12.whereami-5kp.pages.dev
  - **Leaderboard UI Polish**: Improved leaderboard statistics presentation
    - Wrapped leaderboard statistics in a card container for better visual grouping
    - Removed redundant descriptive text "See how players are performing on this game" for cleaner header
    - Enhanced visual consistency with other card-based sections on the page
    - Successfully deployed polished leaderboard UI to https://32b8d5d0.whereami-5kp.pages.dev
  - **Creator Game Count Fix**: Fixed issue where creator's game count was not displaying correctly
    - The problem was that the game API was overwriting the original creator user ID with the display name
    - Added `createdByUserId` field to preserve the original user ID alongside the display name
    - Updated frontend to use the preserved user ID when calling `getUserGames()` API
    - Creator game count now correctly displays the number of games created by that user
    - Successfully deployed fix to https://fc01cc94.whereami-5kp.pages.dev
  - **API Endpoint Missing Fix**: Created missing API endpoint for fetching user games by user ID
    - The previous fix wasn't working because `/api/games/user/[userId]` endpoint didn't exist
    - Created new endpoint `/api/games/user/[userId]/+server.ts` to handle user-specific game queries without authentication
    - This endpoint allows fetching any user's public games by their user ID for displaying creator statistics
    - Now the creator game count functionality works correctly with proper API infrastructure
    - Successfully deployed complete fix to https://eee01f05.whereami-5kp.pages.dev
- [x] **Dark Mode Fix for Game Details Page** - Fixed dark mode styling issues on game details page
  - Updated main page background to use `var(--bg-secondary)` instead of hardcoded `bg-gray-50`
  - Fixed all text colors to use CSS custom properties (`var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`)
  - Updated card backgrounds and components to use theme-aware variables
  - Fixed game statistics sections to use `var(--bg-tertiary)` for proper dark mode background
  - Updated tags to use theme-aware blue color classes (`bg-blue-100-theme`, `text-blue-700-theme`)
  - Fixed loading spinner border color to use `var(--border-color)` for dark mode compatibility
  - Removed hardcoded white card background from CSS, now uses global card styles
  - Successfully deployed to production at https://60d8265d.whereami-5kp.pages.dev
- [x] **Game Review Page Updates** - Removed commenting functionality and fixed rating system
  - Completely removed comments section from game review pages (`/games/[gameId]`)
  - Removed comment-related API functions (`addComment`, `getGameComments`) from API utility
  - Created missing rating server endpoints (`/api/games/[gameId]/rate` and `/api/games/[gameId]/rating/user`)
  - Fixed rating functionality to properly save and retrieve user ratings from KV storage
  - Rating system now correctly updates game statistics (total rating and rating count)
  - Users can now successfully rate games and see their previous ratings
  - Successfully deployed to production at https://715e9c50.whereami-5kp.pages.dev
- [x] **Creator Name Display Fix** - Fixed game preview screens showing user IDs instead of user display names
  - Enhanced individual game API (`/api/games/[gameId]/+server.ts`) to fetch and include creator profile data
  - Added `getUserProfile()` function to transform user IDs to display names, profile pictures, and join dates
  - Updated game detail pages (`/games/[gameId]`) to show creator display names instead of raw user IDs
  - Also fixes shared game pages and any other screens that display game creator information
  - Successfully deployed to production at https://2c191b6a.whereami-5kp.pages.dev
- [x] **Browse Page Creator Profile Pictures** - Replaced game thumbnail previews with creator profile pictures on browse page
  - Enhanced games API (`/api/games/public/+server.ts`) to include creator profile pictures and join dates
  - Updated `CustomGame` interface to include `creatorProfilePicture` and `creatorJoinedAt` fields
  - Redesigned browse page game cards with creator profile headers showing avatars, names, and creation dates
  - Added fallback initials display with blue background for users without profile pictures
  - Replaced thumbnail sections with game stats badges (photo count for public games, visibility for user games)
  - Applied modern styling with gradients, borders, and hover effects for improved UX
  - Successfully deployed to production at https://35941c76.whereami-5kp.pages.dev
- [x] **Toast/Alert Positioning** - Moved all alert notifications from top-right to bottom-left corner
  - Updated default position in `toastStore.ts` from `top-right` to `bottom-left`
  - Updated legacy CSS in `App.css` to match new positioning
  - Verified positioning with Playwright tests showing toasts appear at `position: fixed, bottom: 0px, left: 0px`
  - All toast notifications (success, error, warning, info) now appear in bottom-left corner
- [x] **Continue Game Popup Fix** - Fixed issue where continue game popup wouldn't appear on home screen after leaving a game until refresh
  - Added `checkForSavedGame()` call in home page `onMount` to refresh saved game status when returning
  - Modified `handleBackToHome()` in play page to explicitly save game state before navigating
  - Verified both logo click and exit button now properly save game state and show continue popup
  - Added comprehensive Playwright tests to ensure functionality works across all navigation methods
- [x] Seperate the home and game play pages - Created new `/play` endpoint for game functionality
- [x] Move the stats from the home page to your profile
- [x] Gray out play tab when no game is active with tooltip "Pick a game type to start playing!"
