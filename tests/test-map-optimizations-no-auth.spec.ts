import { test, expect } from '@playwright/test';

// Skip authentication for these tests
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Map Optimizations - Standalone', () => {
	test('should have removed leaflet attribution from maps', async ({ page }) => {
		// Navigate to browse page (public, no auth required)
		await page.goto('/browse');

		// Wait for page to load
		await page.waitForTimeout(3000);

		// Look for any leaflet controls on the page
		const attributionControls = page.locator('.leaflet-control-attribution');
		const attributionCount = await attributionControls.count();

		console.log(`Found ${attributionCount} attribution controls on browse page`);

		// Should have no attribution controls
		expect(attributionCount).toBe(0);

		console.log('✅ No Leaflet attribution controls found on browse page');
	});

	test('should have transparent background on map wrappers', async ({ page }) => {
		// Navigate to browse page
		await page.goto('/browse');
		await page.waitForTimeout(2000);

		// Check for map wrappers
		const mapWrappers = page.locator('.map-wrapper');
		const wrapperCount = await mapWrappers.count();

		console.log(`Found ${wrapperCount} map wrappers`);

		if (wrapperCount > 0) {
			// Check the first map wrapper
			const firstWrapper = mapWrappers.first();
			await expect(firstWrapper).toBeVisible();

			const bgColor = await firstWrapper.evaluate((el) => {
				return getComputedStyle(el).backgroundColor;
			});

			console.log('Map wrapper background color:', bgColor);

			// Should be transparent (rgba(0, 0, 0, 0))
			expect(bgColor).toBe('rgba(0, 0, 0, 0)');

			console.log('✅ Map wrapper has transparent background');
		} else {
			console.log('ℹ️  No map wrappers found on this page');
		}
	});

	test('should start a game and verify map optimizations', async ({ page }) => {
		// Navigate to browse page
		await page.goto('/browse');
		await page.waitForTimeout(3000);

		// Look for any available game cards
		const gameCards = page.locator('.game-card');
		const cardCount = await gameCards.count();

		console.log(`Found ${cardCount} game cards`);

		if (cardCount > 0) {
			// Click the first available game
			await gameCards.first().click();

			// Wait for game to load
			await page.waitForSelector('.map-container, .leaflet-container', { timeout: 15000 });

			// Check for attribution controls in the game
			const gameAttributions = page.locator('.leaflet-control-attribution');
			const gameAttributionCount = await gameAttributions.count();

			console.log(`Found ${gameAttributionCount} attribution controls in game`);
			expect(gameAttributionCount).toBe(0);

			// Check for leaflet containers (maps)
			const leafletContainers = page.locator('.leaflet-container');
			const leafletCount = await leafletContainers.count();

			console.log(`Found ${leafletCount} leaflet containers in game`);

			if (leafletCount > 0) {
				// Verify map is interactive
				await expect(leafletContainers.first()).toBeVisible();

				console.log('✅ Game map loaded successfully without attribution');
			}

			// Check for map-small styling if visible
			const mapSmall = page.locator('.map-small');
			if (await mapSmall.isVisible()) {
				const dimensions = await mapSmall.evaluate((el) => {
					const style = getComputedStyle(el);
					return {
						width: style.width,
						height: style.height
					};
				});

				console.log('Small map dimensions:', dimensions);

				// Verify improved dimensions (400x300 instead of 350x250)
				expect(dimensions.width).toBe('400px');
				expect(dimensions.height).toBe('300px');

				console.log('✅ Small map has improved dimensions');
			}
		} else {
			console.log('ℹ️  No game cards found, skipping game test');
		}
	});

	test('should verify new map optimization features', async ({ page }) => {
		// Navigate to browse page and start a game
		await page.goto('/browse');
		await page.waitForTimeout(3000);

		const gameCards = page.locator('.game-card');
		const cardCount = await gameCards.count();

		if (cardCount > 0) {
			await gameCards.first().click();
			await page.waitForSelector('.map-container', { timeout: 15000 });

			// Test 1: Check expand button position and styling
			const expandButton = page.locator('.map-toggle-btn');
			await expect(expandButton).toBeVisible();

			// Verify button is in top-left position
			const buttonBox = await expandButton.boundingBox();
			const mapBox = await page.locator('.map-small').boundingBox();

			if (buttonBox && mapBox) {
				// Button should be near top-left of map
				expect(buttonBox.x).toBeLessThan(mapBox.x + 50);
				expect(buttonBox.y).toBeLessThan(mapBox.y + 50);
				console.log('✅ Expand button positioned in top-left');
			}

			// Test 2: Check expand icon
			const expandIcon = await expandButton.textContent();
			expect(expandIcon?.trim()).toBe('↗');
			console.log('✅ Expand button shows correct icon (↗)');

			// Test 3: Check if resize handle exists for small map
			const resizeHandle = page.locator('.resize-handle');
			await expect(resizeHandle).toBeVisible();
			console.log('✅ Resize handle is visible on small map');

			// Test 4: Test map expansion
			await expandButton.click();
			await page.waitForTimeout(500); // Wait for animation

			// Verify map is now expanded
			const expandedMap = page.locator('.map-main');
			await expect(expandedMap).toBeVisible();
			console.log('✅ Map expands correctly');

			// Check contract icon
			const contractIcon = await expandButton.textContent();
			expect(contractIcon?.trim()).toBe('↙');
			console.log('✅ Contract button shows correct icon (↙)');

			// Test 5: Check if image overlay appears in expanded mode
			const imageOverlay = page.locator('.image-overlay');
			await expect(imageOverlay).toBeVisible();
			console.log('✅ Image overlay appears in expanded map mode');

			// Test 6: Contract the map back
			await expandButton.click();
			await page.waitForTimeout(500);

			// Verify map is back to small mode
			const smallMap = page.locator('.map-small');
			await expect(smallMap).toBeVisible();

			// Resize handle should be visible again
			await expect(resizeHandle).toBeVisible();
			console.log('✅ Map contracts back to small mode with resize handle');

			// Take screenshot for verification
			await page.screenshot({ path: 'test-results/map-optimizations.png', fullPage: true });
		}
	});
});
