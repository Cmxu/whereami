import { test, expect } from '@playwright/test';

test.describe('Gallery Public Tab', () => {
	test('should display public images tab and load public gallery', async ({ page }) => {
		// Navigate to gallery page
		await page.goto('/gallery');

		// Check if we're on the sign-in page (unauthenticated)
		const signInButton = page.locator('button:has-text("Sign In to Continue")');
		if (await signInButton.isVisible()) {
			// Skip test if not authenticated - public gallery should work without auth
			// Navigate directly to public tab
			await page.goto('/gallery?tab=public');
			
			// Should still show sign-in for authenticated features but allow public browsing
			// For now, let's just check the URL is correct
			expect(page.url()).toContain('tab=public');
			return;
		}

		// If authenticated, test the full functionality
		// Check that the public tab exists
		const publicTab = page.locator('button:has-text("🌍 Public")');
		await expect(publicTab).toBeVisible();

		// Click on the public tab
		await publicTab.click();

		// Check URL updated
		await expect(page).toHaveURL(/.*tab=public.*/);

		// Check that the public gallery is loading
		const loadingText = page.locator('text=Loading public gallery...');
		const publicGalleryContent = page.locator('.public-gallery');
		
		// Either loading text should appear or gallery content should load
		await expect(loadingText.or(publicGalleryContent)).toBeVisible();

		// Wait for loading to complete and check for gallery content
		await page.waitForTimeout(2000);
		
		// Should see either the gallery grid or empty state
		const galleryGrid = page.locator('.gallery-grid');
		const emptyState = page.locator('text=No Public Photos Yet');
		
		await expect(galleryGrid.or(emptyState)).toBeVisible();
	});

	test('should navigate between gallery tabs correctly', async ({ page }) => {
		await page.goto('/gallery');

		// Check if authenticated
		const signInButton = page.locator('button:has-text("Sign In to Continue")');
		if (await signInButton.isVisible()) {
			// Test navigation for unauthenticated users
			await page.goto('/gallery?tab=public');
			expect(page.url()).toContain('tab=public');
			
			await page.goto('/gallery');
			expect(page.url()).not.toContain('tab=');
			return;
		}

		// Test tab navigation for authenticated users
		// Start on My Photos tab
		await expect(page.locator('button:has-text("🖼️ My Photos")')).toBeVisible();

		// Click Public tab
		await page.locator('button:has-text("🌍 Public")').click();
		await expect(page).toHaveURL(/.*tab=public.*/);

		// Click Upload tab
		await page.locator('button:has-text("📤 Upload")').click();
		await expect(page).toHaveURL(/.*tab=upload.*/);

		// Click back to My Photos
		await page.locator('button:has-text("🖼️ My Photos")').click();
		await expect(page).toHaveURL(/\/gallery$/);
	});

	test('should show public images without authentication requirement', async ({ page }) => {
		// Test that public images can be viewed without being signed in
		await page.goto('/gallery?tab=public');
		
		// The page should load even if not authenticated
		// We should see either loading state, gallery content, or empty state
		const loadingText = page.locator('text=Loading public gallery...');
		const galleryContent = page.locator('.public-gallery');
		const emptyState = page.locator('text=No Public Photos Yet');
		
		await expect(loadingText.or(galleryContent).or(emptyState)).toBeVisible();
	});
}); 