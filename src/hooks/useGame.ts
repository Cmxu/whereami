import { useState, useEffect } from 'react';
import { GameState, Location, Image, Round } from '../types';
import exifr from 'exifr';
import { getImagesList as getStaticImagesList } from '../utils/imageUtils';

const MAX_SCORE = 10000; // Maximum score per round
const MIN_DISTANCE = 0.01; // 10 meters (in km) - full points threshold
const MAX_DISTANCE = 5000; // 5000 km - zero points threshold
const DEFAULT_NUM_ROUNDS = 3;

// Calculate distance between two points using Haversine formula
// This calculates the great-circle distance between two points on a sphere
const calculateDistance = (point1: Location, point2: Location): number => {
  // Convert latitude and longitude from degrees to radians
  const toRad = (value: number) => (value * Math.PI) / 180;
  
  // Earth's radius in kilometers
  const R = 6371;
  
  // Calculate differences in coordinates
  const dLat = toRad(point2.lat - point1.lat);
  const dLng = toRad(point2.lng - point1.lng);
  
  // Haversine formula
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distance in kilometers, rounded to 2 decimal places
  return Math.round((R * c) * 100) / 100;
};

// Calculate score based on distance with steep drop-off curve (similar to reversed tanh)
const calculateScore = (distance: number): number => {
  // Full points if within 10 meters
  if (distance <= MIN_DISTANCE) return MAX_SCORE;
  
  // Zero points if beyond 5000 km
  if (distance >= MAX_DISTANCE) return 0;
  
  // Using the specific formula provided:
  // score(x) = (log_10((x+10000-0.01)/100000)+1/(10046.9))^-1 - 46.9 where 0.01 <= x < 5000
  return Math.round((Math.log10((distance + 100000 - 0.01) / 100000) + 1 / 10046.9) ** -1 - 46.9);
};

// Format distance for display (meters if < 500m, km otherwise)
export const formatDistance = (distance: number): string => {
  if (distance < 0.5) { // Less than 500 meters (0.5 km)
    // Convert to meters and round to nearest meter
    const meters = Math.round(distance * 1000);
    return `${meters} m`;
  } else {
    // Keep in kilometers with 2 decimal precision
    return `${distance.toFixed(2)} km`;
  }
};

// Create hardcoded images if needed as a fallback
const createFallbackImages = (): Image[] => {
  // Predefined locations around the world
  const locations = [
    { lat: 48.8584, lng: 2.2945 },    // Paris (Eiffel Tower)
    { lat: 40.7128, lng: -74.0060 },  // New York
    { lat: 51.5074, lng: -0.1278 },   // London
  ];
  
  // Use the actual images from our public folder
  const images = [
    'images/IMG_20250420_110720.jpg',
    'images/IMG_20250423_132919.jpg',
    'images/IMG_20250423_150610.jpg',
  ];
  
  return images.map((path, index) => ({
    id: `img-${index + 1}`,
    src: path,
    location: locations[index % locations.length]
  }));
};

// Get list of images from public/images directory
const getImagesList = async (): Promise<string[]> => {
  try {
    // Use the static list instead of API
    return getStaticImagesList();
  } catch (error) {
    console.error('Error getting images list:', error);
    // Fallback to hardcoded list
    return [
      'images/IMG_20250420_110720.jpg',
      'images/IMG_20250423_132919.jpg',
      'images/IMG_20250423_150610.jpg',
      'images/IMG_20250423_193906.jpg',
      'images/IMG_20250424_211014.jpg',
      'images/IMG_20250428_132427.jpg',
      'images/MVIMG_20250425_212939.jpg',
      'images/MVIMG_20250426_175425.jpg',
      'images/MVIMG_20250428_172515.jpg',
      'images/MVIMG_20250429_101255.jpg',
      'images/MVIMG_20250430_165520.jpg',
      'images/MVIMG_20250430_200212.jpg',
      'images/MVIMG_20250501_085216.jpg'
    ];
  }
};

// Extract real GPS location data from image EXIF metadata
const getImageLocation = async (imagePath: string): Promise<Location | null> => {
  try {
    console.log(`Extracting EXIF data from: ${imagePath}`);
    const gps = await exifr.gps(imagePath);
    
    if (!gps || !gps.latitude || !gps.longitude) {
      console.warn(`No GPS data found for image: ${imagePath}`);
      return null;
    }
    
    console.log(`Found location: ${gps.latitude}, ${gps.longitude}`);
    return {
      lat: gps.latitude,
      lng: gps.longitude
    };
  } catch (error) {
    console.error(`Error extracting GPS data from ${imagePath}:`, error);
    return null;
  }
};

// Function to randomly select image paths
const getRandomImagePaths = (imagePaths: string[], count: number): string[] => {
  // Use a more robust shuffling algorithm (Fisher-Yates)
  const shuffled = [...imagePaths];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, imagePaths.length));
};

// Load and process only the randomly selected images
const loadRandomImagesWithLocations = async (count: number): Promise<Image[]> => {
  try {
    const allImagePaths = await getImagesList();
    console.log("Available images:", allImagePaths);
    
    // Verify images exist before processing
    const verifiedPaths: string[] = [];
    for (const path of allImagePaths) {
      try {
        // Try to fetch the image to verify it exists
        const response = await fetch(path, { method: 'HEAD' });
        if (response.ok) {
          verifiedPaths.push(path);
        } else {
          console.warn(`Image not found, will be skipped: ${path}`);
        }
      } catch (error) {
        console.warn(`Error verifying image ${path}, will be skipped:`, error);
      }
    }
    
    if (verifiedPaths.length === 0) {
      console.error("No valid images found to use");
      return [];
    }
    
    console.log("Verified images:", verifiedPaths);
    const randomPaths = getRandomImagePaths(verifiedPaths, count);
    const images: Image[] = [];
    
    for (const url of randomPaths) {
      try {
        const location = await getImageLocation(url);
        
        if (location) {
          images.push({
            id: url.split('/').pop() || `img-${Math.random().toString(36).slice(2, 9)}`,
            src: url,
            location
          });
          console.log(`Added random image ${url} with location: ${location.lat}, ${location.lng}`);
        }
      } catch (error) {
        console.error(`Error processing image ${url}:`, error);
      }
    }
    
    // If we couldn't load enough images with valid locations, use fallback
    if (images.length < count) {
      console.warn(`Only loaded ${images.length} valid images, needed ${count}`);
    }
    
    return images;
  } catch (error) {
    console.error('Error loading random images with metadata:', error);
    return [];
  }
};

// Update the hook signature to accept numRounds as a parameter
export const useGame = (initialNumRounds = DEFAULT_NUM_ROUNDS) => {
  const [numRounds, setNumRounds] = useState(initialNumRounds);
  const [gameState, setGameState] = useState<GameState>({
    rounds: [],
    currentRound: 0,
    totalScore: 0,
    gameComplete: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Initialize the game only when resetGame is triggered
  useEffect(() => {
    // Skip initial load, we'll wait for resetGame to be called
    if (resetTrigger === 0) return;
    
    const initGame = async () => {
      try {
        setIsLoading(true);
        
        // Load only the random images we need with their location data
        console.log(`Loading ${numRounds} random images with EXIF location data...`);
        let selectedImages = await loadRandomImagesWithLocations(numRounds);
        
        if (!Array.isArray(selectedImages) || selectedImages.length < numRounds) {
          console.error(`Not enough valid images with location data found. Using fallback images.`);
          
          // Fill in with fallback images if needed
          const fallbackImages = createFallbackImages();
          
          // Only add fallback images if we need them
          const missingCount = numRounds - selectedImages.length;
          if (missingCount > 0) {
            selectedImages = [
              ...selectedImages,
              ...fallbackImages.slice(0, missingCount)
            ];
          }
        }
        
        console.log(`Successfully loaded ${selectedImages.length} images for the game`);
        
        // Create initial rounds
        const rounds: Round[] = selectedImages.map((image, index) => ({
          id: index + 1,
          image: image,
          score: 0,
          distance: undefined,
          userGuess: undefined
        }));
        
        // Update game state with the new rounds
        setGameState({
          rounds,
          currentRound: 0,
          totalScore: 0,
          gameComplete: false
        });
        
      } catch (error) {
        console.error('Error initializing game:', error);
        setError('Failed to initialize game. Please refresh the page to try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    initGame();
  }, [numRounds, resetTrigger]);

  // Submit a guess for the current round
  const submitGuess = (location: Location) => {
    if (gameState.gameComplete) return;
    
    const currentRound = gameState.rounds[gameState.currentRound];
    const distance = calculateDistance(location, currentRound.image.location);
    const score = calculateScore(distance);
    const formattedDistance = formatDistance(distance);
    
    const updatedRounds = gameState.rounds.map((round, index) => {
      if (index === gameState.currentRound) {
        return {
          ...round,
          userGuess: location,
          score,
          distance,
          formattedDistance
        };
      }
      return round;
    });
    
    const totalScore = updatedRounds.reduce((sum, round) => sum + round.score, 0);
    
    // First update the current round with the guess but don't advance yet
    setGameState({
      ...gameState,
      rounds: updatedRounds,
      totalScore
    });
    
    // Return the updated round data for immediate display
    return {
      userGuess: location,
      score,
      distance,
      formattedDistance,
      isLastRound: gameState.currentRound === numRounds - 1
    };
  };

  // Proceed to the next round
  const proceedToNextRound = () => {
    const nextRound = gameState.currentRound + 1;
    const isGameComplete = nextRound >= numRounds;
    
    setGameState(prevState => ({
      ...prevState,
      currentRound: nextRound,
      gameComplete: isGameComplete
    }));
  };

  // Modify the resetGame function to accept a new round count parameter
  const resetGame = (newNumRounds?: number) => {
    if (newNumRounds !== undefined) {
      setNumRounds(newNumRounds);
    }
    setResetTrigger(prev => prev + 1);
  };

  return {
    gameState,
    isLoading,
    error,
    submitGuess,
    proceedToNextRound,
    resetGame,
    setNumRounds
  };
}; 