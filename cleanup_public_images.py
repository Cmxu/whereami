#!/usr/bin/env python3
"""
Script to delete all public images from both R2 storage and KV namespace.
This will completely clean up all public images uploaded by the public@geo.cmxu.io user.

Usage:
    python cleanup_public_images.py [auth_token]

Arguments:
    auth_token: JWT token for authentication (optional, can be set as environment variable)

Environment Variables:
    WHEREAMI_AUTH_TOKEN: JWT token for authentication
    WHEREAMI_API_BASE: Base URL for the API (default: https://106d32a5.whereami-5kp.pages.dev)
"""

import asyncio
import aiohttp
import json
import logging
import os
import sys
from typing import List, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PublicImageCleaner:
    def __init__(self, auth_token: str, api_base: str = "https://106d32a5.whereami-5kp.pages.dev"):
        self.auth_token = auth_token
        self.api_base = api_base.rstrip('/')
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            headers={'Authorization': f'Bearer {self.auth_token}'},
            timeout=aiohttp.ClientTimeout(total=30)
        )
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def get_public_images(self) -> List[Dict]:
        """Get all public images from the API"""
        logger.info("Fetching all public images...")
        
        all_images = []
        offset = 0
        limit = 1000  # Get large batches
        
        while True:
            url = f"{self.api_base}/api/images/public?limit={limit}&offset={offset}"
            
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        logger.error(f"Failed to fetch public images (status {response.status})")
                        break
                        
                    data = await response.json()
                    images = data.get('images', [])
                    
                    if not images:
                        break
                        
                    all_images.extend(images)
                    logger.info(f"Fetched {len(images)} images (total: {len(all_images)})")
                    
                    # Check if there are more images
                    if not data.get('hasMore', False):
                        break
                        
                    offset += limit
                    
            except Exception as e:
                logger.error(f"Error fetching public images: {e}")
                break
                
        logger.info(f"Found {len(all_images)} total public images")
        return all_images
        
    async def delete_image(self, image_id: str) -> bool:
        """Delete a single image by ID"""
        url = f"{self.api_base}/api/images/{image_id}"
        
        try:
            async with self.session.delete(url) as response:
                if response.status == 200:
                    return True
                elif response.status == 404:
                    logger.warning(f"Image {image_id} not found (already deleted?)")
                    return True  # Consider already deleted as success
                else:
                    logger.error(f"Failed to delete image {image_id} (status {response.status})")
                    return False
                    
        except Exception as e:
            logger.error(f"Error deleting image {image_id}: {e}")
            return False
            
    async def confirm_deletion(self, image_count: int) -> bool:
        """Ask user to confirm the deletion operation"""
        print(f"\n⚠️  WARNING: This will PERMANENTLY DELETE {image_count} public images!")
        print("This action cannot be undone.")
        print("\nThe following will be deleted:")
        print("- All image files from R2 storage")
        print("- All image metadata from KV namespace")
        print("- All references from public images index")
        print("- All references from user's images list")
        
        while True:
            response = input(f"\nAre you sure you want to delete {image_count} images? [yes/no]: ").lower().strip()
            if response in ['yes', 'y']:
                return True
            elif response in ['no', 'n']:
                return False
            else:
                print("Please enter 'yes' or 'no'")

async def main():
    # Get auth token from command line or environment
    auth_token = None
    
    if len(sys.argv) > 1:
        auth_token = sys.argv[1]
    else:
        auth_token = os.getenv('WHEREAMI_AUTH_TOKEN')
        
    if not auth_token:
        print("Error: Authentication token required")
        print("Usage: python cleanup_public_images.py [auth_token]")
        print("Or set WHEREAMI_AUTH_TOKEN environment variable")
        sys.exit(1)
        
    # Get API base URL from environment
    api_base = os.getenv('WHEREAMI_API_BASE', 'https://106d32a5.whereami-5kp.pages.dev')
    
    async with PublicImageCleaner(auth_token, api_base) as cleaner:
        # Get all public images
        public_images = await cleaner.get_public_images()
        
        if not public_images:
            logger.info("No public images found to delete")
            return
            
        # Confirm deletion
        if not await cleaner.confirm_deletion(len(public_images)):
            logger.info("Operation cancelled by user")
            return
            
        logger.info(f"Starting deletion of {len(public_images)} public images...")
        
        # Delete all images with progress tracking
        deleted_count = 0
        failed_count = 0
        
        for i, image in enumerate(public_images, 1):
            image_id = image.get('id')
            image_filename = image.get('filename', 'unknown')
            
            logger.info(f"Deleting image {i}/{len(public_images)}: {image_filename} ({image_id})")
            
            success = await cleaner.delete_image(image_id)
            if success:
                deleted_count += 1
            else:
                failed_count += 1
                
            # Add small delay to avoid overwhelming the API
            await asyncio.sleep(0.1)
            
        # Summary
        logger.info(f"\n=== Cleanup Summary ===")
        logger.info(f"Total images processed: {len(public_images)}")
        logger.info(f"Successfully deleted: {deleted_count}")
        logger.info(f"Failed deletions: {failed_count}")
        
        if failed_count == 0:
            logger.info("✅ All public images have been successfully deleted!")
        else:
            logger.warning(f"⚠️  {failed_count} images could not be deleted")

def print_usage():
    """Print usage instructions"""
    print(__doc__)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help']:
        print_usage()
        sys.exit(0)
        
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1) 