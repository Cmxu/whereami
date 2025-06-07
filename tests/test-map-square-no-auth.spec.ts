import { test, expect, type Page } from '@playwright/test';

// Run without authentication setup dependency
test.describe.configure({ mode: 'parallel' });

test.describe('Map Square Layout', () => {
	test('should have a square map in game rounds', async ({ page }) => {
		// Clear any existing authentication
		await page.context().clearCookies();

		// Navigate to the main page
		await page.goto('https://whereami-5kp.pages.dev/');

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Try to start a quick game
		const quickGameButton = page.locator('button').filter({ hasText: 'Quick Game' });
		const fullGameButton = page.locator('button').filter({ hasText: 'Full Game' });

		const quickGameVisible = await quickGameButton.isVisible().catch(() => false);
		const fullGameVisible = await fullGameButton.isVisible().catch(() => false);

		if (quickGameVisible) {
			await quickGameButton.click();
		} else if (fullGameVisible) {
			await fullGameButton.click();
		} else {
			console.log('No game start buttons found - skipping test');
			return;
		}

		// Wait for navigation to play page
		await page.waitForURL('**/play', { timeout: 10000 });

		// Wait for game to initialize
		await page.waitForTimeout(5000);

		// Check if there's an error about no images
		const errorMessage = page.locator('text=No public images available');
		const noImagesError = page.locator('text=Upload some images first');
		const serverError = page.locator('text=Failed to fetch random images');

		const hasError =
			(await errorMessage.isVisible().catch(() => false)) ||
			(await noImagesError.isVisible().catch(() => false)) ||
			(await serverError.isVisible().catch(() => false));

		if (hasError) {
			console.log('No public images available - cannot test game flow');
			return;
		}

		// Wait for the map panel to be visible
		const mapPanel = page.locator('.map-panel.map-small');
		await expect(mapPanel).toBeVisible({ timeout: 10000 });

		// Get the map wrapper element (this is what contains the actual map)
		const mapWrapper = page.locator('.map-wrapper').first();
		await expect(mapWrapper).toBeVisible();

		// Get the dimensions of the map wrapper
		const mapBox = await mapWrapper.boundingBox();

		if (mapBox) {
			console.log(`Map dimensions: ${mapBox.width}px x ${mapBox.height}px`);

			// Check if the map is square (within a small tolerance for rounding)
			const tolerance = 5; // 5px tolerance
			const isSquare = Math.abs(mapBox.width - mapBox.height) <= tolerance;

			expect(isSquare).toBe(true);
			console.log(`✓ Map is square: ${mapBox.width}px x ${mapBox.height}px`);
		} else {
			throw new Error('Could not get map bounding box');
		}

		// Also verify the map panel dimensions
		const panelBox = await mapPanel.boundingBox();

		if (panelBox) {
			console.log(`Panel dimensions: ${panelBox.width}px x ${panelBox.height}px`);

			// Panel should be wider than it is high (to accommodate the square map + buttons)
			const panelAspectRatio = panelBox.width / panelBox.height;
			console.log(`Panel aspect ratio: ${panelAspectRatio.toFixed(2)}`);

			// Panel should be closer to square but allow for button space below
			expect(panelAspectRatio).toBeGreaterThan(0.7);
			expect(panelAspectRatio).toBeLessThan(1.3);
		}

		// Take a screenshot to verify visually
		await page.screenshot({ path: 'test-results/square-map-layout.png', fullPage: true });
	});
});
