#!/usr/bin/env python3
"""
upload_landmark_images.py - Download and upload landmark images to the curated gallery.

This script reads landmark_images.json, downloads each image from Wikimedia Commons,
automatically resizes large images to appropriate dimensions (max 2048px, max 5MB),
validates them, and uploads them to the application's curated images gallery with 
location data and source URL.

Features:
- Automatic image resizing for large images
- High-quality JPEG compression with 85% quality
- RGBA to RGB conversion for better compatibility
- Maintains aspect ratio during resizing

Usage:
    python upload_landmark_images.py [json_file] [auth_token]

Example:
    python upload_landmark_images.py public_images/landmark_images.json "your_supabase_jwt_token"

Requirements:
    pip install Pillow aiohttp aiofiles
"""

import asyncio
import aiohttp
import aiofiles
import json
import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import logging
from urllib.parse import urlparse
from PIL import Image
import io

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LandmarkImageUploader:
    """Upload landmark images to the application's curated gallery."""
    
    def __init__(self, auth_token: str, base_url: str = "https://geo.cmxu.io"):
        self.auth_token = auth_token
        self.base_url = base_url.rstrip('/')
        self.upload_url = f"{self.base_url}/api/images/upload-simple"
        self.session = None
        
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=60),
            headers={
                'Authorization': f'Bearer {self.auth_token}',
                'User-Agent': 'Landmark Image Uploader/1.0'
            }
        )
        return self
    
    async def __aexit__(self, *args):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    def resize_image_if_needed(self, image_data: bytes, max_size: int = 2048, max_file_size: int = 5 * 1024 * 1024) -> bytes:
        """Resize image if it's too large or file size is too big.
        
        Args:
            image_data: Raw image bytes
            max_size: Maximum width/height in pixels (default 2048)
            max_file_size: Maximum file size in bytes (default 5MB)
            
        Returns:
            Resized image bytes if resizing was needed, otherwise original bytes
        """
        try:
            # Check if file size is within limits
            if len(image_data) <= max_file_size:
                # Still check if image dimensions need resizing
                with Image.open(io.BytesIO(image_data)) as img:
                    width, height = img.size
                    if width <= max_size and height <= max_size:
                        # No resizing needed
                        return image_data
            
            # Load image and resize if needed
            with Image.open(io.BytesIO(image_data)) as img:
                # Convert RGBA to RGB if needed (for JPEG compatibility)
                if img.mode == 'RGBA':
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                
                width, height = img.size
                logger.info(f"Original image size: {width}x{height}, file size: {len(image_data)} bytes")
                
                # Calculate new dimensions while maintaining aspect ratio
                if width > max_size or height > max_size:
                    ratio = min(max_size / width, max_size / height)
                    new_width = int(width * ratio)
                    new_height = int(height * ratio)
                    
                    # Resize using high-quality resampling
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    logger.info(f"Resized to: {new_width}x{new_height}")
                
                # Save with optimized quality
                output_buffer = io.BytesIO()
                
                # Determine output format - prefer JPEG for better compression
                if img.mode == 'L':
                    # Grayscale - save as PNG to preserve quality
                    img.save(output_buffer, format='PNG', optimize=True)
                else:
                    # Color image - save as JPEG with high quality
                    img.save(output_buffer, format='JPEG', quality=85, optimize=True)
                
                resized_data = output_buffer.getvalue()
                logger.info(f"Compressed file size: {len(resized_data)} bytes (reduction: {len(image_data) - len(resized_data)} bytes)")
                
                return resized_data
                
        except Exception as e:
            logger.warning(f"Failed to resize image: {str(e)}, using original")
            return image_data
    
    async def download_image(self, url: str, landmark_name: str) -> Optional[bytes]:
        """Download image from Wikimedia Commons."""
        try:
            logger.info(f"Downloading image for {landmark_name}: {url}")
            
            async with self.session.get(url) as response:
                if response.status != 200:
                    logger.error(f"Failed to download {url}: HTTP {response.status}")
                    return None
                
                # Check content type
                content_type = response.headers.get('content-type', '')
                if not content_type.startswith('image/'):
                    logger.error(f"URL does not point to an image: {content_type}")
                    return None
                
                # Check file size (warn if very large, but still download and resize)
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > 50 * 1024 * 1024:
                    logger.warning(f"Very large image download: {content_length} bytes - will resize after download")
                
                image_data = await response.read()
                logger.info(f"Downloaded {len(image_data)} bytes for {landmark_name}")
                
                # Resize image if it's too large
                resized_image_data = self.resize_image_if_needed(image_data)
                
                return resized_image_data
                
        except Exception as e:
            logger.error(f"Error downloading image for {landmark_name}: {str(e)}")
            return None
    
    def get_file_extension(self, image_data: bytes, url: str = '', content_type: str = '') -> str:
        """Get appropriate file extension for the image based on actual content."""
        try:
            # Try to detect format from image data
            with Image.open(io.BytesIO(image_data)) as img:
                if img.format:
                    format_lower = img.format.lower()
                    if format_lower in ['jpeg', 'jpg']:
                        return 'jpg'
                    elif format_lower == 'png':
                        return 'png'
                    elif format_lower == 'webp':
                        return 'webp'
                    elif format_lower == 'gif':
                        return 'gif'
        except Exception:
            # Fall back to URL/content-type detection
            pass
        
        # Try to get extension from URL
        if url:
            parsed_url = urlparse(url)
            path = parsed_url.path.lower()
            
            if path.endswith(('.jpg', '.jpeg')):
                return 'jpg'
            elif path.endswith('.png'):
                return 'png'
            elif path.endswith('.webp'):
                return 'webp'
            elif path.endswith('.gif'):
                return 'gif'
        
        # Fall back to content type
        if content_type:
            if 'jpeg' in content_type or 'jpg' in content_type:
                return 'jpg'
            elif 'png' in content_type:
                return 'png'
            elif 'webp' in content_type:
                return 'webp'
            elif 'gif' in content_type:
                return 'gif'
        
        # Default to jpg (most common after processing)
        return 'jpg'
    
    async def upload_image(self, image_data: bytes, landmark_data: Dict) -> bool:
        """Upload image to the application's curated gallery."""
        try:
            landmark_name = landmark_data.get('landmark', 'Unknown')
            location = landmark_data.get('location', {})
            source_url = landmark_data.get('commons_url', '')
            
            # Validate location data
            lat = location.get('lat')
            lon = location.get('lon') 
            
            if lat is None or lon is None:
                logger.error(f"Missing location data for {landmark_name}")
                return False
            
            # Create a temporary file for the image
            file_extension = self.get_file_extension(
                image_data,
                landmark_data.get('url', ''),
                'image/jpeg'  # default
            )
            
            # Sanitize landmark name for filename
            safe_name = "".join(c for c in landmark_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_name = safe_name.replace(' ', '_')
            filename = f"{safe_name}.{file_extension}"
            
            # Prepare form data
            form_data = aiohttp.FormData()
            
            # Add image file
            form_data.add_field(
                'image',
                image_data,
                filename=filename,
                content_type=f'image/{file_extension}'
            )
            
            # Add location data
            location_json = json.dumps({
                'lat': float(lat),
                'lng': float(lon)  # Note: API expects 'lng' not 'lon'
            })
            form_data.add_field('location', location_json)
            
            # Add custom name (landmark name)
            form_data.add_field('customName', landmark_name)
            
            # Add source URL
            if source_url:
                form_data.add_field('sourceUrl', source_url)
            
            logger.info(f"Uploading {landmark_name} to gallery...")
            
            # Upload to the API
            async with self.session.post(self.upload_url, data=form_data) as response:
                response_text = await response.text()
                
                if response.status == 201:
                    try:
                        result = json.loads(response_text)
                        logger.info(f"✅ Successfully uploaded {landmark_name}")
                        logger.info(f"   Image URL: {result.get('imageUrl', 'N/A')}")
                        return True
                    except json.JSONDecodeError:
                        logger.info(f"✅ Successfully uploaded {landmark_name} (non-JSON response)")
                        return True
                elif response.status == 401:
                    logger.error(f"❌ Authentication failed for {landmark_name}: HTTP {response.status}")
                    logger.error(f"   Your auth token may have expired. Get a fresh token and try again.")
                    logger.error(f"   Run: node get-public-token.js")
                    return False
                else:
                    logger.error(f"❌ Upload failed for {landmark_name}: HTTP {response.status}")
                    logger.error(f"   Response: {response_text}")
                    return False
                    
        except Exception as e:
            logger.error(f"❌ Error uploading {landmark_name}: {str(e)}")
            return False
    
    async def process_landmark(self, landmark_data: Dict) -> Tuple[bool, Optional[str]]:
        """Process a single landmark: download and upload.
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        landmark_name = landmark_data.get('landmark', 'Unknown')
        image_url = landmark_data.get('url', '')
        
        if not image_url:
            error_msg = f"No image URL for {landmark_name}"
            logger.error(error_msg)
            return False, error_msg
        
        # Download the image
        image_data = await self.download_image(image_url, landmark_name)
        if not image_data:
            error_msg = f"Failed to download image for {landmark_name}"
            return False, error_msg
        
        # Upload to gallery
        success = await self.upload_image(image_data, landmark_data)
        if success:
            return True, None
        else:
            error_msg = f"Failed to upload {landmark_name} to gallery"
            return False, error_msg

async def load_landmark_data(json_file: str) -> List[Dict]:
    """Load landmark data from JSON file."""
    try:
        async with aiofiles.open(json_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            data = json.loads(content)
            
        if not isinstance(data, list):
            logger.error("JSON file should contain a list of landmarks")
            return []
        
        logger.info(f"Loaded {len(data)} landmarks from {json_file}")
        return data
        
    except FileNotFoundError:
        logger.error(f"File not found: {json_file}")
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {json_file}: {str(e)}")
        return []
    except Exception as e:
        logger.error(f"Error loading {json_file}: {str(e)}")
        return []

async def save_failed_landmarks(failed_landmarks: List[Dict], output_file: str) -> None:
    """Save failed landmarks to a JSON file."""
    try:
        async with aiofiles.open(output_file, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(failed_landmarks, indent=2, ensure_ascii=False))
        logger.info(f"Saved {len(failed_landmarks)} failed landmarks to {output_file}")
    except Exception as e:
        logger.error(f"Failed to save failed landmarks: {str(e)}")

async def upload_landmarks(landmarks: List[Dict], auth_token: str, max_concurrent: int = 3) -> None:
    """Upload all landmarks with controlled concurrency."""
    if not landmarks:
        logger.error("No landmarks to upload")
        return
    
    logger.info(f"Starting upload of {len(landmarks)} landmarks...")
    
    # Create semaphore to limit concurrent uploads
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def upload_with_semaphore(uploader: LandmarkImageUploader, landmark_data: Dict) -> Tuple[bool, Optional[str]]:
        async with semaphore:
            return await uploader.process_landmark(landmark_data)
    
    # Track failed landmarks
    failed_landmarks = []
    
    # Upload all landmarks
    async with LandmarkImageUploader(auth_token) as uploader:
        tasks = [upload_with_semaphore(uploader, landmark) for landmark in landmarks]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results and collect failures
    successful = 0
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Exception processing {landmarks[i].get('landmark', 'Unknown')}: {str(result)}")
            failed_landmarks.append({
                **landmarks[i],
                'error': str(result),
                'error_type': 'exception'
            })
        elif isinstance(result, tuple):
            success, error_message = result
            if success:
                successful += 1
            else:
                failed_landmarks.append({
                    **landmarks[i],
                    'error': error_message or 'Unknown error',
                    'error_type': 'processing_failed'
                })
        else:
            # Handle legacy boolean returns
            if result is True:
                successful += 1
            else:
                failed_landmarks.append({
                    **landmarks[i],
                    'error': 'Upload failed',
                    'error_type': 'upload_failed'
                })
    
    failed = len(results) - successful
    
    # Save failed landmarks to JSON file if there are any
    if failed_landmarks:
        failed_file = "failed_landmark_uploads.json"
        await save_failed_landmarks(failed_landmarks, failed_file)
    
    logger.info(f"\n=== Upload Summary ===")
    logger.info(f"Total landmarks: {len(landmarks)}")
    logger.info(f"Successfully uploaded: {successful}")
    logger.info(f"Failed uploads: {failed}")
    logger.info(f"Success rate: {successful/len(landmarks)*100:.1f}%")
    
    if failed_landmarks:
        logger.info(f"Failed landmarks saved to: failed_landmark_uploads.json")
        logger.info(f"You can retry failed uploads by running the script on this file.")

def print_usage():
    """Print usage instructions."""
    print("Usage: python upload_landmark_images.py [json_file] [auth_token]")
    print("")
    print("Arguments:")
    print("  json_file   - Path to landmark_images.json file")
    print("  auth_token  - Supabase JWT authentication token for the public user")
    print("")
    print("Example:")
    print("  python upload_landmark_images.py public_images/landmark_images.json 'eyJ0eXAi...'")
    print("")
    print("To get the public user auth token:")
    print("  Method 1 - Using the token script:")
    print("    1. Create a public user account in Supabase (e.g., public@whereami.app)")
    print("    2. Run: node get-public-token.js")
    print("    3. Copy the Bearer token from the output")
    print("")
    print("  Method 2 - Using browser:")
    print("    1. Sign in as the public user at https://bbc8934f.whereami-5kp.pages.dev")
    print("    2. Open browser dev tools (F12)")
    print("    3. Go to Application/Storage → Local Storage")
    print("    4. Find 'sb-[project-id]-auth-token' item")
    print("    5. Copy the 'access_token' value from the JSON")
    print("")
    print("Note: Tokens expire after ~1 hour, so get a fresh token if uploads fail with 401 errors")

def validate_auth_token(token: str) -> bool:
    """Validate that the auth token looks like a JWT token."""
    if not token or len(token) < 20:
        return False
    
    # JWT tokens have 3 parts separated by dots
    parts = token.split('.')
    if len(parts) != 3:
        logger.error("Auth token should be a JWT with 3 parts separated by dots")
        return False
    
    # Check if it starts with a reasonable header (base64 encoded)
    try:
        import base64
        # Add padding if needed
        header_part = parts[0]
        header_part += '=' * (4 - len(header_part) % 4)
        header = base64.b64decode(header_part).decode('utf-8')
        
        if 'typ' not in header or 'alg' not in header:
            logger.error("Auth token doesn't appear to be a valid JWT")
            return False
            
    except Exception:
        logger.error("Auth token is not properly base64 encoded")
        return False
    
    return True

async def main():
    """Main function."""
    if len(sys.argv) < 3:
        print_usage()
        sys.exit(1)
    
    json_file = sys.argv[1]
    auth_token = sys.argv[2]
    
    if not Path(json_file).exists():
        logger.error(f"File not found: {json_file}")
        sys.exit(1)
    
    if not validate_auth_token(auth_token):
        logger.error("Invalid auth token provided")
        print_usage()
        sys.exit(1)
    
    # Load landmark data
    landmarks = await load_landmark_data(json_file)
    if not landmarks:
        sys.exit(1)
    
    # Ask for confirmation
    print(f"\nAbout to upload {len(landmarks)} landmark images to the curated gallery.")
    print("This will download images from Wikimedia Commons and upload them to your app.")
    print("")
    
    try:
        confirm = input("Do you want to continue? (y/N): ").strip().lower()
        if confirm not in ['y', 'yes']:
            print("Upload cancelled.")
            sys.exit(0)
    except KeyboardInterrupt:
        print("\nUpload cancelled.")
        sys.exit(0)
    
    # Upload landmarks
    await upload_landmarks(landmarks, auth_token)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nScript interrupted by user.")
        sys.exit(1)