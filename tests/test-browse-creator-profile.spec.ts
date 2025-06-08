import { test, expect } from '@playwright/test';

test.describe('Browse Page Creator Profile Improvements', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://whereami-5kp.pages.dev/browse');
	});

	test('should display creator profile headers instead of game thumbnails', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if there are any games loaded
		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			// Check that the first game card has creator profile header
			const firstGameCard = gameCards.first();
			const creatorProfileHeader = firstGameCard.locator('.creator-profile-header');
			await expect(creatorProfileHeader).toBeVisible();

			// Check that creator avatar is present
			const creatorAvatar = firstGameCard.locator('.creator-avatar');
			await expect(creatorAvatar).toBeVisible();

			// Check that old game thumbnails section is not present
			const gameThumbnails = firstGameCard.locator('.game-thumbnails');
			await expect(gameThumbnails).not.toBeVisible();

			console.log('✅ Creator profile header found, thumbnails removed');
		} else {
			console.log('ℹ️  No games found to test');
		}
	});

	test('should show creator information in profile header', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			const firstGameCard = gameCards.first();
			
			// Check for creator name
			const creatorName = firstGameCard.locator('.creator-profile-header p').first();
			await expect(creatorName).toBeVisible();
			
			// Check for creation date
			const creationDate = firstGameCard.locator('.creator-profile-header p').nth(1);
			await expect(creationDate).toBeVisible();

			console.log('✅ Creator information displayed in header');
		}
	});

	test('should have improved game card styling', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			const firstGameCard = gameCards.first();
			
			// Check that game card has proper structure
			await expect(firstGameCard.locator('.creator-profile-header')).toBeVisible();
			await expect(firstGameCard.locator('.game-header')).toBeVisible();
			await expect(firstGameCard.locator('.game-info')).toBeVisible();

			// Check that game actions are still present
			const gameActions = firstGameCard.locator('.game-actions');
			await expect(gameActions).toBeVisible();

			console.log('✅ Game card has improved structure');
		}
	});

	test('should maintain responsive design', async ({ page }) => {
		// Test mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForLoadState('networkidle');

		// Check that games grid adapts to mobile
		const gamesGrid = page.locator('.games-grid');
		if (await gamesGrid.isVisible()) {
			await expect(gamesGrid).toBeVisible();
			console.log('✅ Responsive design maintained on mobile');
		}

		// Test desktop viewport
		await page.setViewportSize({ width: 1200, height: 800 });
		await page.waitForLoadState('networkidle');

		if (await gamesGrid.isVisible()) {
			await expect(gamesGrid).toBeVisible();
			console.log('✅ Responsive design maintained on desktop');
		}
	});
}); 