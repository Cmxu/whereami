import { test, expect } from '@playwright/test';

test.describe('Satellite Toggle Feature - No Auth', () => {
	test('should show satellite toggle button on map in browse page', async ({ page }) => {
		// Navigate to the browse page which has the map and doesn't require auth
		await page.goto('/browse');
		
		// Wait for page to load and game cards to appear
		await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10000 });
		
		// Click on the first game to open the map
		const firstGameCard = page.locator('.game-card').first();
		await firstGameCard.click();
		
		// Wait for the game modal/popup to open with the map
		await expect(page.locator('.map-container')).toBeVisible({ timeout: 10000 });
		
		// Wait for the satellite toggle to appear
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });
		
		// Verify initial state shows "Satellite" button
		const toggleBtn = page.locator('.satellite-toggle-btn');
		await expect(toggleBtn).toContainText('Satellite');
		
		// Verify the button has proper styling and positioning
		const buttonBox = await toggleBtn.boundingBox();
		expect(buttonBox).toBeTruthy();
		expect(buttonBox!.x).toBeGreaterThan(0); // Should be positioned from left
		expect(buttonBox!.y).toBeGreaterThan(0); // Should be positioned from top
	});

	test('should toggle between satellite and street view in browse page', async ({ page }) => {
		// Navigate to the browse page
		await page.goto('/browse');
		
		// Wait for game cards and click the first one
		await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10000 });
		const firstGameCard = page.locator('.game-card').first();
		await firstGameCard.click();
		
		// Wait for the map and satellite toggle
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });
		
		const toggleBtn = page.locator('.satellite-toggle-btn');
		
		// Initial state should be "Satellite" (outdoor mode)
		await expect(toggleBtn).toContainText('Satellite');
		
		// Click to switch to satellite mode
		await toggleBtn.click();
		
		// Wait a moment for the transition
		await page.waitForTimeout(2000);
		
		// Now it should show "Street" button (indicating we're in satellite mode)
		await expect(toggleBtn).toContainText('Street');
		
		// Click again to switch back to street/outdoor mode
		await toggleBtn.click();
		
		// Wait for transition
		await page.waitForTimeout(2000);
		
		// Should be back to "Satellite" button
		await expect(toggleBtn).toContainText('Satellite');
	});

	test('should maintain toggle functionality during map interaction', async ({ page }) => {
		// Navigate to the browse page
		await page.goto('/browse');
		
		// Wait for game cards and click the first one
		await expect(page.locator('.game-card').first()).toBeVisible({ timeout: 10000 });
		const firstGameCard = page.locator('.game-card').first();
		await firstGameCard.click();
		
		// Wait for the map and satellite toggle
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });
		
		const toggleBtn = page.locator('.satellite-toggle-btn');
		
		// Switch to satellite mode
		await toggleBtn.click();
		await page.waitForTimeout(2000);
		await expect(toggleBtn).toContainText('Street');
		
		// Interact with the map (try to zoom using the zoom controls)
		const zoomInBtn = page.locator('.leaflet-control-zoom-in');
		if (await zoomInBtn.isVisible()) {
			await zoomInBtn.click();
			await page.waitForTimeout(1000);
		}
		
		// Toggle button should still show "Street" (satellite mode active)
		await expect(toggleBtn).toContainText('Street');
		
		// Switch back and verify
		await toggleBtn.click();
		await page.waitForTimeout(2000);
		await expect(toggleBtn).toContainText('Satellite');
	});
}); 