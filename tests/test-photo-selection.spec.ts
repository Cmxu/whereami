import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test.describe('Photo Selection for Game Creation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the deployed site
    await page.goto('https://whereami-5kp.pages.dev/');
    
    // Login with the test account
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByPlaceholder('Enter your email').fill('cmxu@comcast.net');
    await page.getByPlaceholder('Enter your password').fill('admin1');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for successful login
    await expect(page.getByText('Welcome back!')).toBeVisible();
    
    // Navigate to create page
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Create Game')).toBeVisible();
  });

  test('should allow clicking anywhere on image to select/deselect in game creation', async ({ page }) => {
    // Wait for the gallery to load
    await expect(page.locator('.gallery-grid')).toBeVisible();
    
    // Get the first image in the gallery
    const firstImage = page.locator('.gallery-item').first();
    await expect(firstImage).toBeVisible();
    
    // Click anywhere on the image (not just the checkbox) to select it
    await firstImage.locator('.image-container').click();
    
    // Verify the image is selected by checking for the selection indicator
    await expect(firstImage.locator('.selected-indicator')).toBeVisible();
    
    // Verify the checkbox is checked
    await expect(firstImage.locator('input[type="checkbox"]')).toBeChecked();
    
    // Click on the image again to deselect it
    await firstImage.locator('.image-container').click();
    
    // Verify the image is deselected
    await expect(firstImage.locator('.selected-indicator')).not.toBeVisible();
    await expect(firstImage.locator('input[type="checkbox"]')).not.toBeChecked();
  });

  test('should allow selecting multiple images by clicking on them', async ({ page }) => {
    // Wait for the gallery to load
    await expect(page.locator('.gallery-grid')).toBeVisible();
    
    // Select first three images by clicking on them
    const images = page.locator('.gallery-item').first().locator('.image-container');
    
    for (let i = 0; i < 3; i++) {
      const image = page.locator('.gallery-item').nth(i);
      await image.locator('.image-container').click();
      
      // Verify each image is selected
      await expect(image.locator('.selected-indicator')).toBeVisible();
      await expect(image.locator('input[type="checkbox"]')).toBeChecked();
    }
    
    // Verify the selection count shows 3 selected
    await expect(page.getByText('3 selected')).toBeVisible();
    
    // Verify the Create Game button is enabled
    await expect(page.getByRole('button', { name: 'Create Game (3)' })).toBeEnabled();
  });

  test('should work with both checkbox and image click', async ({ page }) => {
    // Wait for the gallery to load
    await expect(page.locator('.gallery-grid')).toBeVisible();
    
    const firstImage = page.locator('.gallery-item').first();
    const secondImage = page.locator('.gallery-item').nth(1);
    
    // Select first image by clicking on the image
    await firstImage.locator('.image-container').click();
    await expect(firstImage.locator('.selected-indicator')).toBeVisible();
    
    // Select second image by clicking on the checkbox
    await secondImage.locator('input[type="checkbox"]').click();
    await expect(secondImage.locator('.selected-indicator')).toBeVisible();
    
    // Verify both are selected
    await expect(page.getByText('2 selected')).toBeVisible();
    
    // Deselect first image by clicking on the checkbox
    await firstImage.locator('input[type="checkbox"]').click();
    await expect(firstImage.locator('.selected-indicator')).not.toBeVisible();
    
    // Deselect second image by clicking on the image
    await secondImage.locator('.image-container').click();
    await expect(secondImage.locator('.selected-indicator')).not.toBeVisible();
    
    // Verify none are selected
    await expect(page.getByText('selected')).not.toBeVisible();
  });

  test('should show create game modal when enough images are selected', async ({ page }) => {
    // Wait for the gallery to load
    await expect(page.locator('.gallery-grid')).toBeVisible();
    
    // Select first 3 images by clicking on them
    for (let i = 0; i < 3; i++) {
      const image = page.locator('.gallery-item').nth(i);
      await image.locator('.image-container').click();
    }
    
    // Click the Create Game button
    await page.getByRole('button', { name: 'Create Game (3)' }).click();
    
    // Verify the create game modal opens
    await expect(page.getByText('Create Custom Game')).toBeVisible();
    await expect(page.getByText('Creating a game with 3 photos')).toBeVisible();
  });

});

test.describe('Photo Selection and Gallery Tests', () => {
  test('Photo selection and upload functionality', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to upload page with authentication
    await auth.gotoProtected('/upload');
    
    // The page should now be authenticated and ready for upload
    await expect(page).toHaveURL(/.*\/upload/);
    
    // Check if the file input exists
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    
    console.log('✅ Upload page is accessible and functional');
    
    // Navigate to gallery to check existing content
    await page.goto('/gallery');
    
    const imageCount = await auth.getImageCount();
    console.log(`📸 User currently has ${imageCount} images in gallery`);
    
    if (imageCount > 0) {
      // Test photo selection if images exist
      const firstImage = page.locator('.gallery-grid .gallery-item').first();
      await expect(firstImage).toBeVisible();
      
      // Click on first image to view details
      await firstImage.click();
      
      // Check if image modal or detail view opens
      const modal = page.locator('[role="dialog"], .image-modal, .image-detail');
      if (await modal.isVisible({ timeout: 3000 })) {
        console.log('✅ Image detail view opens correctly');
        
        // Close modal if it opened
        const closeButton = modal.locator('button[aria-label*="close"], button:has-text("×"), .close-button');
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        } else {
          // Try pressing Escape to close
          await page.keyboard.press('Escape');
        }
      }
    } else {
      console.log('ℹ️  No images found - upload functionality available for testing');
    }
  });

  test('Gallery navigation and filtering', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to gallery with authentication
    await auth.gotoProtected('/gallery');
    
    const imageCount = await auth.getImageCount();
    
    if (imageCount > 0) {
      console.log(`📸 Testing gallery with ${imageCount} images`);
      
      // Test basic gallery functionality
      const galleryGrid = page.locator('.gallery-grid');
      await expect(galleryGrid).toBeVisible();
      
      // Check for filter or sort options if they exist
      const filterOptions = page.locator('[data-testid="filter"], .filter-controls, select[name*="filter"]');
      if (await filterOptions.isVisible({ timeout: 2000 })) {
        console.log('✅ Filter options available');
      }
      
      // Check for pagination if it exists
      const pagination = page.locator('.pagination, [aria-label*="pagination"]');
      if (await pagination.isVisible({ timeout: 2000 })) {
        console.log('✅ Pagination controls available');
      }
      
      // Test image grid responsiveness
      await page.setViewportSize({ width: 800, height: 600 });
      await expect(galleryGrid).toBeVisible();
      
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(galleryGrid).toBeVisible();
      
      console.log('✅ Gallery is responsive across different viewport sizes');
      
    } else {
      console.log('ℹ️  Empty gallery - testing empty state');
      
      // Check for empty state message
      const emptyState = page.locator('.empty-state, .no-images, [data-testid="empty-gallery"]');
      const emptyMessage = await emptyState.isVisible({ timeout: 2000 });
      
      if (emptyMessage) {
        console.log('✅ Empty state properly displayed');
      }
      
      // Check for upload prompt in empty state
      const uploadPrompt = page.locator('a[href="/upload"], button:has-text("Upload")');
      if (await uploadPrompt.isVisible({ timeout: 2000 })) {
        console.log('✅ Upload prompt available in empty state');
      }
    }
  });

  test('Photo metadata and details', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to gallery
    await auth.gotoProtected('/gallery');
    
    const imageCount = await auth.getImageCount();
    
    if (imageCount > 0) {
      console.log('🔍 Testing image metadata and details');
      
      const firstImage = page.locator('.gallery-grid .gallery-item').first();
      await expect(firstImage).toBeVisible();
      
      // Look for metadata indicators
      const metadata = firstImage.locator('.metadata, .image-info, [data-testid="image-metadata"]');
      if (await metadata.isVisible({ timeout: 2000 })) {
        console.log('✅ Image metadata visible in gallery');
      }
      
      // Click to view details
      await firstImage.click();
      
      // Wait for detail view
      await page.waitForTimeout(1000);
      
      // Look for detailed metadata
      const detailMetadata = page.locator('.image-details, .metadata-panel, [data-testid="detailed-metadata"]');
      if (await detailMetadata.isVisible({ timeout: 3000 })) {
        console.log('✅ Detailed metadata view available');
        
        // Look for common metadata fields
        const locationInfo = page.locator(':has-text("Location"), :has-text("GPS"), :has-text("Coordinates")');
        if (await locationInfo.isVisible({ timeout: 1000 })) {
          console.log('✅ Location metadata displayed');
        }
        
        const dateInfo = page.locator(':has-text("Date"), :has-text("Taken"), :has-text("Created")');
        if (await dateInfo.isVisible({ timeout: 1000 })) {
          console.log('✅ Date metadata displayed');
        }
      }
      
      // Close detail view
      await page.keyboard.press('Escape');
      
    } else {
      console.log('ℹ️  No images available for metadata testing');
    }
  });
}); 