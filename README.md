# WhereAmI - A Geography Guessing Game

WhereAmI is a web-based geography guessing game inspired by GeoGuessr. The game shows you images from around the world, and you need to guess where they were taken by clicking on a map. The closer your guess is to the actual location, the more points you earn!

## Features

- 3-round gameplay with random images each time
- Interactive world map for making guesses
- Scoring based on the distance between your guess and the actual location
- Detailed results showing your performance for each round
- Responsive design that works on both desktop and mobile devices

## How to Play

1. For each image shown, examine it carefully for clues about its location
2. Click on the world map to place your guess
3. Submit your guess to see how close you were to the actual location
4. Each round is worth up to 10,000 points, with points decreasing as distance increases
5. After 3 rounds, you'll see your total score and detailed results

## Tech Stack

- React with TypeScript
- Vite for fast development and building
- Leaflet for interactive maps
- Exifr for extracting GPS coordinates from image metadata

## Development

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Adding Your Own Images

To use your own images with location data:

1. Add image files with embedded GPS metadata to the `public/images/` directory
2. The app will automatically extract location data from the image EXIF metadata
3. If an image doesn't have GPS data, a fallback random location will be used

## Build for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

MIT

## Acknowledgements

- Map data © OpenStreetMap contributors
- Leaflet - an open-source JavaScript library for mobile-friendly interactive maps
