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

- [ ] Fix game sharing link
- [ ] Uploading pictures still is a bit buggy. For example, when I upload 4 pictures, only 3 actually get uploaded
- [ ] If the user is already on the Gallery page and logs in, the gallery page says not authenticated until after some user action
- [ ] Optimize image loading and compression
- [ ] Add proper error boundaries for API failures
- [ ] Adjust profile picture, zoom and move

### Completed

- [x] **Continue Game Popup Fix** - Fixed issue where continue game popup wouldn't appear on home screen after leaving a game until refresh
  - Added `checkForSavedGame()` call in home page `onMount` to refresh saved game status when returning
  - Modified `handleBackToHome()` in play page to explicitly save game state before navigating
  - Verified both logo click and exit button now properly save game state and show continue popup
  - Added comprehensive Playwright tests to ensure functionality works across all navigation methods
- [x] Seperate the home and game play pages - Created new `/play` endpoint for game functionality
- [x] Move the stats from the home page to your profile
- [x] Gray out play tab when no game is active with tooltip "Pick a game type to start playing!"
