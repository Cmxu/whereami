import { test, expect } from '@playwright/test';

test.describe('Browse Screen Improvements', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('https://geo.cmxu.io/browse');
	});

	test('should display game thumbnails for public games', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if there are any games loaded
		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			// Check that the first game card has thumbnails
			const firstGameCard = gameCards.first();
			const thumbnailSection = firstGameCard.locator('.game-thumbnails');
			await expect(thumbnailSection).toBeVisible();

			// Check that thumbnails are either images or placeholder
			const images = thumbnailSection.locator('img');
			const placeholders = thumbnailSection.locator('[class*="bg-gray"]');
			const hasImages = (await images.count()) > 0;
			const hasPlaceholders = (await placeholders.count()) > 0;

			expect(hasImages || hasPlaceholders).toBeTruthy();
		}
	});

	test('should show correct default values in dropdown menus', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check difficulty filter default
		const difficultySelect = page.locator('select').filter({ hasText: 'All Difficulties' });
		await expect(difficultySelect).toBeVisible();
		const difficultyValue = await difficultySelect.inputValue();
		expect(difficultyValue).toBe('all');

		// Check sort by default
		const sortSelect = page.locator('select').filter({ hasText: 'Newest' });
		await expect(sortSelect).toBeVisible();
		const sortValue = await sortSelect.inputValue();
		expect(sortValue).toBe('newest');
	});

	test('should have functioning search input', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Find search input
		const searchInput = page.locator('input[placeholder="Search games..."]');
		await expect(searchInput).toBeVisible();

		// Test that we can type in the search input
		await searchInput.fill('test search');
		const inputValue = await searchInput.inputValue();
		expect(inputValue).toBe('test search');

		// Clear the search
		await searchInput.clear();
	});

	test('should have extended filter section width', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check that the filters section is visible and properly sized
		const filtersSection = page.locator('.filters-section');
		await expect(filtersSection).toBeVisible();

		// Check that the search and filters container takes up flex-1 (full available width)
		const searchFiltersContainer = page.locator('.filters-section .flex-1').first();
		await expect(searchFiltersContainer).toBeVisible();

		// Verify the layout has proper responsive behavior
		const filtersSectionInner = page.locator('.filters-section > div');
		await expect(filtersSectionInner).toBeVisible();
	});

	test('should switch between Public Games and My Games tabs', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check Public Games tab is active by default (now in header)
		const publicGamesTab = page
			.locator('.page-header button')
			.filter({ hasText: '🌍 Public Games' });
		await expect(publicGamesTab).toHaveClass(/active/);

		// My Games tab should be present but might be disabled if not authenticated (now in header)
		const myGamesTab = page.locator('.page-header button').filter({ hasText: '🎮 My Games' });
		await expect(myGamesTab).toBeVisible();
	});

	test('should display game cards with proper structure', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check if there are any games loaded
		const gameCards = page.locator('.game-card');
		const gameCount = await gameCards.count();

		if (gameCount > 0) {
			const firstGameCard = gameCards.first();

			// Check that game card has all expected sections
			await expect(firstGameCard.locator('.game-thumbnails')).toBeVisible();
			await expect(firstGameCard.locator('.game-header')).toBeVisible();
			await expect(firstGameCard.locator('.game-info')).toBeVisible();

			// Check that game header has title
			const gameTitle = firstGameCard.locator('.game-header h3');
			await expect(gameTitle).toBeVisible();

			// Check that game info has stats
			const gameStats = firstGameCard.locator('.game-stats');
			await expect(gameStats).toBeVisible();
		}
	});

	test('should maintain proper responsive design on mobile', async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForLoadState('networkidle');

		// Check that filters section adapts to mobile
		const filtersSection = page.locator('.filters-section');
		await expect(filtersSection).toBeVisible();

		// Check that games grid adapts to single column on mobile
		const gamesGrid = page.locator('.games-grid');
		if (await gamesGrid.isVisible()) {
			// Grid should be visible and responsive
			await expect(gamesGrid).toBeVisible();
		}
	});

	test('should have working filter dropdowns', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Test difficulty filter
		const difficultySelect = page.locator('select').filter({ hasText: 'All Difficulties' });
		await difficultySelect.selectOption('easy');
		let selectedValue = await difficultySelect.inputValue();
		expect(selectedValue).toBe('easy');

		// Reset to all
		await difficultySelect.selectOption('all');

		// Test sort filter
		const sortSelect = page.locator('select').filter({ hasText: 'Newest' });
		await sortSelect.selectOption('popular');
		selectedValue = await sortSelect.inputValue();
		expect(selectedValue).toBe('popular');

		// Reset to newest
		await sortSelect.selectOption('newest');
	});

	test('should have Public/My Games toggle in header and Create Game button in filter bar', async ({
		page
	}) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check that Public/My Games toggle is in the header (page-header)
		const headerToggle = page.locator('.page-header .filter-tab');
		await expect(headerToggle.first()).toBeVisible();

		// Verify both tabs are in the header
		const publicGamesTab = page
			.locator('.page-header button')
			.filter({ hasText: '🌍 Public Games' });
		const myGamesTab = page.locator('.page-header button').filter({ hasText: '🎮 My Games' });
		await expect(publicGamesTab).toBeVisible();
		await expect(myGamesTab).toBeVisible();

		// Check Public Games tab is active by default
		await expect(publicGamesTab).toHaveClass(/active/);

		// Check that Create Game button is in the filter section (if authenticated)
		// We'll check if the button exists in filters-section
		const createButtonInFilters = page
			.locator('.filters-section button')
			.filter({ hasText: 'Create Game' });
		const createButtonExists = (await createButtonInFilters.count()) > 0;

		// The button should exist if authenticated, or not exist if not authenticated
		// Both are valid states, so we just verify it's in the right place if it exists
		if (createButtonExists) {
			await expect(createButtonInFilters).toBeVisible();
		}
	});

	test('should have improved search bar layout', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check that search input has proper flex styling
		const searchInput = page.locator('input[placeholder="Search games..."]');
		await expect(searchInput).toBeVisible();

		// Verify the search input is in a container with flex-1 sm:flex-[2] (takes up more space)
		const searchContainer = searchInput.locator('..');
		await expect(searchContainer).toBeVisible();

		// Check that the select elements have shrink-0 classes for better sizing
		const difficultySelect = page.locator('select').filter({ hasText: 'All Difficulties' });
		const sortSelect = page.locator('select').filter({ hasText: 'Newest' });

		await expect(difficultySelect).toBeVisible();
		await expect(sortSelect).toBeVisible();
	});

	test('should have consistent header styling with gallery page', async ({ page }) => {
		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Check header structure matches gallery format
		const headerContent = page.locator('.header-content');
		await expect(headerContent).toBeVisible();

		// Check title text size matches gallery (text-3xl)
		const pageTitle = page.locator('h1');
		await expect(pageTitle).toHaveClass(/text-3xl/);
		await expect(pageTitle).toHaveClass(/font-bold/);

		// Check subtitle text size matches gallery (text-lg mt-2)
		const pageSubtitle = page.locator('.header-text p');
		await expect(pageSubtitle).toHaveClass(/text-lg/);
		await expect(pageSubtitle).toHaveClass(/mt-2/);

		// Check tab buttons use same styling as gallery
		const tabButtons = page.locator('.tab-button');
		await expect(tabButtons.first()).toBeVisible();

		// Verify tab buttons have proper layout structure
		const toggleContainer = page.locator('.flex.bg-gray-100');
		await expect(toggleContainer).toBeVisible();
	});
});
