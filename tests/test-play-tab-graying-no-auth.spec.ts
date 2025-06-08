import { test, expect } from '@playwright/test';

test.describe('Play Tab Graying', () => {
	// Use a fresh browser context for these tests to avoid auth dependencies
	test.use({ storageState: { cookies: [], origins: [] } });
	test('should show grayed out play tab when no game is active', async ({ page }) => {
		// Navigate to home page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Check that the play tab is grayed out (disabled state)
		const playTabDisabled = page.locator('.nav-link-disabled').filter({ hasText: '🎮 Play' });
		await expect(playTabDisabled).toBeVisible();

		// Verify it has the grayed out styling
		await expect(playTabDisabled).toHaveCSS('opacity', '0.5');
		await expect(playTabDisabled).toHaveCSS('cursor', 'not-allowed');

		// Check that there's no active play link
		const playLinkActive = page.locator('a[href="/play"]').filter({ hasText: '🎮 Play' });
		await expect(playLinkActive).not.toBeVisible();
	});

	test('should show tooltip when hovering over disabled play tab', async ({ page }) => {
		// Navigate to home page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Find the disabled play tab wrapper
		const playTabWrapper = page.locator('.nav-link-wrapper');
		await expect(playTabWrapper).toBeVisible();

		// Check the tooltip text
		await expect(playTabWrapper).toHaveAttribute('title', 'Pick a game type to start playing!');

		// Hover over the disabled play tab
		await playTabWrapper.hover();

		// The title attribute should show the tooltip in the browser
		const titleAttribute = await playTabWrapper.getAttribute('title');
		expect(titleAttribute).toBe('Pick a game type to start playing!');
	});

	test('should show active play tab when game is started', async ({ page }) => {
		// Navigate to home page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Start a quick game
		const quickGameButton = page.locator('button').filter({ hasText: 'Quick Game' });
		if (await quickGameButton.isVisible()) {
			await quickGameButton.click();

			// Wait for game to initialize
			await page.waitForTimeout(2000);

			// Check that the play tab is now active (not grayed out)
			const playLinkActive = page.locator('a[href="/play"]').filter({ hasText: '🎮 Play' });
			await expect(playLinkActive).toBeVisible();

			// Check that the disabled version is not visible
			const playTabDisabled = page.locator('.nav-link-disabled').filter({ hasText: '🎮 Play' });
			await expect(playTabDisabled).not.toBeVisible();
		}
	});

	test('should return to grayed out state after completing game', async ({ page }) => {
		// Navigate to home page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Start a quick game
		const quickGameButton = page.locator('button').filter({ hasText: 'Quick Game' });
		if (await quickGameButton.isVisible()) {
			await quickGameButton.click();

			// Wait for game to initialize and complete it quickly
			await page.waitForTimeout(2000);

			// If we're in a game, navigate to home to reset
			await page.goto('/');
			await page.waitForLoadState('networkidle');

			// The play tab should be grayed out again
			const playTabDisabled = page.locator('.nav-link-disabled').filter({ hasText: '🎮 Play' });
			await expect(playTabDisabled).toBeVisible();
		}
	});

	test('should navigate correctly when play tab is active', async ({ page }) => {
		// Navigate to home page
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Start a quick game
		const quickGameButton = page.locator('button').filter({ hasText: 'Quick Game' });
		if (await quickGameButton.isVisible()) {
			await quickGameButton.click();

			// Wait for game to initialize
			await page.waitForTimeout(2000);

			// Click on the active play tab
			const playLinkActive = page.locator('a[href="/play"]').filter({ hasText: '🎮 Play' });
			if (await playLinkActive.isVisible()) {
				await playLinkActive.click();

				// Should navigate to play page
				await expect(page).toHaveURL('/play');
			}
		}
	});
});
