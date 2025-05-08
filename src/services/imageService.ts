import exifr from 'exifr';
import { Image, Location } from '../types';
import { getImagesList as getStaticImagesList } from '../utils/imageUtils';

/**
 * Gets a list of all image files from the public/images directory
 */
export const getImagesList = async (): Promise<string[]> => {
  try {
    // Use the static list instead of fetching from API
    return getStaticImagesList();
  } catch (error) {
    console.error('Error getting images list:', error);
    return [];
  }
};

// Extract GPS coordinates from image metadata
export const extractImageLocation = async (imagePath: string): Promise<Location | null> => {
  try {
    const gps = await exifr.gps(imagePath);
    if (!gps || !gps.latitude || !gps.longitude) {
      console.warn(`No GPS data found for image: ${imagePath}`);
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

// Load images and extract their metadata
export const loadImages = async (imageUrls: string[]): Promise<Image[]> => {
  const images: Image[] = [];
  
  for (const url of imageUrls) {
    const location = await extractImageLocation(url);
    
    if (location) {
      images.push({
        id: `img-${images.length + 1}`,
        src: url,
        location
      });
    }
  }
  
  return images;
}; 