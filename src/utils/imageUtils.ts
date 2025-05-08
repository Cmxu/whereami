import exifr from 'exifr';
import { Image, Location } from '../types';

/**
 * Gets a list of all image files from the public/images directory
 */
export const getImagesList = (): string[] => {
  return [
    'images/IMG_20250420_110720.jpg',
    'images/IMG_20250423_150610.jpg',
    'images/IMG_20250423_193906.jpg',
    'images/IMG_20250424_211014.jpg',
    'images/IMG_20250428_132427.jpg',
    'images/MVIMG_20250426_175425.jpg',
    'images/MVIMG_20250428_172515.jpg',
    'images/MVIMG_20250429_101255.jpg',
    'images/MVIMG_20250430_165520.jpg',
    'images/MVIMG_20250430_200212.jpg'
  ];
};

/**
 * Extract GPS location data from an image's EXIF metadata
 */
export const getImageLocation = async (imagePath: string): Promise<Location | null> => {
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

/**
 * Load a batch of images with their location data
 */
export const loadImagesWithMetadata = async (imageUrls: string[]): Promise<Image[]> => {
  const images: Image[] = [];
  
  for (const url of imageUrls) {
    try {
      // In development, this will be handled by the mock server
      // In production, this would fetch the real image and extract its metadata
      const location = await getImageLocation(url);
      
      if (location) {
        images.push({
          id: url.split('/').pop() || `img-${Math.random().toString(36).slice(2, 9)}`,
          src: url,
          location
        });
      }
    } catch (error) {
      console.error(`Error processing image ${url}:`, error);
    }
  }
  
  return images;
};

/**
 * Generate a random selection of n images from a larger set
 */
export const getRandomImages = (images: Image[], count: number): Image[] => {
  if (images.length <= count) return images;
  
  const shuffled = [...images].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}; 