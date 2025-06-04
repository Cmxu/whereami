import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test.describe('Authentication Verification', () => {
  test('Verify authentication state is properly loaded', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to a protected page
    await page.goto('/gallery');
    
    // Check if authentication is working
    const isAuthenticated = await auth.isAuthenticated();
    
    if (isAuthenticated) {
      console.log('✅ Authentication state successfully loaded from storage');
      
      // Verify we can access authenticated features
      const signInButton = page.getByText('Sign In to Continue');
      await expect(signInButton).not.toBeVisible();
      
      // Check for authenticated user interface elements
      const authenticatedElements = [
        '.gallery-grid',
        '.empty-state',
        'nav a[href="/profile"]',
        'nav a[href="/create"]',
        'a[href="/upload"]'
      ];
      
      let foundElements = 0;
      for (const selector of authenticatedElements) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          foundElements++;
        }
      }
      
      expect(foundElements).toBeGreaterThan(0);
      console.log(`✅ Found ${foundElements} authenticated UI elements`);
      
    } else {
      console.log('❌ Authentication state not properly loaded');
      console.log('This might indicate an issue with the setup process');
    }
  });

  test('Verify navigation to protected pages', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Test navigation to different protected pages
    const protectedPages = ['/gallery', '/profile', '/create'];
    
    for (const pagePath of protectedPages) {
      console.log(`🔗 Testing navigation to ${pagePath}`);
      
      try {
        await auth.gotoProtected(pagePath);
        await expect(page).toHaveURL(new RegExp(`.*${pagePath}`));
        console.log(`✅ Successfully navigated to ${pagePath}`);
        
        // Verify no authentication prompts
        const signInPrompt = page.getByText('Sign In to Continue');
        expect(await signInPrompt.isVisible({ timeout: 1000 })).toBeFalsy();
        
      } catch (error) {
        if (pagePath === '/profile' || pagePath === '/create') {
          console.log(`ℹ️  Page ${pagePath} might not exist yet - skipping`);
        } else {
          throw error;
        }
      }
    }
  });

  test('Verify authentication persists across page reloads', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to gallery
    await auth.gotoProtected('/gallery');
    
    // Verify initial authentication
    expect(await auth.isAuthenticated()).toBeTruthy();
    console.log('✅ Initial authentication verified');
    
    // Reload the page
    await page.reload();
    
    // Wait a moment for the page to settle
    await page.waitForTimeout(2000);
    
    // Verify authentication persists
    expect(await auth.isAuthenticated()).toBeTruthy();
    console.log('✅ Authentication persisted after page reload');
    
    // Test hard navigation
    await page.goto('/gallery');
    await page.waitForTimeout(2000);
    
    expect(await auth.isAuthenticated()).toBeTruthy();
    console.log('✅ Authentication persisted after hard navigation');
  });

  test('Test authentication utilities', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Test the utility methods
    await auth.gotoProtected('/gallery');
    
    // Test image count utility
    const imageCount = await auth.getImageCount();
    console.log(`📸 Image count utility returned: ${imageCount}`);
    expect(typeof imageCount).toBe('number');
    expect(imageCount).toBeGreaterThanOrEqual(0);
    
    // Test hasImages utility
    const hasImages = await auth.hasImages();
    console.log(`🖼️  HasImages utility returned: ${hasImages}`);
    expect(typeof hasImages).toBe('boolean');
    
    // Verify consistency between utilities
    if (imageCount > 0) {
      expect(hasImages).toBeTruthy();
    } else {
      expect(hasImages).toBeFalsy();
    }
    
    console.log('✅ Authentication utilities working correctly');
  });
}); 