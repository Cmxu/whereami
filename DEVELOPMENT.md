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

- [x] ~~When the map is big, it covers the submit button area, make sure the z levels are set correctly~~ **FIXED**: Reduced action buttons z-index to z-60 and added viewport constraints (max-width: calc(100vw - 48px)) to ensure buttons stay within screen bounds. Action buttons positioned at bottom-right with proper spacing.
- [x] ~~When the map is small, after submitting a guess, the next round button and other stats get cutoff, make sure they are correctly placed~~ **FIXED**: Reverted to original small map layout structure. Stats (score, badge, distance) appear in the action-buttons area after location submission, maintaining the original styling but ensuring proper visibility order. Reset button SVG also fixed with cleaner refresh icon.
- [x] ~~For the small map, the text and distance still appear behind the map, make them appear after the round but they should be in the same div as the next round button and the map (in between them)~~ **FIXED**: Restructured small map overlay to place result stats in a separate `result-stats` section positioned between the map container and action buttons. Added proper z-index (z-50) and background styling to ensure stats are visible above the map (z-10). Test confirmed correct layout order: Map -> Result Stats -> Button.
- [x] ~~Small map result stats should push the map up instead of overlaying, and remove white background~~ **IMPROVED**: Modified the small map layout so result stats appear inline in the flex container, pushing the map up by reducing its height (from 80px to 160px spacing when stats appear). Removed white background styling so stats blend naturally with the overlay. Test confirmed: stats push map up with correct layout order and no white background.
- [x] ~~Container should grow to accommodate stats instead of shrinking map~~ **FINAL**: Updated the small map layout so the map maintains its original size (320px) while the outer container grows (to 492px) to accommodate the result stats. Stats appear inline without white background, creating a natural flow: Map (original size) → Stats (transparent) → Action Buttons. Test confirmed: container grows, map stays same size, no white background.
- [x] ~~Improve stats display organization and use consistent transparent backgrounds~~ **ENHANCED**: Redesigned result stats layout from vertical stacking to an elegant horizontal organization: Score (left) ↔ Distance (right) with Badge centered below. Applied consistent transparent/blur background styling (`bg-white/10 backdrop-blur-md`) to big map result panel, matching other overlays. Added proper text shadows for better contrast. Test confirmed: horizontal layout working, both layouts use transparent backgrounds.
- [x] ~~Position badge/message between score and distance in horizontal layout~~ **FINAL**: Updated both small map and big map result panels to use a three-column horizontal layout: Score (left) ↔ Badge (center) ↔ Distance (right). Badge now appears inline between the score and distance rather than below them. Updated CSS with flexible layout (`score-section`/`distance-section` at 35% max-width each, `badge-section` auto-width) and reduced gap for better spacing. Both layouts now consistently show the message/rating badge positioned between the numerical values.
- [x] ~~Make points inline with score number, remove "away" text, standardize styling~~ **ENHANCED**: Updated both small map and big map result layouts to display "points" inline with the score number (e.g., "4,500 points" instead of score on one line and "points" below). Removed the word "away" from distance display, showing just the formatted distance (e.g., "125 km"). Standardized font styling to use `font-medium` for both points and distance text, with consistent color schemes: small map uses `text-gray-600`, big map uses `text-gray-300` for better contrast on transparent backgrounds. Layout is now more compact and visually consistent across both display modes.
- [x] ~~Standardize font sizes and styling for consistent visual hierarchy~~ **COMPLETE**: Fully standardized font styling across both big map and small map layouts. All score values, points text, distance values, and distance text now use consistent `text-lg font-medium` styling. Big map: score and points use `text-lg`, distance uses `text-lg` with `text-gray-300` color. Small map: score and points use `text-lg`, distance uses `text-lg` with `text-gray-600` color. The word "points" is now inline with the score number in both layouts. All text elements maintain the same visual hierarchy and proportional relationships, creating a unified and consistent user experience across both display modes. Badge sizes remain differentiated (`text-sm` for big map, `text-xs` for small map) to maintain proper visual balance.

### General

- [ ] Seperate the home and game play pages
- [ ] Also remove scrolling on the home page
- [ ] Fix game sharing link
- [ ] Move the stats from the main page to your profile
- [ ] Uploading pictures still is a bit buggy. For example, when I upload 4 pictures, only 3 actually get uploaded
- [ ] If the user is already on the Gallery page and logs in, the gallery page says not authenticated until after some user action
- [ ] Optimize image loading and compression
- [ ] Add proper error boundaries for API failures
- [ ] Adjust profile picture, zoom and move

### Completed

- [x] Fixed SVG icons being cut off - corrected reset icon paths to fit within 24x24 viewBox
- [x] Updated resize handles to use three filled dots positioned as corner grips with no background - made circles bigger (radius 2), more spread out, and positioned farther from corners
- [x] Fixed z-index issue where large map covered submit buttons - increased action buttons z-index to z-[100], set map container to z-0, and added pointer-events management
- [x] Fixed positioning issue where small map result panels get cut off - added max-height constraints, scrollable action buttons area, proper viewport bounds checking, and restructured result layout to show score/distance above button
- [x] **Updated distance formatting structure** - Modified `formatDistance` function to return separate numeric value and unit string instead of combined string. Updated all related types (`GuessResult`, `Round`, `CompletedRound`) to have `formattedDistance: number` and `formattedDistanceUnit: string` properties. Propagated changes throughout the codebase including GameRound.svelte, GameResults.svelte, gameStore.ts, and server-side save functions. Distance display now properly concatenates the number and unit (e.g., "125km", "500m") in all UI components.
