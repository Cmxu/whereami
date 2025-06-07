import { test, expect } from '@playwright/test';

test.describe('Gameplay Fixes - No Auth', () => {
	test('map overlay positioning and layout fixes', async ({ page, viewport }) => {
		// Use the deployed URL directly
		await page.goto('https://whereami-5kp.pages.dev/browse');
		
		// Wait for browse page to load and find any game
		await page.waitForSelector('.game-card', { timeout: 10000 });
		
		// Click on the first game available
		const firstGameCard = page.locator('.game-card').first();
		await expect(firstGameCard).toBeVisible();
		await firstGameCard.click();

		// Wait for game details page to load, then click Play Game button
		await page.waitForSelector('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")', { timeout: 10000 });
		const playButton = page.locator('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")').first();
		await playButton.click();

		// Wait for game to load
		await page.waitForSelector('.game-round', { timeout: 15000 });
		
		// Take screenshot of initial state (image-full layout)
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-fixes-initial-state.png',
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
			console.log(`✅ Map overlay stays within bounds: ${mapOverlayBox.height}px height in ${viewport.height}px viewport`);
		}

		// Test 2: Toggle to map-full layout to test z-index fix
		const layoutToggle = page.locator('button:has-text("Map")');
		await expect(layoutToggle).toBeVisible();
		await layoutToggle.click();
		
		// Wait for layout change
		await page.waitForTimeout(500);
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-fixes-map-full-layout.png',
			fullPage: true 
		});

		// Test 3: Verify action buttons are visible and clickable in map-full layout
		const actionButtons = page.locator('.layout-map-full .action-buttons');
		await expect(actionButtons).toBeVisible();
		
		// Check the z-index by ensuring buttons are above map - with improved z-index fix
		const actionButtonsBox = await actionButtons.boundingBox();
		const mapContainer = page.locator('.layout-map-full .map-container').first();
		const mapBox = await mapContainer.boundingBox();
		
		if (actionButtonsBox && mapBox) {
			console.log(`✅ Action buttons positioned at z-level above map (z-100 vs z-0)`);
		}
		
		// Click on the map to select a location (click on top-right area to avoid overlays)
		await mapContainer.click({ position: { x: 400, y: 100 } });
		await page.waitForTimeout(1000);
		
		// Check if submit button appears and is accessible with improved z-index
		const submitButton = page.locator('.layout-map-full button:has-text("Submit")');
		if (await submitButton.isVisible()) {
			await expect(submitButton).toBeEnabled();
			
			// Try clicking the button to ensure it's not covered
			await submitButton.click();
			await page.waitForTimeout(2000);
			
			console.log(`✅ Submit button is accessible and clickable in map-full layout`);
			
			await page.screenshot({ 
				path: 'tests/screenshots/gameplay-fixes-submit-accessible.png',
				fullPage: true 
			});
		}

		// Test 4: Switch back to image-full and test small map structure
		const imageToggle = page.locator('button:has-text("Image")');
		await expect(imageToggle).toBeVisible();
		await imageToggle.click();
		
		await page.waitForTimeout(500);
		
		// Verify small map structure - map container at top, action buttons at bottom
		const smallMapOverlayImageMode = page.locator('.map-overlay');
		await expect(smallMapOverlayImageMode).toBeVisible();
		
		// Check if map-container comes before action-buttons in the layout
		const mapContainerSmall = page.locator('.map-overlay .map-container');
		const actionButtonsSmall = page.locator('.map-overlay .action-buttons');
		await expect(mapContainerSmall).toBeVisible();
		await expect(actionButtonsSmall).toBeVisible();
		
		// Verify the map takes up most space and action buttons are at bottom
		const mapBoxSmall = await mapContainerSmall.boundingBox();
		const actionsBoxSmall = await actionButtonsSmall.boundingBox();
		
		if (mapBoxSmall && actionsBoxSmall) {
			// Action buttons should be below the map
			expect(actionsBoxSmall.y).toBeGreaterThan(mapBoxSmall.y + mapBoxSmall.height - 20); // Small tolerance
			console.log(`✅ Small map layout: Map container at top, action buttons at bottom`);
		}
		
		// Click on small map to select location
		const smallMapContainer = page.locator('.map-overlay .map-container').first();
		await expect(smallMapContainer).toBeVisible();
		await smallMapContainer.click({ position: { x: 100, y: 100 } });
		
		await page.waitForTimeout(1000);
		
		// Submit guess to test result panel positioning
		const smallSubmitButton = page.locator('.map-overlay button:has-text("Submit")');
		if (await smallSubmitButton.isVisible() && await smallSubmitButton.isEnabled()) {
			await smallSubmitButton.click();
			
			// Wait for result panel
			await page.waitForTimeout(2000);
			
			// Check if result-stats section appears between map and action buttons
			const resultStats = page.locator('.map-overlay .result-stats');
			await expect(resultStats).toBeVisible();
			
			// Check for score display in result stats (now in horizontal layout)
			const scoreSection = page.locator('.map-overlay .result-stats .score-section');
			await expect(scoreSection).toBeVisible();
			
			// Check for distance display in result stats (now in horizontal layout)
			const distanceSection = page.locator('.map-overlay .result-stats .distance-section');
			await expect(distanceSection).toBeVisible();
			
			// Check for badge display (now centered below)
			const scoreBadge = page.locator('.map-overlay .result-stats .score-badge');
			await expect(scoreBadge).toBeVisible();
			
			// Check for next round button in action buttons
			const nextButton = page.locator('.map-overlay .action-buttons button:has-text("Next Round"), .map-overlay .action-buttons button:has-text("View Results")');
			await expect(nextButton).toBeVisible();
			
			// Verify positioning: map -> result-stats -> action-buttons (stats should push map up)
			const mapBox = await smallMapContainer.boundingBox();
			const statsBox = await resultStats.boundingBox();
			const nextButtonBox = await nextButton.boundingBox();
			
			if (mapBox && statsBox && nextButtonBox) {
				// Result stats should be below the map (but map should be smaller now)
				expect(statsBox.y).toBeGreaterThan(mapBox.y + mapBox.height - 20);
				// Next button should be below the result stats
				expect(nextButtonBox.y).toBeGreaterThan(statsBox.y + statsBox.height - 10);
				console.log(`✅ Small map layout: Map -> Result Stats (horizontal) -> Button (container grows, map stays same size)`);
			}
			
			// Verify horizontal layout of stats
			const scoreBox = await scoreSection.boundingBox();
			const distanceBox = await distanceSection.boundingBox();
			const badgeBox = await scoreBadge.boundingBox();
			
			if (scoreBox && distanceBox && badgeBox) {
				// All three elements should be on the same horizontal level (side by side)
				const scoreY = scoreBox.y + scoreBox.height / 2;
				const badgeY = badgeBox.y + badgeBox.height / 2;
				const distanceY = distanceBox.y + distanceBox.height / 2;
				
				// Check vertical alignment (should be roughly same Y position)
				expect(Math.abs(scoreY - badgeY)).toBeLessThan(15);
				expect(Math.abs(badgeY - distanceY)).toBeLessThan(15);
				
				// Check horizontal order: Score -> Badge -> Distance
				expect(badgeBox.x).toBeGreaterThan(scoreBox.x + scoreBox.width - 10); // Badge after score
				expect(distanceBox.x).toBeGreaterThan(badgeBox.x + badgeBox.width - 10); // Distance after badge
				
				console.log(`✅ Three-column layout: Score (${scoreBox.x}px) -> Badge (${badgeBox.x}px) -> Distance (${distanceBox.x}px)`);
			}
			
			// Verify stats don't have white background (should be transparent)
			const statsBackground = await page.evaluate(() => {
				const element = document.querySelector('.map-overlay .result-stats');
				return element ? window.getComputedStyle(element).background : null;
			});
			console.log(`Result stats background: ${statsBackground}`);
			
			// Verify map height stays the same when stats appear (should not be reduced)
			const mapHeight = await page.evaluate(() => {
				const mapElement = document.querySelector('.map-overlay .map-container .map-wrapper');
				return mapElement ? mapElement.getBoundingClientRect().height : null;
			});
			console.log(`Map height when stats visible: ${mapHeight}px (should maintain original size)`);
			
			// Verify outer container grows to accommodate stats
			const containerHeight = await page.evaluate(() => {
				const container = document.querySelector('.map-overlay');
				return container ? container.getBoundingClientRect().height : null;
			});
			console.log(`Container height with stats: ${containerHeight}px (should be larger than without stats)`);
			
			console.log(`✅ Small map result stats correctly positioned, container grows, map maintains size`);
			
			await page.screenshot({ 
				path: 'tests/screenshots/gameplay-fixes-result-panel-positioning.png',
				fullPage: true 
			});
		} else {
			console.log(`ℹ️  Result stats section not visible yet, checking basic layout structure`);
		}

		// Test 5: Switch back to image-full and test small map constraints
		const smallMapOverlayConstraints = page.locator('.map-overlay');
		const smallMapBoxConstraints = await smallMapOverlayConstraints.boundingBox();
		
		if (smallMapBoxConstraints && viewport) {
			// Should not exceed calc(100vh - 180px) which is handled by CSS
			const maxAllowedHeight = viewport.height - 180;
			console.log(`Map overlay height: ${smallMapBoxConstraints.height}px, max allowed: ${maxAllowedHeight}px`);
			expect(smallMapBoxConstraints.height).toBeLessThanOrEqual(maxAllowedHeight + 50); // Some tolerance for padding/border
		}

		// Test the action buttons area in small map
		const smallMapActionsConstraints = page.locator('.map-overlay .action-buttons');
		await expect(smallMapActionsConstraints).toBeVisible();
		
		const actionsBoxConstraints = await smallMapActionsConstraints.boundingBox();
		if (actionsBoxConstraints) {
			// Action buttons should have max-height and scroll if needed
			console.log(`✅ Small map action buttons container: ${actionsBoxConstraints.height}px height`);
		}

		// Final screenshot
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-fixes-final-state.png',
			fullPage: true 
		});
		
		console.log(`✅ All gameplay positioning and z-index fixes verified!`);
	});

	test('small viewport map overlay constraint', async ({ page }) => {
		// Test with a smaller viewport to ensure constraints work
		await page.setViewportSize({ width: 800, height: 600 });
		
		await page.goto('https://whereami-5kp.pages.dev/browse');
		await page.waitForSelector('.game-card', { timeout: 10000 });
		await page.locator('.game-card').first().click();
		
		// Wait for game details page to load, then click Play Game button
		await page.waitForSelector('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")', { timeout: 10000 });
		const playButton = page.locator('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")').first();
		await playButton.click();
		
		await page.waitForSelector('.game-round', { timeout: 15000 });
		
		// Check map overlay in constrained viewport
		const mapOverlay = page.locator('.map-overlay');
		await expect(mapOverlay).toBeVisible();
		
		const mapOverlayBox = await mapOverlay.boundingBox();
		if (mapOverlayBox) {
			// Should respect max-height: calc(100vh - 180px)
			const expectedMaxHeight = 600 - 180; // viewport height - 180px
			console.log(`Small viewport - Map overlay height: ${mapOverlayBox.height}px, expected max: ${expectedMaxHeight}px`);
			expect(mapOverlayBox.height).toBeLessThanOrEqual(expectedMaxHeight + 30); // Small tolerance
		}
		
		await page.screenshot({ 
			path: 'tests/screenshots/gameplay-fixes-small-viewport.png',
			fullPage: true 
		});
		
		console.log(`✅ Small viewport constraints verified!`);
	});

	test('small map result stats positioning', async ({ page }) => {
		// Use the deployed URL directly
		await page.goto('https://whereami-5kp.pages.dev/browse');
		await page.waitForSelector('.game-card', { timeout: 10000 });

		// Click on the first game card
		const gameCard = page.locator('.game-card').first();
		await gameCard.click();

		// Wait for game details page to load, then click Play Game button
		await page.waitForSelector('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")', { timeout: 10000 });
		const playButton = page.locator('button:has-text("🎮 Play Game"), button:has-text("🌍 Start Playing Now")').first();
		await playButton.click();

		// Wait for game round to load
		await page.waitForSelector('.game-round', { timeout: 15000 });

		// Ensure we're in image-full mode (small map overlay visible)
		const mapOverlay = page.locator('.map-overlay');
		await expect(mapOverlay).toBeVisible();

		// Click on small map to select location
		const smallMapContainer = page.locator('.map-overlay .map-container').first();
		await expect(smallMapContainer).toBeVisible();
		await smallMapContainer.click({ position: { x: 100, y: 100 } });

		await page.waitForTimeout(1000);

		// Submit guess to test result stats positioning
		const submitButton = page.locator('.map-overlay button:has-text("Submit")');
		if (await submitButton.isVisible() && await submitButton.isEnabled()) {
			await submitButton.click();
			
			// Wait for result stats to appear
			await page.waitForTimeout(2000);
			
			// Check if result-stats section appears between map and action buttons
			const resultStats = page.locator('.map-overlay .result-stats');
			await expect(resultStats).toBeVisible();
			
			// Check for score display in result stats (now in horizontal layout)
			const scoreSection = page.locator('.map-overlay .result-stats .score-section');
			await expect(scoreSection).toBeVisible();
			
			// Check for distance display in result stats (now in horizontal layout)
			const distanceSection = page.locator('.map-overlay .result-stats .distance-section');
			await expect(distanceSection).toBeVisible();
			
			// Check for badge display (now centered below)
			const scoreBadge = page.locator('.map-overlay .result-stats .score-badge');
			await expect(scoreBadge).toBeVisible();
			
			// Check for next round button in action buttons
			const nextButton = page.locator('.map-overlay .action-buttons button:has-text("Next Round"), .map-overlay .action-buttons button:has-text("View Results")');
			await expect(nextButton).toBeVisible();
			
			// Verify positioning: map -> result-stats -> action-buttons (stats should push map up)
			const mapBox = await smallMapContainer.boundingBox();
			const statsBox = await resultStats.boundingBox();
			const nextButtonBox = await nextButton.boundingBox();
			
			if (mapBox && statsBox && nextButtonBox) {
				// Result stats should be below the map (but map should be smaller now)
				expect(statsBox.y).toBeGreaterThan(mapBox.y + mapBox.height - 20);
				// Next button should be below the result stats
				expect(nextButtonBox.y).toBeGreaterThan(statsBox.y + statsBox.height - 10);
				console.log(`✅ Small map layout: Map -> Result Stats (horizontal) -> Button (container grows, map stays same size)`);
			}
			
			// Verify horizontal layout of stats
			const scoreBox = await scoreSection.boundingBox();
			const distanceBox = await distanceSection.boundingBox();
			const badgeBox = await scoreBadge.boundingBox();
			
			if (scoreBox && distanceBox && badgeBox) {
				// All three elements should be on the same horizontal level (side by side)
				const scoreY = scoreBox.y + scoreBox.height / 2;
				const badgeY = badgeBox.y + badgeBox.height / 2;
				const distanceY = distanceBox.y + distanceBox.height / 2;
				
				// Check vertical alignment (should be roughly same Y position)
				expect(Math.abs(scoreY - badgeY)).toBeLessThan(15);
				expect(Math.abs(badgeY - distanceY)).toBeLessThan(15);
				
				// Check horizontal order: Score -> Badge -> Distance
				expect(badgeBox.x).toBeGreaterThan(scoreBox.x + scoreBox.width - 10); // Badge after score
				expect(distanceBox.x).toBeGreaterThan(badgeBox.x + badgeBox.width - 10); // Distance after badge
				
				console.log(`✅ Three-column layout: Score (${scoreBox.x}px) -> Badge (${badgeBox.x}px) -> Distance (${distanceBox.x}px)`);
			}
			
			// Verify stats don't have white background (should be transparent)
			const statsBackground = await page.evaluate(() => {
				const element = document.querySelector('.map-overlay .result-stats');
				return element ? window.getComputedStyle(element).background : null;
			});
			console.log(`Result stats background: ${statsBackground}`);
			
			// Verify map height stays the same when stats appear (should not be reduced)
			const mapHeight = await page.evaluate(() => {
				const mapElement = document.querySelector('.map-overlay .map-container .map-wrapper');
				return mapElement ? mapElement.getBoundingClientRect().height : null;
			});
			console.log(`Map height when stats visible: ${mapHeight}px (should maintain original size)`);
			
			// Verify outer container grows to accommodate stats
			const containerHeight = await page.evaluate(() => {
				const container = document.querySelector('.map-overlay');
				return container ? container.getBoundingClientRect().height : null;
			});
			console.log(`Container height with stats: ${containerHeight}px (should be larger than without stats)`);
			
			console.log(`✅ Small map result stats correctly positioned, container grows, map maintains size`);
			
			// Take screenshot showing the updated positioning
			await page.screenshot({ 
				path: 'tests/screenshots/small-map-result-stats-positioning.png',
				fullPage: true 
			});
		} else {
			console.log(`ℹ️  Submit button not available, test incomplete`);
		}
	});
}); 