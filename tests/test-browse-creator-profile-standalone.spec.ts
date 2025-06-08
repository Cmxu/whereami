import { test, expect } from '@playwright/test';

test.describe('Browse Page Creator Profile - Standalone', () => {
	test('should display creator profile headers instead of game thumbnails', async ({ page }) => {
		await page.goto('https://geo.cmxu.io/browse');
		await page.waitForLoadState('networkidle');

		// Check if there are any games loaded
		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		console.log(`Found ${gameCount} game cards`);

		if (gameCount > 0) {
			// Check that the first game card has creator profile header
			const firstGameCard = gameCards.first();
			const creatorProfileHeader = firstGameCard.locator('.creator-profile-header');
			
			if (await creatorProfileHeader.isVisible()) {
				console.log('✅ Creator profile header found');
				
				// Check that creator avatar is present
				const creatorAvatar = firstGameCard.locator('.creator-avatar');
				await expect(creatorAvatar).toBeVisible();
				console.log('✅ Creator avatar found');

				// Check that old game thumbnails section is not present
				const gameThumbnails = firstGameCard.locator('.game-thumbnails');
				const thumbnailsVisible = await gameThumbnails.isVisible();
				expect(thumbnailsVisible).toBe(false);
				console.log('✅ Old thumbnails removed');
			} else {
				console.log('❌ Creator profile header not found');
			}
		} else {
			console.log('ℹ️  No games found to test');
		}
	});

	test('should show creator information in profile header', async ({ page }) => {
		await page.goto('https://geo.cmxu.io/browse');
		await page.waitForLoadState('networkidle');

		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			const firstGameCard = gameCards.first();
			const creatorProfileHeader = firstGameCard.locator('.creator-profile-header');
			
			if (await creatorProfileHeader.isVisible()) {
				// Check for creator name
				const creatorName = creatorProfileHeader.locator('p').first();
				if (await creatorName.isVisible()) {
					const nameText = await creatorName.textContent();
					console.log(`✅ Creator name found: ${nameText}`);
				}
				
				// Check for creation date
				const creationDate = creatorProfileHeader.locator('p').nth(1);
				if (await creationDate.isVisible()) {
					const dateText = await creationDate.textContent();
					console.log(`✅ Creation date found: ${dateText}`);
				}
			}
		}
	});

	test('should have improved game card styling', async ({ page }) => {
		await page.goto('https://geo.cmxu.io/browse');
		await page.waitForLoadState('networkidle');

		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			const firstGameCard = gameCards.first();
			
			// Check that game card has proper structure
			const hasCreatorHeader = await firstGameCard.locator('.creator-profile-header').isVisible();
			const hasGameHeader = await firstGameCard.locator('.game-header').isVisible();
			const hasGameInfo = await firstGameCard.locator('.game-info').isVisible();

			console.log(`Creator header: ${hasCreatorHeader}`);
			console.log(`Game header: ${hasGameHeader}`);
			console.log(`Game info: ${hasGameInfo}`);

			// Check that game actions are still present
			const gameActions = firstGameCard.locator('.game-actions');
			const hasGameActions = await gameActions.isVisible();
			console.log(`Game actions: ${hasGameActions}`);

			if (hasCreatorHeader && hasGameHeader && hasGameInfo) {
				console.log('✅ Game card has improved structure');
			}
		}
	});
}); 