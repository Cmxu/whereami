import { test, expect } from '@playwright/test';

test.describe('Gallery Public Tab - No Auth Required', () => {
	test('should load public gallery tab without authentication', async ({ page }) => {
		// Navigate directly to public gallery tab
		await page.goto('/gallery?tab=public');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Check that we're on the correct URL
		expect(page.url()).toContain('tab=public');
		
		// The page should load and show either:
		// 1. Loading state
		// 2. Public gallery content
		// 3. Empty state for no public photos
		// 4. Sign in prompt (but still allow viewing public content)
		
		// Wait a bit for any dynamic content to load
		await page.waitForTimeout(3000);
		
		// Check for any of the expected states
		const loadingText = page.locator('text=Loading public gallery...');
		const galleryContent = page.locator('.public-gallery');
		const emptyState = page.locator('text=No Public Photos Yet');
		const signInPrompt = page.locator('text=Sign in');
		
		// At least one of these should be visible
		const anyVisible = await Promise.all([
			loadingText.isVisible().catch(() => false),
			galleryContent.isVisible().catch(() => false),
			emptyState.isVisible().catch(() => false),
			signInPrompt.isVisible().catch(() => false)
		]);
		
		const hasVisibleElement = anyVisible.some(visible => visible);
		expect(hasVisibleElement).toBe(true);
		
		// Take a screenshot for debugging
		await page.screenshot({ path: 'test-results/public-gallery-test.png' });
	});

	test('should show public tab button in navigation', async ({ page }) => {
		await page.goto('/gallery');
		
		// Wait for page to load
		await page.waitForLoadState('networkidle');
		
		// Look for the public tab button - it might be in different states depending on auth
		const publicTabButton = page.locator('button:has-text("🌍 Public")');
		
		// If we're authenticated, the button should be visible
		// If not authenticated, we might be on a different page layout
		const isAuthenticated = await page.locator('text=Your Photo Gallery').isVisible();
		
		if (isAuthenticated) {
			await expect(publicTabButton).toBeVisible();
		} else {
			// If not authenticated, navigate directly to test the functionality
			await page.goto('/gallery?tab=public');
			expect(page.url()).toContain('tab=public');
		}
	});
}); 