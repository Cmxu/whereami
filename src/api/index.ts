import { Image, Location } from '../types';
import exifr from 'exifr';
import { getImagesList } from '../utils/imageUtils';

// Function to get all available images with extracted metadata
export const getImages = async (): Promise<Image[]> => {
  try {
    // Use the static image list directly
    const imageUrls = getImagesList();
    return await Promise.all(imageUrls.map(processImage));
  } catch (error) {
    console.error('Error fetching images:', error);
    return [];
  }
};

// Process an image to extract its metadata
const processImage = async (imagePath: string): Promise<Image> => {
  try {
    const location = await extractImageLocation(imagePath);
    
    return {
      id: imagePath.split('/').pop() || `img-${Math.random().toString(36).substring(2, 9)}`,
      src: imagePath,
      location: location || fallbackLocation()
    };
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    // Return with fallback location if extraction fails
    return {
      id: imagePath.split('/').pop() || `img-${Math.random().toString(36).substring(2, 9)}`,
      src: imagePath,
      location: fallbackLocation()
    };
  }
};

// Extract location information from image metadata
const extractImageLocation = async (imagePath: string): Promise<Location | null> => {
  try {
    const gps = await exifr.gps(imagePath);
    
    if (!gps || !gps.latitude || !gps.longitude) {
      return null;
    }
    
    return {
      lat: gps.latitude,
      lng: gps.longitude
    };
  } catch (error) {
    console.error(`Error extracting GPS data from ${imagePath}:`, error);
    return null;
  }
};

// Generate a random fallback location (this would be used only if metadata extraction fails)
const fallbackLocation = (): Location => {
  // Generate random coordinates (for development/testing only)
  return {
    lat: (Math.random() * 180) - 90,
    lng: (Math.random() * 360) - 180
  };
}; 