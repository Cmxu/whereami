#!/usr/bin/env python3
"""
find_photo.py - Search Wikimedia Commons for quality images of landmarks with camera locations.

This script reads landmarks from landmarks.txt and searches Wikimedia Commons for quality images
that have GPS/camera location data embedded. It uses async requests for efficient processing.

Usage:
    python find_photo.py [landmarks_file]

Example:
    python find_photo.py public_images/landmarks.txt
"""

import asyncio
import aiohttp
import json
import re
import sys
from pathlib import Path
from typing import List, Dict, Optional
from urllib.parse import quote_plus
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class WikiCommonsSearcher:
    """Async searcher for Wikimedia Commons quality images with camera locations."""
    
    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.base_url = "https://commons.wikimedia.org/w/api.php"
        
    async def search_quality_images(self, landmark: str, limit: int = 10) -> List[Dict]:
        """Enhanced search for quality images using multiple strategies."""
        logger.info(f"Searching for: {landmark}")
        all_results = []
        seen_titles = set()
        
        # Strategy 1: Original content search with variations
        results1 = await self._search_by_content_variations(landmark, limit)
        self._add_unique_results(all_results, seen_titles, results1)
        if all_results:  # Stop after finding first result
            return all_results[:1]
        
        # Strategy 2: Category-based search
        results2 = await self._search_by_categories(landmark, limit)
        self._add_unique_results(all_results, seen_titles, results2)
        if all_results:  # Stop after finding first result
            return all_results[:1]
        
        # Strategy 3: Coordinate-based search for known landmarks
        results3 = await self._search_by_coordinates(landmark, limit)
        self._add_unique_results(all_results, seen_titles, results3)
        if all_results:  # Stop after finding first result
            return all_results[:1]
        
        # Strategy 4: Quality image filter search
        results4 = await self._search_quality_filtered(landmark, limit)
        self._add_unique_results(all_results, seen_titles, results4)
        
        logger.info(f"Found {len(all_results)} unique images with location data for {landmark}")
        return all_results[:1]  # Return only the first (best) result
    
    def _add_unique_results(self, all_results: List[Dict], seen_titles: set, new_results: List[Dict]):
        """Add new results to the list, avoiding duplicates."""
        for result in new_results:
            if result['title'] not in seen_titles:
                all_results.append(result)
                seen_titles.add(result['title'])
    
    async def _search_by_content_variations(self, landmark: str, limit: int) -> List[Dict]:
        """Search using multiple content variations."""
        search_variations = self._generate_search_variations(landmark)
        
        for search_term in search_variations:
            try:
                search_params = {
                    'action': 'query',
                    'format': 'json',
                    'list': 'search',
                    'srsearch': f'"{search_term}" filetype:bitmap',
                    'srnamespace': 6,
                    'srlimit': limit * 2,
                    'srprop': 'title|snippet'
                }
                
                async with self.session.get(self.base_url, params=search_params) as response:
                    if response.status != 200:
                        continue
                    
                    data = await response.json()
                    search_results = data.get('query', {}).get('search', [])
                    
                    if search_results:
                        logger.debug(f"Content search '{search_term}' found {len(search_results)} results")
                        return await self._check_images_for_location(search_results, landmark, limit)
                        
            except Exception as e:
                logger.debug(f"Content search error for '{search_term}': {e}")
                continue
        
        return []
    
    async def _search_by_categories(self, landmark: str, limit: int) -> List[Dict]:
        """Search by relevant categories."""
        category_searches = self._generate_category_searches(landmark)
        results = []
        
        for category_search in category_searches:
            try:
                logger.debug(f"Searching category: {category_search}")
                
                params = {
                    'action': 'query',
                    'format': 'json',
                    'list': 'categorymembers',
                    'cmtitle': f'Category:{category_search}',
                    'cmnamespace': 6,
                    'cmlimit': limit * 2,
                    'cmprop': 'title'
                }
                
                async with self.session.get(self.base_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        members = data.get('query', {}).get('categorymembers', [])
                        
                        if members:
                            logger.debug(f"Category '{category_search}' has {len(members)} files")
                            category_results = await self._check_images_for_location(members, landmark, limit)
                            if category_results:
                                return category_results  # Return immediately after finding first result
                                
            except Exception as e:
                logger.debug(f"Category search error for '{category_search}': {e}")
                continue
        
        return results
    
    async def _search_by_coordinates(self, landmark: str, limit: int) -> List[Dict]:
        """Search by coordinates if location can be guessed."""
        coords = self._guess_coordinates(landmark)
        if not coords:
            return []
        
        lat, lon = coords
        logger.debug(f"Searching coordinates: {lat}, {lon}")
        
        try:
            params = {
                'action': 'query',
                'format': 'json', 
                'list': 'geosearch',
                'gscoord': f'{lat}|{lon}',
                'gsradius': 2000,  # 2km radius
                'gsnamespace': 6,
                'gslimit': limit * 3
            }
            
            async with self.session.get(self.base_url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    geo_results = data.get('query', {}).get('geosearch', [])
                    
                    if geo_results:
                        logger.debug(f"Coordinate search found {len(geo_results)} files")
                        
                        # Filter for relevant files
                        relevant_files = []
                        keywords = self._get_search_keywords(landmark)
                        
                        for result in geo_results:
                            title = result.get('title', '').lower()
                            if any(keyword in title for keyword in keywords):
                                relevant_files.append(result)
                        
                        if relevant_files:
                            logger.debug(f"Found {len(relevant_files)} relevant files near coordinates")
                            return await self._check_images_for_location(relevant_files, landmark, limit)
        
        except Exception as e:
            logger.debug(f"Coordinate search error: {e}")
        
        return []
    
    async def _search_quality_filtered(self, landmark: str, limit: int) -> List[Dict]:
        """Search with quality image filter."""
        search_variations = [
            f'{landmark} hasassessment:quality-image',
            f'"{landmark}" hasassessment:quality-image',
            f'{landmark.replace("\'s", "")} hasassessment:quality-image'
        ]
        
        for search_term in search_variations:
            try:
                params = {
                    'action': 'query',
                    'format': 'json',
                    'list': 'search',
                    'srsearch': search_term,
                    'srnamespace': 6,
                    'srlimit': limit,
                    'srprop': 'title|snippet'
                }
                
                async with self.session.get(self.base_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        search_results = data.get('query', {}).get('search', [])
                        
                        if search_results:
                            logger.debug(f"Quality search '{search_term}' found {len(search_results)} results")
                            return await self._check_images_for_location(search_results, landmark, limit)
                            
            except Exception as e:
                logger.debug(f"Quality search error for '{search_term}': {e}")
                continue
        
        return []
    
    def _generate_search_variations(self, landmark: str) -> List[str]:
        """Generate search term variations."""
        variations = [
            landmark,
            landmark.replace("'s", "").replace("'", ""),  # Remove possessives
            landmark.replace("'s", " ").replace("'", " "),  # Replace with space
        ]
        
        # Add location-specific variations
        if "diocletian" in landmark.lower():
            variations.extend([
                landmark.replace("Cellars", "basement"),
                landmark.replace("Cellars", "cellar"),
                landmark.replace("'s Cellars", " Palace"),
                "Split basement",
                "Split cellar",
                "Old Town Split"
            ])
        
        return list(set(variations))  # Remove duplicates
    
    def _generate_category_searches(self, landmark: str) -> List[str]:
        """Generate potential category names."""
        landmark_clean = landmark.replace("'s", "").replace("'", "")
        
        categories = [
            landmark,
            landmark_clean,
        ]
        
        # Special cases for known landmarks
        if "diocletian" in landmark.lower():
            categories.extend([
                "Diocletian's Palace",
                "Basements of Diocletian's Palace", 
                "Diocletian Palace",
                "Buildings in Split",
                "Quality images of Split"
            ])
        
        return list(set(categories))
    
    def _guess_coordinates(self, landmark: str) -> Optional[tuple]:
        """Guess coordinates for well-known landmarks."""
        landmark_lower = landmark.lower()
        
        known_coords = {
            "diocletian": (43.5081, 16.4402),  # Split, Croatia
            "split": (43.5081, 16.4402),
            "colosseum": (41.8902, 12.4922),  # Rome
            "eiffel tower": (48.8584, 2.2945),  # Paris
            "big ben": (51.4994, -0.1245),  # London
        }
        
        for key, coords in known_coords.items():
            if key in landmark_lower:
                return coords
        
        return None
    
    def _get_search_keywords(self, landmark: str) -> List[str]:
        """Get search keywords for filtering relevant results."""
        landmark_lower = landmark.lower()
        keywords = landmark_lower.split()
        
        if "diocletian" in landmark_lower:
            keywords.extend(["diocletian", "palace", "split", "basement", "cellar", "croatia"])
        
        return [kw.lower() for kw in keywords]
    
    async def _check_images_for_location(self, search_results: List[Dict], landmark: str, limit: int) -> List[Dict]:
        """Check search results for location data."""
        quality_images = []
        
        for result in search_results[:limit * 2]:  # Check more than limit in case some don't have location
            file_title = result.get('title', result.get('name', ''))
            if not file_title:
                continue
                
            image_info = await self.get_image_info(file_title)
            if image_info and self.has_camera_location(image_info):
                quality_images.append({
                    'title': file_title,
                    'landmark': landmark,
                    'url': image_info.get('url', ''),
                    'description': image_info.get('description', ''),
                    'location': image_info.get('location', {}),
                    'commons_url': f"https://commons.wikimedia.org/wiki/{file_title.replace(' ', '_')}"
                })
                
                # Return immediately after finding the first image with location data
                return quality_images
        
        return quality_images
    
    async def get_image_info(self, file_title: str) -> Optional[Dict]:
        """Get detailed information about an image file."""
        try:
            info_params = {
                'action': 'query',
                'format': 'json',
                'titles': file_title,
                'prop': 'imageinfo|coordinates',
                'iiprop': 'url|extmetadata|size',
                'iiurlwidth': 800,
                'coprop': 'country|region|globe'
            }
            
            async with self.session.get(self.base_url, params=info_params) as response:
                if response.status != 200:
                    return None
                
                data = await response.json()
                pages = data.get('query', {}).get('pages', {})
                
                for page_id, page_data in pages.items():
                    if page_id == '-1':  # Page not found
                        continue
                    
                    imageinfo = page_data.get('imageinfo', [])
                    coordinates = page_data.get('coordinates', [])
                    
                    if not imageinfo:
                        continue
                    
                    info = imageinfo[0]
                    extmetadata = info.get('extmetadata', {})
                    
                    # Extract GPS coordinates if available
                    location = {}
                    if coordinates:
                        coord = coordinates[0]
                        location = {
                            'lat': coord.get('lat'),
                            'lon': coord.get('lon'),
                            'country': coord.get('country', ''),
                            'region': coord.get('region', '')
                        }
                    
                    # Check for EXIF GPS data in metadata
                    gps_lat = extmetadata.get('GPSLatitude', {}).get('value', '')
                    gps_lon = extmetadata.get('GPSLongitude', {}).get('value', '')
                    
                    if gps_lat and gps_lon and not location:
                        # Parse GPS coordinates from EXIF
                        lat = self.parse_gps_coordinate(gps_lat)
                        lon = self.parse_gps_coordinate(gps_lon)
                        if lat is not None and lon is not None:
                            location = {'lat': lat, 'lon': lon}
                    
                    return {
                        'url': info.get('url', ''),
                        'thumburl': info.get('thumburl', ''),
                        'description': extmetadata.get('ImageDescription', {}).get('value', ''),
                        'artist': extmetadata.get('Artist', {}).get('value', ''),
                        'location': location,
                        'width': info.get('width', 0),
                        'height': info.get('height', 0)
                    }
                
                return None
                
        except Exception as e:
            logger.error(f"Error getting image info for {file_title}: {str(e)}")
            return None
    
    def parse_gps_coordinate(self, gps_string: str) -> Optional[float]:
        """Parse GPS coordinate from EXIF format to decimal degrees."""
        try:
            # Remove HTML tags and extra whitespace
            clean_string = re.sub(r'<[^>]+>', '', gps_string).strip()
            
            # Look for decimal format first
            decimal_match = re.search(r'([+-]?\d+\.?\d*)', clean_string)
            if decimal_match:
                return float(decimal_match.group(1))
            
            # Handle degrees, minutes, seconds format
            dms_match = re.search(r'(\d+)[°\s]+(\d+)[\'′\s]+([0-9.]+)[\"″\s]*([NSEW]?)', clean_string)
            if dms_match:
                degrees = float(dms_match.group(1))
                minutes = float(dms_match.group(2))
                seconds = float(dms_match.group(3))
                direction = dms_match.group(4).upper()
                
                decimal = degrees + minutes/60 + seconds/3600
                
                # Apply direction
                if direction in ['S', 'W']:
                    decimal = -decimal
                
                return decimal
            
            return None
            
        except (ValueError, AttributeError):
            return None
    
    def has_camera_location(self, image_info: Dict) -> bool:
        """Check if image has camera/GPS location data."""
        location = image_info.get('location', {})
        return bool(location.get('lat') and location.get('lon'))

def parse_landmarks_file(file_path: str) -> List[str]:
    """Parse the landmarks.txt file and extract landmark names."""
    landmarks = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Extract numbered landmarks (lines that start with a number followed by a dot)
        landmark_pattern = r'^\d+\.\s+(.+)$'
        
        for line in content.split('\n'):
            line = line.strip()
            match = re.match(landmark_pattern, line)
            if match:
                landmark_name = match.group(1).strip()
                # Clean up landmark name (remove parenthetical location info for search)
                clean_name = re.sub(r'\s*\([^)]+\)$', '', landmark_name)
                landmarks.append(clean_name)
    
    except FileNotFoundError:
        logger.error(f"Landmarks file not found: {file_path}")
        return []
    except Exception as e:
        logger.error(f"Error parsing landmarks file: {str(e)}")
        return []
    
    logger.info(f"Parsed {len(landmarks)} landmarks from {file_path}")
    return landmarks

def load_existing_results(file_path: str) -> Dict[str, Dict]:
    """Load existing landmark image results from JSON file."""
    if not Path(file_path).exists():
        logger.info(f"No existing results file found at: {file_path}")
        return {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            results_list = json.load(f)
        
        # Convert list to dict keyed by landmark name for easy lookup
        existing_results = {}
        for result in results_list:
            landmark = result.get('landmark', '')
            if landmark:
                existing_results[landmark] = result
        
        logger.info(f"Loaded {len(existing_results)} existing results from {file_path}")
        return existing_results
        
    except Exception as e:
        logger.error(f"Error loading existing results: {str(e)}")
        return {}

def filter_landmarks_to_search(landmarks: List[str], existing_results: Dict[str, Dict]) -> List[str]:
    """Filter out landmarks that already have results."""
    landmarks_to_search = []
    
    for landmark in landmarks:
        if landmark not in existing_results:
            landmarks_to_search.append(landmark)
        else:
            logger.debug(f"Skipping {landmark} - already have result")
    
    logger.info(f"Need to search for {len(landmarks_to_search)} landmarks ({len(landmarks) - len(landmarks_to_search)} already found)")
    return landmarks_to_search

async def search_landmark_images(landmarks: List[str], max_concurrent: int = 5) -> List[Dict]:
    """Search for images of all landmarks concurrently."""
    results = []
    
    # Create semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=30),
        headers={'User-Agent': 'WikiCommons Landmark Image Finder/1.0'}
    ) as session:
        searcher = WikiCommonsSearcher(session)
        
        async def search_with_semaphore(landmark: str) -> List[Dict]:
            async with semaphore:
                logger.info(f"Searching for images of: {landmark}")
                return await searcher.search_quality_images(landmark)
        
        # Create tasks for all landmarks
        tasks = [search_with_semaphore(landmark) for landmark in landmarks]
        
        # Execute all searches concurrently
        landmark_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        for i, result in enumerate(landmark_results):
            if isinstance(result, Exception):
                logger.error(f"Error searching for {landmarks[i]}: {str(result)}")
                continue
            
            if result:  # If images were found
                results.extend(result)
                logger.info(f"Found {len(result)} image(s) for: {landmarks[i]}")
            else:
                logger.warning(f"No images with location data found for: {landmarks[i]}")
    
    return results

async def main():
    """Main function to run the landmark image search."""
    # Get landmarks file path from command line or use default
    landmarks_file = sys.argv[1] if len(sys.argv) > 1 else "public_images/landmarks.txt"
    
    if not Path(landmarks_file).exists():
        logger.error(f"Landmarks file not found: {landmarks_file}")
        sys.exit(1)
    
    logger.info(f"Starting landmark image search from: {landmarks_file}")
    
    # Define output file path
    output_file = "public_images/landmark_images.json"
    
    # Load existing results if they exist
    existing_results = load_existing_results(output_file)
    
    # Parse landmarks from file
    landmarks = parse_landmarks_file(landmarks_file)
    if not landmarks:
        logger.error("No landmarks found in file")
        sys.exit(1)
    
    # Filter out landmarks that already have results
    landmarks_to_search = filter_landmarks_to_search(landmarks, existing_results)
    
    if not landmarks_to_search:
        logger.info("All landmarks already have results!")
        return
    
    # Search for images of remaining landmarks
    new_results = await search_landmark_images(landmarks_to_search)
    
    # Combine existing and new results
    all_results = list(existing_results.values()) + new_results
    
    # Save combined results to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Search complete! Found {len(new_results)} new images with location data")
    logger.info(f"Total results: {len(all_results)} images")
    logger.info(f"Results saved to: {output_file}")
    
    # Print summary
    print(f"\nSummary:")
    print(f"- Total landmarks: {len(landmarks)}")
    print(f"- Previously found: {len(existing_results)}")
    print(f"- Searched this run: {len(landmarks_to_search)}")
    print(f"- New results found: {len(new_results)}")
    print(f"- Total images with locations: {len(all_results)}")
    print(f"- Overall success rate: {len(all_results)/len(landmarks)*100:.1f}%")
    
    # Show new results found this run
    if new_results:
        print(f"\nNew results found this run:")
        for i, result in enumerate(new_results[:5]):
            print(f"{i+1}. {result['landmark']}")
            print(f"   URL: {result['commons_url']}")
            location = result['location']
            print(f"   Location: {location.get('lat', 'N/A')}, {location.get('lon', 'N/A')}")
            print()

if __name__ == "__main__":
    # Run the async main function
    asyncio.run(main())