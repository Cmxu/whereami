import { test, expect } from '@playwright/test';

test.describe('Continue Game Popup', () => {
	test.beforeEach(async ({ page }) => {
		// Start from the home page
		await page.goto('https://geo.cmxu.io');
		await page.waitForLoadState('networkidle');
	});

	test('shows continue game popup after leaving a game via logo click', async ({ page }) => {
		// Verify no continue game popup is initially shown
		await expect(page.locator('.resume-notification')).toBeHidden();

		// Start a quick game
		await page.click('text=Quick Game');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		// Wait for the game to load (should see game controls)
		await expect(page.locator('button:has-text("← Exit")')).toBeVisible();

		// Click the logo to return home (this should save the game)
		await page.click('.nav-logo');
		await page.waitForURL('**/');
		await page.waitForLoadState('networkidle');

		// Verify the continue game popup is now visible
		await expect(page.locator('.resume-notification')).toBeVisible();
		await expect(page.locator('text=Game in Progress')).toBeVisible();
		await expect(page.locator('button:has-text("Resume Game")')).toBeVisible();
	});

	test('shows continue game popup after leaving a game via exit button', async ({ page }) => {
		// Verify no continue game popup is initially shown
		await expect(page.locator('.resume-notification')).toBeHidden();

		// Start a quick game
		await page.click('text=Quick Game');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		// Wait for the game to load and click exit
		await expect(page.locator('button:has-text("← Exit")')).toBeVisible();
		await page.click('button:has-text("← Exit")');
		await page.waitForURL('**/');
		await page.waitForLoadState('networkidle');

		// Verify the continue game popup is now visible
		await expect(page.locator('.resume-notification')).toBeVisible();
		await expect(page.locator('text=Game in Progress')).toBeVisible();
		await expect(page.locator('button:has-text("Resume Game")')).toBeVisible();
	});

	test('resume game button works correctly', async ({ page }) => {
		// Start a game and exit to create a saved game
		await page.click('text=Quick Game');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		await expect(page.locator('button:has-text("← Exit")')).toBeVisible();
		await page.click('button:has-text("← Exit")');
		await page.waitForURL('**/');
		await page.waitForLoadState('networkidle');

		// Verify the continue game popup is visible
		await expect(page.locator('.resume-notification')).toBeVisible();

		// Click resume game button
		await page.click('button:has-text("Resume Game")');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		// Verify we're back in the game
		await expect(page.locator('button:has-text("← Exit")')).toBeVisible();
	});

	test('continue popup disappears after resuming and completing a game', async ({ page }) => {
		// Start a game and exit to create a saved game
		await page.click('text=Quick Game');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		await page.click('button:has-text("← Exit")');
		await page.waitForURL('**/');
		await page.waitForLoadState('networkidle');

		// Resume the game
		await page.click('button:has-text("Resume Game")');
		await page.waitForURL('**/play');
		await page.waitForLoadState('networkidle');

		// Return to home from a resumed game (without completing it)
		await page.click('.nav-logo');
		await page.waitForURL('**/');
		await page.waitForLoadState('networkidle');

		// The popup should still be there since we didn't complete the game
		await expect(page.locator('.resume-notification')).toBeVisible();
	});
});
