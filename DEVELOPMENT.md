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
- [ ] Allow user to edit their display name/username (this is distinct from their actual name)
- [ ] Allow user to add a profile picture
- [ ] If the user is already on the Gallery page and logs in, the gallery page is not able to load their pictures until after a refresh
- [ ] Optimize image loading and compression
- [ ] Add proper error boundaries for API failures
- [ ] Implement retry logic for failed network requests
- [ ] The user should be able to select multiple images to upload at a time, currently if you select multiple images it only takes the first image


## Completed Tasks
- [x] **Playwright Test Configuration Update**: Successfully updated and fixed Playwright test configuration:
  - 🔧 **Headless by default**: All tests now run headless unless specifically configured otherwise for better CI/CD performance
  - 🌐 **Updated base URL**: Changed from various subdomain URLs to `https://whereami-5kp.pages.dev` which always contains the most up-to-date deployment
  - 🔐 **Simplified authentication**: Recreated authentication setup with automatic credential filling and improved error handling
  - 🛠️ **Fixed auth setup**: Resolved UI element interception issues with force clicks and toast message handling
  - 📝 **Updated documentation**: Created comprehensive README-PLAYWRIGHT-SETUP.md with usage instructions
  - ✅ **Verified functionality**: All tests now run successfully with proper authentication state management
  - 🔄 **Consistent URLs**: Updated all test files to use the correct domain for reliable testing
  - 🚫 **No auto-opening reports**: HTML reports are generated but never auto-open to avoid workflow interruption
  - 🎯 **CI/Local optimization**: Auth setup runs headed locally for manual intervention but headless in CI environments
  - 🧹 **Fixed linter errors**: Resolved TypeScript type issues in test files for cleaner code
  - 🔒 **Secure credentials**: Moved test credentials to environment variables to prevent committing sensitive data
  - 📦 **Environment setup**: Added dotenv configuration and proper .env file handling with .gitignore protection
- [x] **Create Custom Game Tab Enhancement**: Successfully improved the create custom game modal with proper user interface controls:
  - ✨ **Close Button**: Added an 'X' button in the modal header to close the modal, with proper theme-aware styling
  - 🎯 **Create Game Button**: Confirmed existing "Create Game" button is properly positioned and functional
  - 🖱️ **User Experience**: Close button includes hover effects and disabled state during game creation
  - 🎨 **Theme Integration**: Close button properly uses CSS variables for consistent theming across light/dark modes
  - ⌨️ **Accessibility**: Added proper aria-label for screen reader support
  - 🔄 **Functionality**: Both close (X) and cancel buttons properly reset the modal state and clear selected images
- [x] **Game Data Storage Infrastructure**: Successfully created comprehensive game data storage system with KV namespace:
  - 🗄️ **New KV Namespace**: Created `GAME_DATA` KV namespace (ID: a86736cd257440bea9b9c403b3b3afe5) for storing completed games
  - 📊 **Data Models**: Added TypeScript interfaces for `SavedGame`, `CompletedRound`, `GameShareData`, and `GameStats`
  - 🔗 **API Endpoints**: Created `/api/games/save` endpoint to save completed games with scores, images, and player data
  - 📁 **Game Retrieval**: Added `/api/games/[gameId]` endpoint to retrieve saved games by ID or share token
  - 🔄 **Dual Implementation**: Both SvelteKit routes and Cloudflare Functions versions for consistency
  - 👤 **User Integration**: Saves games to user history when logged in, maintains public games index for discovery
  - 🔗 **Sharing System**: Generates unique share tokens for each game, tracks access counts and statistics
  - 🏗️ **Infrastructure**: Updated wrangler.toml and TypeScript types to support the new KV namespace
  - 🎯 **Foundation Ready**: System now ready for implementing shareable random games feature
- [x] **Generate random game is not working** - Fixed missing public images index update in upload endpoints
- [x] **Random Game Generation Fix**: Fixed the critical issue where random games were not working due to missing public images index maintenance:
  - 🔍 **Root Cause**: Upload endpoints were not adding newly uploaded public images to the `public_images` index in KV storage
  - 🛠️ **Solution**: Added code to both upload endpoints (`src/routes/api/images/upload-simple/+server.ts` and `functions/api/images/upload-simple.js`) to automatically add public images to the index
  - 📊 **Index Management**: Implemented proper index maintenance with automatic cleanup (keeping only the latest 1000 public images)
  - 🎮 **Result**: Random games now work properly once users upload public images, enabling the core game functionality
  - 🔄 **Consistency**: Ensured both the SvelteKit routes API and Cloudflare Functions API versions handle public image indexing consistently
- [x] **Image Name Editing Functionality**: Implemented comprehensive image name editing that allows users to:
  - ✨ **Edit names during upload** - Users can set custom names for their images before uploading via an input field in the upload interface
  - ✏️ **Edit names after upload** - Gallery includes "Edit Name" buttons that open a modal for renaming existing images
  - 🔄 **Real-time updates** - Changes are immediately reflected in the gallery without page refresh
  - 🛡️ **Input sanitization** - Custom names are properly sanitized to prevent issues with special characters
  - 📱 **User-friendly UI** - Clean modals and input fields that integrate seamlessly with the existing design
  - 🔐 **Secure updates** - Only image owners can edit their own image names with proper authentication
  - 🎯 **Fallback handling** - If no custom name is provided, the original filename is used as a sensible default
- [x] **Enhanced Photo Selection for Game Creation**: Implemented improved user experience for photo selection when creating custom games:
  - ✨ **Click anywhere on image to select/deselect** - Users can now click anywhere on the photo (not just the checkbox) to select or deselect it
  - 🎯 **Improved interaction area** - The entire image container is now clickable for better usability
  - ⌨️ **Keyboard accessibility** - Added keyboard support (Enter/Space keys) for both image and checkbox selection
  - 🔄 **Event handling optimization** - Prevented event propagation conflicts between checkbox and image clicks
  - 📱 **Consistent behavior** - Both checkbox and image clicks now work seamlessly together for a better user experience
- [x] **Delete Image Functionality**: Implemented comprehensive delete functionality that:
  - ✨ **Added DELETE API endpoint** at `/api/images/[imageId]` with proper authentication and authorization
  - 🗂️ **Complete R2 storage cleanup** - removes both original images and thumbnails from Cloudflare R2
  - 📊 **KV database updates** - removes image metadata, updates user image lists, and removes from public index
  - 👤 **User data synchronization** - decrements user upload count and maintains data consistency
  - 🔐 **Security controls** - ensures users can only delete their own images with proper token verification
  - 🎨 **UI integration** - delete button already existed in UserGallery component with confirmation dialog
  - ⚡ **Real-time updates** - gallery refreshes immediately after successful deletion
- [x] Remove redundant profile button from profile page header
- [x] Fix TypeScript accessibility warnings in components
- [x] Create dark mode theme
- [x] The search bar is 2 px taller than the rest of the buttons on its row (in the gallery tab)
- [x] Dark mode does not affect the background on any tab, it should also affect the color of the welcome tab, it should also affect other colors like blue buttons etc
- [x] The toggle should just be dark/light mode it can be a button or toggle that switches between them, the default behaviour should be system if the user has never modified the toggle
- [x] Upload more button does not actually switch tabs
- [x] Change organization: Top level tabs should be Play/Gallery/Browse/Create. The play/default welcome screen should allow the user to start a random game or go to browse user created games. Gallery shows your current photos and gives you the ability to upload/delete/modify your photos (make sure to integrate the upload screen with the gallery). Browse should show a list of public games/your personal games. Create should allow you to create new games with your existing images (it should also have a button to redirect to gallery to upload new images)
- [x] Fix multiple file selection in upload functionality - users can now select multiple images at once
- [x] Remove separate upload page and integrate all upload functionality into Gallery upload tab
- [x] Update all "Upload More" buttons to redirect to Gallery upload tab instead of separate upload page
- [x] Move upload tutorial from separate upload page to Gallery upload tab
- [x] Fix "Upload More" button behavior to act exactly like clicking the upload tab button
- [x] Update configuration: Changed app name from "whereami-api" to "whereami" and KV namespace bindings from "production-GAME_METADATA" to "whereami-IMAGE_DATA" and "production-USER_DATA" to "whereami-USER_DATA"
- [x] **Enhanced Upload Functionality**: Successfully migrated all advanced upload features from the old upload page to the Gallery upload tab, including:
  - ✨ **Automatic GPS extraction from EXIF data** using the exifr library
  - 🗺️ **Interactive location editing** with map interface for photos without GPS data
  - 📊 **Upload progress tracking** with real-time progress bars
  - 🔄 **Retry functionality** for failed uploads with smart error handling
  - 📈 **Upload statistics dashboard** showing totals, uploaded count, and errors
  - 🎨 **Enhanced UI** with drag-and-drop, file validation, and responsive design
  - ⌨️ **Keyboard shortcuts** (Ctrl+U for upload, Ctrl+Enter for upload all)
  - 📱 **Mobile-optimized interface** with responsive photo grid and touch-friendly controls
- [x] **Fixed KV Store Configuration**: Corrected KV namespace binding names in wrangler.toml to match application code expectations, resolving "KV stores not configured" server error
- [x] **Fixed Authentication Configuration**: Set up proper Supabase environment variables using .dev.vars for local development and Wrangler Pages secrets for production, resolving "not logged in" authentication errors during upload

# FUTURE IDEAS (DO NOT WORK ON YET)

### 🔧 Core Infrastructure & Stability

#### Bug Fixes & Performance

- [ ] Add loading skeletons for better UX
- [ ] Optimize map rendering performance on mobile
- [ ] Add service worker for offline game functionality
- [ ] Implement progressive image loading

#### Testing & Quality Assurance

- [ ] Add unit tests for game logic functions
- [ ] Add integration tests for game flow
- [ ] Add E2E tests with Playwright
- [ ] Set up automated CI/CD testing pipeline
- [ ] Add performance monitoring and analytics
- [ ] Implement error tracking (Sentry integration)
- [ ] Add accessibility testing automation
- [ ] Create visual regression testing

### 🎮 Game Features & Mechanics

#### Enhanced Gameplay

- [ ] Add time-based challenges (speed rounds)
- [ ] Implement difficulty levels (easy/medium/hard)
- [ ] Add hint system (region clues, compass direction)
- [ ] Create streak tracking and achievements
- [ ] Add multiplayer real-time games
- [ ] Implement tournament mode
- [ ] Add daily/weekly challenges
- [ ] Create themed game modes (cities only, nature only, etc.)

#### Game Modes

- [ ] Add "Elimination" mode (you're out after X wrong guesses)
- [ ] Create "Distance Challenge" mode (closer = more points)
- [ ] Implement "Region Lock" mode (guess within specific regions)
- [ ] Add "Photo Series" mode (multiple photos from same location)
- [ ] Create "Collaborative" mode (team guessing)
- [ ] Add "Expert" mode (no country borders on map)

#### Scoring & Statistics

- [ ] Implement detailed player analytics dashboard
- [ ] Add global leaderboards
- [ ] Create personal achievement system
- [ ] Add score comparison with friends
- [ ] Implement ELO-style rating system
- [ ] Add detailed game history with maps
- [ ] Create performance trends and insights

### 🏗️ Backend & Infrastructure

#### Cloudflare Integration

- [ ] Set up Cloudflare Workers for API endpoints
- [ ] Implement R2 bucket for image storage
- [ ] Configure KV storage for game metadata
- [ ] Add user authentication system
- [ ] Implement rate limiting and security measures
- [ ] Set up CDN optimization for global image delivery
- [ ] Add backup and disaster recovery
- [ ] Implement database migrations system

#### API Development

- [ ] Create RESTful API documentation
- [ ] Add API versioning strategy
- [ ] Implement proper caching strategies
- [ ] Add webhook support for integrations
- [ ] Create admin API for content management
- [ ] Add bulk operations for game management
- [ ] Implement search indexing for games
- [ ] Add analytics and usage tracking APIs

### 👥 User Features & Social

#### User Management

- [ ] Add user registration and login system
- [ ] Implement OAuth (Google, Facebook, Twitter)
- [ ] Add friend system and social connections
- [ ] Implement user preferences and settings
- [ ] Add account deletion and data export
- [ ] Create user verification system
- [ ] Add parental controls for younger users

#### Social Features

- [ ] Add real-time chat during multiplayer games
- [ ] Implement follow/follower system
- [ ] Create user-generated content moderation
- [ ] Add game collections and favorites
- [ ] Implement social media integration
- [ ] Add community forums or discussion boards
- [ ] Create user-generated tutorials and guides
- [ ] Add community events and competitions

### 📱 Mobile & Accessibility

#### Mobile Optimization

- [ ] Improve touch gestures for map interaction
- [ ] Add haptic feedback for mobile devices
- [ ] Optimize for various screen sizes and orientations
- [ ] Add swipe gestures for navigation
- [ ] Implement native app wrapper (Capacitor)
- [ ] Add push notifications for challenges
- [ ] Optimize battery usage for extended play

#### Accessibility

- [ ] Add screen reader support and ARIA labels
- [ ] Implement keyboard navigation
- [ ] Add high contrast theme option
- [ ] Support for color-blind users
- [ ] Add font size adjustment options
- [ ] Implement voice commands (Web Speech API)
- [ ] Add alternative input methods
- [ ] Create simplified UI mode

### 🎨 UI/UX Improvements

#### Visual Design

- [ ] Add customizable UI themes
- [ ] Implement smooth animations and transitions
- [ ] Add particle effects and visual feedback
- [ ] Create loading animations and micro-interactions
- [ ] Add sound effects and audio feedback
- [ ] Implement visual indicators for game progress
- [ ] Create immersive full-screen mode

#### User Experience

- [ ] Add contextual help and tooltips
- [ ] Create intuitive game settings panel
- [ ] Add undo/redo functionality for guesses
- [ ] Implement drag-and-drop for custom games
- [ ] Add keyboard shortcuts for power users
- [ ] Create customizable dashboard

### 🔍 Content & Discovery

#### Image Management

- [ ] Add advanced image tagging system
- [ ] Implement automatic location extraction from EXIF
- [ ] Add image quality validation
- [ ] Create bulk image upload tool
- [ ] Add image editing capabilities (crop, rotate)
- [ ] Implement reverse image search protection
- [ ] Add watermarking for user-generated content
- [ ] Create automated inappropriate content detection

#### Game Discovery

- [ ] Add advanced search with filters
- [ ] Implement recommendation engine
- [ ] Create trending games section
- [ ] Add game categories and tags
- [ ] Implement "Games like this" suggestions
- [ ] Add featured games showcase
- [ ] Create curator system for quality games
- [ ] Add region-specific game discovery

### 📊 Analytics & Insights

#### Player Analytics

- [ ] Add detailed play session tracking
- [ ] Implement heatmaps for guess patterns
- [ ] Create geographic accuracy analysis
- [ ] Add learning curve tracking
- [ ] Implement A/B testing framework
- [ ] Add retention and engagement metrics
- [ ] Create personalized improvement suggestions
- [ ] Add comparative performance analysis

#### Business Intelligence

- [ ] Add game performance metrics
- [ ] Implement user engagement tracking
- [ ] Create content creation analytics
- [ ] Add geographic usage patterns
- [ ] Implement funnel analysis
- [ ] Add revenue tracking (if monetized)
- [ ] Create automated reporting system
- [ ] Add predictive analytics for content needs

### 🎯 Advanced Features

#### AI & Machine Learning

- [ ] Add AI-powered image difficulty assessment
- [ ] Implement smart game recommendation
- [ ] Create automated game balancing
- [ ] Add computer vision for location verification
- [ ] Implement natural language processing for comments
- [ ] Add predictive analytics for user behavior
- [ ] Create intelligent content moderation
- [ ] Add personalized difficulty adjustment

#### Integration & APIs

- [ ] Add Google Street View integration
- [ ] Implement Wikipedia integration for locations
- [ ] Add weather data for locations
- [ ] Create tourism board partnerships
- [ ] Add educational content integration
- [ ] Implement travel planning features
- [ ] Add photography tips and guides
- [ ] Create virtual reality mode

### 🏆 Gamification & Engagement

#### Achievement System

- [ ] Create comprehensive badge system
- [ ] Add progression levels and unlockables
- [ ] Implement seasonal events and challenges
- [ ] Add rare location hunting
- [ ] Create photography challenges
- [ ] Add educational quests
- [ ] Implement guild/clan system
- [ ] Add mentorship programs

#### Competitive Features

- [ ] Add global tournaments
- [ ] Implement ranking seasons
- [ ] Create prize competitions
- [ ] Add sponsored challenges
- [ ] Implement skill-based matchmaking
- [ ] Add spectator mode for competitions
- [ ] Create coaching and training modes
- [ ] Add professional player profiles

---

_Last updated: June 2025_
