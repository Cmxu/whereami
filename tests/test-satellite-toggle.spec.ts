import { test, expect } from '@playwright/test';

test.describe('Satellite Toggle Feature', () => {
	test('should show satellite toggle button on map', async ({ page }) => {
		// Navigate to the create page which has the map
		await page.goto('/create');

		// Wait for page to load
		await expect(page.locator('h1')).toContainText('Create Geography Game');

		// Wait for the map to be ready and satellite toggle to appear
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });

		// Verify initial state shows "Satellite" button
		const toggleBtn = page.locator('.satellite-toggle-btn');
		await expect(toggleBtn).toContainText('Satellite');

		// Verify the button has proper styling
		const buttonBox = await toggleBtn.boundingBox();
		expect(buttonBox).toBeTruthy();
		expect(buttonBox!.x).toBeGreaterThan(0); // Should be positioned from left
		expect(buttonBox!.y).toBeGreaterThan(0); // Should be positioned from top
	});

	test('should toggle between satellite and street view', async ({ page }) => {
		// Navigate to the create page
		await page.goto('/create');

		// Wait for the map to be ready
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });

		const toggleBtn = page.locator('.satellite-toggle-btn');

		// Initial state should be "Satellite" (outdoor mode)
		await expect(toggleBtn).toContainText('Satellite');

		// Click to switch to satellite mode
		await toggleBtn.click();

		// Wait a moment for the transition
		await page.waitForTimeout(1000);

		// Now it should show "Street" button (indicating we're in satellite mode)
		await expect(toggleBtn).toContainText('Street');

		// Click again to switch back to street/outdoor mode
		await toggleBtn.click();

		// Wait for transition
		await page.waitForTimeout(1000);

		// Should be back to "Satellite" button
		await expect(toggleBtn).toContainText('Satellite');
	});

	test('should maintain toggle state during interaction', async ({ page }) => {
		// Navigate to the create page
		await page.goto('/create');

		// Wait for the map to be ready
		await expect(page.locator('.satellite-toggle-btn')).toBeVisible({ timeout: 10000 });

		const toggleBtn = page.locator('.satellite-toggle-btn');

		// Switch to satellite mode
		await toggleBtn.click();
		await page.waitForTimeout(1000);
		await expect(toggleBtn).toContainText('Street');

		// Interact with the map (zoom or pan)
		const mapContainer = page.locator('.map-container').first();
		await mapContainer.click({ position: { x: 200, y: 200 } });

		// Wait for any map updates
		await page.waitForTimeout(500);

		// Toggle button should still show "Street" (satellite mode active)
		await expect(toggleBtn).toContainText('Street');

		// Switch back and verify
		await toggleBtn.click();
		await page.waitForTimeout(1000);
		await expect(toggleBtn).toContainText('Satellite');
	});
});
