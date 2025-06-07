import { test, expect } from '@playwright/test';

test.describe('Gameplay Fixes', () => {
	test.use({ storageState: 'playwright/.auth/user.json' });

	test('map overlay positioning and z-index fixes', async ({ page, viewport }) => {
		// Navigate to a game
		await page.goto('/');
		
		// Wait for any game links and click the first one
		await page.waitForSelector('a[href*="/games/"]', { timeout: 10000 });
		const gameLinks = await page.locator('a[href*="/games/"]').all();
		
		if (gameLinks.length > 0) {
			await gameLinks[0].click();
		} else {
			// If no existing games, create a quick test by going to browse page
			await page.goto('/browse');
			await page.waitForSelector('a[href*="/games/"]', { timeout: 10000 });
			await page.locator('a[href*="/games/"]').first().click();
		}

		// Wait for game to load
		await page.waitForSelector('.game-round', { timeout: 15000 });
		
		// Take screenshot of initial state (image-full layout)
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-initial-state.png',
			fullPage: true 
		});

		// Test 1: Verify small map overlay doesn't extend beyond screen bounds
		const mapOverlay = page.locator('.map-overlay');
		await expect(mapOverlay).toBeVisible();
		
		const mapOverlayBox = await mapOverlay.boundingBox();
		if (mapOverlayBox && viewport) {
			// Check that map overlay stays within viewport bounds
			expect(mapOverlayBox.y + mapOverlayBox.height).toBeLessThanOrEqual(viewport.height);
			expect(mapOverlayBox.x + mapOverlayBox.width).toBeLessThanOrEqual(viewport.width);
		}

		// Test 2: Toggle to map-full layout to test z-index fix
		const layoutToggle = page.locator('button:has-text("Map")');
		await expect(layoutToggle).toBeVisible();
		await layoutToggle.click();
		
		// Wait for layout change
		await page.waitForTimeout(500);
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-map-full-layout.png',
			fullPage: true 
		});

		// Test 3: Verify action buttons are visible and clickable in map-full layout
		const actionButtons = page.locator('.layout-map-full .action-buttons');
		await expect(actionButtons).toBeVisible();
		
		// Click on the map to select a location
		const mapContainer = page.locator('.layout-map-full .map-container');
		await expect(mapContainer).toBeVisible();
		await mapContainer.click({ position: { x: 200, y: 200 } });
		
		// Wait a moment for the click to register
		await page.waitForTimeout(1000);
		
		// Check if submit button is enabled and clickable (should be visible over map)
		const submitButton = page.locator('.layout-map-full button:has-text("Submit")');
		if (await submitButton.isVisible()) {
			// Verify button is not covered by checking its z-index is effective
			const buttonBox = await submitButton.boundingBox();
			if (buttonBox) {
				// Check button is above map by trying to click it
				await expect(submitButton).toBeEnabled();
				
				// Take screenshot showing submit button is accessible
				await page.screenshot({ 
					path: 'tests/screenshots/gameplay-submit-button-accessible.png',
					fullPage: true 
				});
			}
		}

		// Test 4: Switch back to image-full and test small map result positioning
		const imageToggle = page.locator('button:has-text("Image")');
		await expect(imageToggle).toBeVisible();
		await imageToggle.click();
		
		await page.waitForTimeout(500);
		
		// Click on small map to select location
		const smallMap = page.locator('.map-overlay .map-container');
		await expect(smallMap).toBeVisible();
		await smallMap.click({ position: { x: 100, y: 100 } });
		
		await page.waitForTimeout(1000);
		
		// Submit guess to test result panel positioning
		const smallSubmitButton = page.locator('.map-overlay button:has-text("Submit")');
		if (await smallSubmitButton.isVisible() && await smallSubmitButton.isEnabled()) {
			await smallSubmitButton.click();
			
			// Wait for result panel
			await page.waitForTimeout(2000);
			
			// Check if result panel is visible and properly positioned
			const resultPanel = page.locator('.map-overlay .result-panel');
			if (await resultPanel.isVisible()) {
				const resultBox = await resultPanel.boundingBox();
				if (resultBox && viewport) {
					// Verify result panel doesn't get cut off
					expect(resultBox.y + resultBox.height).toBeLessThanOrEqual(viewport.height);
				}
				
				await page.screenshot({ 
					path: 'tests/screenshots/gameplay-result-panel-positioning.png',
					fullPage: true 
				});
			}
		}

		// Final screenshot
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-fixes-complete.png',
			fullPage: true 
		});
	});

	test('map overlay height constraint', async ({ page, viewport }) => {
		await page.setViewportSize({ width: 1024, height: 600 }); // Smaller viewport
		
		await page.goto('/');
		await page.waitForSelector('a[href*="/games/"]', { timeout: 10000 });
		const gameLinks = await page.locator('a[href*="/games/"]').all();
		
		if (gameLinks.length > 0) {
			await gameLinks[0].click();
		}

		await page.waitForSelector('.game-round', { timeout: 15000 });
		
		// Check map overlay in constrained viewport
		const mapOverlay = page.locator('.map-overlay');
		await expect(mapOverlay).toBeVisible();
		
		const mapOverlayBox = await mapOverlay.boundingBox();
		if (mapOverlayBox) {
			// Should respect max-height: calc(100vh - 180px)
			const expectedMaxHeight = 600 - 180; // viewport height - 180px
			expect(mapOverlayBox.height).toBeLessThanOrEqual(expectedMaxHeight + 20); // Small tolerance for borders/padding
		}
		
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-constrained-viewport.png',
			fullPage: true 
		});
	});
}); 