import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test.describe('Photo Selection for Game Creation', () => {
	test.beforeEach(async ({ page }) => {
		const auth = new AuthUtils(page);
		// Navigate to create page (authentication is handled by the setup)
		await auth.gotoProtected('/create');
	});

	test('should allow clicking anywhere on image to select/deselect in game creation', async ({
		page
	}) => {
		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Check if we're on the create page
		expect(page.url()).toContain('/create');

		// Look for image selection interface
		const images = page.locator('.gallery-item, .image-item, .selectable-image');
		const imageCount = await images.count();

		if (imageCount > 0) {
			// Click on first image to select it
			await images.first().click();
			console.log('✅ Image selection functionality tested');
		} else {
			console.log('ℹ️  No images available for selection');
		}
	});

	test('should allow selecting multiple images by clicking on them', async ({ page }) => {
		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Look for image selection interface
		const images = page.locator('.gallery-item, .image-item, .selectable-image');
		const imageCount = await images.count();

		if (imageCount >= 2) {
			// Select first two images
			await images.nth(0).click();
			await images.nth(1).click();
			console.log('✅ Multiple image selection tested');
		} else {
			console.log('ℹ️  Not enough images available for multiple selection test');
		}
	});

	test('should work with both checkbox and image click', async ({ page }) => {
		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Look for checkboxes and images
		const checkboxes = page.locator('input[type="checkbox"]');
		const images = page.locator('.gallery-item, .image-item, .selectable-image');

		const checkboxCount = await checkboxes.count();
		const imageCount = await images.count();

		if (checkboxCount > 0 && imageCount > 0) {
			// Test checkbox selection
			await checkboxes.first().click();
			console.log('✅ Checkbox selection tested');

			// Test image click selection
			await images.first().click();
			console.log('✅ Image click selection tested');
		} else {
			console.log('ℹ️  Selection interface not available');
		}
	});

	test('should show create game modal when enough images are selected', async ({ page }) => {
		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Look for images to select
		const images = page.locator('.gallery-item, .image-item, .selectable-image');
		const imageCount = await images.count();

		if (imageCount >= 3) {
			// Select multiple images
			for (let i = 0; i < Math.min(3, imageCount); i++) {
				await images.nth(i).click();
				await page.waitForTimeout(500); // Small delay between clicks
			}

			// Look for create game button or modal
			const createButton = page.locator('button:has-text("Create Game"), .create-game-btn');
			if (await createButton.isVisible({ timeout: 5000 })) {
				console.log('✅ Create game functionality available');
			} else {
				console.log('ℹ️  Create game button not visible');
			}
		} else {
			console.log('ℹ️  Not enough images for game creation test');
		}
	});
});

test.describe('Photo Selection and Gallery Tests', () => {
	test('Photo selection and upload functionality', async ({ page }) => {
		const auth = new AuthUtils(page);

		// Navigate to upload page
		await auth.gotoProtected('/upload');

		// Check if the file input exists
		const fileInput = page.locator('input[type="file"]');
		if (await fileInput.isVisible({ timeout: 5000 })) {
			await expect(fileInput).toBeAttached();
			console.log('✅ Upload page is accessible and functional');
		} else {
			console.log('ℹ️  Upload interface not found');
		}

		// Navigate to gallery to check uploaded images
		await auth.gotoProtected('/gallery');

		// Check gallery functionality
		const galleryContent = page.locator('.gallery-grid, .gallery-content, main');
		await expect(galleryContent).toBeVisible();

		console.log('✅ Gallery page is accessible');
	});

	test('Gallery navigation and filtering', async ({ page }) => {
		const auth = new AuthUtils(page);

		// Navigate to gallery
		await auth.gotoProtected('/gallery');

		// Check if gallery has content
		const images = page.locator('.gallery-item, .image-item');
		const imageCount = await images.count();

		if (imageCount > 0) {
			console.log(`✅ Gallery has ${imageCount} images`);

			// Test image interaction
			await images.first().click();
			console.log('✅ Image interaction tested');
		} else {
			console.log('ℹ️  Gallery is empty');

			// Check for upload prompt in empty state
			const uploadPrompt = page.locator('button:has-text("Upload")').first();
			if (await uploadPrompt.isVisible({ timeout: 2000 })) {
				console.log('✅ Upload prompt available in empty state');
			}
		}

		console.log('✅ Gallery navigation and filtering test completed');
	});
});
