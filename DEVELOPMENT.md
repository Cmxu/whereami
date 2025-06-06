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

#### Map optimizations

- [x] Move the expand map button to the top left, make it less opaque, give it an expand ("↘" - contract, "↖" - expand).
- [x] Fix the UI on the expanded map, make it fit the screen, show the image in a smaller box on the bottom left, make sure the map rerenders
- [x] Add ability to drag the top left hand corner of the small map to adjust it's size

### General

- [ ] Seperate the home and game play pages
- [ ] Also remove scrolling on the home page
- [ ] Move the stats from the main page to your profile
- [ ] Uploading pictures still is a bit buggy. For example, when I upload 4 pictures, only 3 actually get uploaded
- [ ] If the user is already on the Gallery page and logs in, the gallery page says not authenticated until after some user action
- [ ] Optimize image loading and compression
- [ ] Add proper error boundaries for API failures
- [ ] Adjust profile picture, zoom and move
