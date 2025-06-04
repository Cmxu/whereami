import { test, expect } from '@playwright/test';

test.describe('Simple Authentication Check', () => {
  test('Debug authentication state', async ({ page }) => {
    console.log('🔍 Starting authentication debug...');
    
    // Navigate to gallery
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot
    await page.screenshot({ path: 'tests/screenshots/debug-gallery-state.png' });
    
    // Check current URL
    console.log(`📍 Current URL: ${page.url()}`);
    
    // Check for sign-in elements
    const signInButton = page.getByText('Sign In to Continue');
    const isSignInVisible = await signInButton.isVisible({ timeout: 2000 });
    console.log(`🔐 Sign In button visible: ${isSignInVisible}`);
    
    // Check for authenticated elements
    const galleryGrid = page.locator('.gallery-grid');
    const isGalleryVisible = await galleryGrid.isVisible({ timeout: 2000 });
    console.log(`📸 Gallery grid visible: ${isGalleryVisible}`);
    
    const emptyState = page.locator('.empty-state');
    const isEmptyStateVisible = await emptyState.isVisible({ timeout: 2000 });
    console.log(`📭 Empty state visible: ${isEmptyStateVisible}`);
    
    // Check for navigation elements
    const uploadLink = page.locator('a[href="/upload"]');
    const isUploadLinkVisible = await uploadLink.isVisible({ timeout: 2000 });
    console.log(`⬆️  Upload link visible: ${isUploadLinkVisible}`);
    
    // Check page content
    const pageText = await page.textContent('body');
    console.log(`📄 Page contains "Sign In": ${pageText?.includes('Sign In') || false}`);
    console.log(`📄 Page contains "Gallery": ${pageText?.includes('Gallery') || false}`);
    console.log(`📄 Page contains "Upload": ${pageText?.includes('Upload') || false}`);
    
    // Get storage state for debugging
    const storageState = await page.context().storageState();
    console.log(`🗄️  Storage state cookies: ${storageState.cookies.length}`);
    console.log(`🗄️  Storage state origins: ${storageState.origins.length}`);
    
    if (storageState.origins.length > 0) {
      const origin = storageState.origins[0];
      console.log(`🗄️  LocalStorage items: ${origin.localStorage?.length || 0}`);
      // Note: sessionStorage might not be available in storage state
      console.log(`🗄️  Origin data: ${JSON.stringify(origin, null, 2)}`);
    }
    
    // Determine authentication status
    const isAuthenticated = !isSignInVisible && (isGalleryVisible || isEmptyStateVisible || isUploadLinkVisible);
    console.log(`✅ Determined authentication status: ${isAuthenticated}`);
    
    if (isAuthenticated) {
      console.log('🎉 User appears to be authenticated!');
    } else {
      console.log('❌ User does not appear to be authenticated');
    }
  });
}); 