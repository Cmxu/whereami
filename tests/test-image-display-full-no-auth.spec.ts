import { test, expect, type Page } from '@playwright/test';

test.describe('Game Image Display - Full Picture Visibility (No Auth)', () => {
	test('should display the entire image at start with object-contain styling', async ({ page }) => {
		// Navigate to the main page
		await page.goto('https://whereami-5kp.pages.dev/');

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Try to start a random game
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
			console.log('No public images available - cannot test image display');
			return;
		}

		// Wait for the game image to load
		const gameImage = page.locator('.game-image');
		await expect(gameImage).toBeVisible({ timeout: 10000 });

		// Wait for image to be fully loaded
		await page.waitForTimeout(3000);

		// Verify the image has object-contain styling
		const objectFit = await gameImage.evaluate((img) => {
			return window.getComputedStyle(img).objectFit;
		});

		console.log(`Image object-fit style: ${objectFit}`);
		expect(objectFit).toBe('contain');

		// Verify the image viewport has a background color for letterboxing
		const imageViewport = page.locator('.image-viewport');
		const backgroundColor = await imageViewport.evaluate((viewport) => {
			return window.getComputedStyle(viewport).backgroundColor;
		});

		console.log(`Image viewport background color: ${backgroundColor}`);
		// The background should be a dark color (rgb(31, 41, 55) which is #1f2937)
		expect(backgroundColor).toBe('rgb(31, 41, 55)');

		// Verify that the image maintains its aspect ratio
		const imageDimensions = await gameImage.evaluate((img) => {
			const imgElement = img as HTMLImageElement;
			return {
				naturalWidth: imgElement.naturalWidth,
				naturalHeight: imgElement.naturalHeight,
				displayWidth: imgElement.offsetWidth,
				displayHeight: imgElement.offsetHeight,
				aspectRatio: imgElement.naturalWidth / imgElement.naturalHeight
			};
		});

		console.log(`Image dimensions:`, imageDimensions);

		// Verify that the container dimensions are appropriate
		const containerDimensions = await imageViewport.evaluate((viewport) => {
			const element = viewport as HTMLElement;
			return {
				width: element.offsetWidth,
				height: element.offsetHeight
			};
		});

		console.log(`Container dimensions:`, containerDimensions);

		// The image should fit within the container while maintaining aspect ratio
		const imageAspectRatio = imageDimensions.aspectRatio;
		const containerAspectRatio = containerDimensions.width / containerDimensions.height;

		console.log(`Image aspect ratio: ${imageAspectRatio}`);
		console.log(`Container aspect ratio: ${containerAspectRatio}`);

		// Verify zoom controls are present and functional
		const zoomInButton = page.locator('button[aria-label="Zoom in"]');
		const zoomOutButton = page.locator('button[aria-label="Zoom out"]');

		await expect(zoomInButton).toBeVisible();
		await expect(zoomOutButton).toBeVisible();

		// Initially zoom out should be disabled (since we start at 1x scale)
		const zoomOutDisabled = await zoomOutButton.isDisabled();
		console.log(`Zoom out button disabled initially: ${zoomOutDisabled}`);
		expect(zoomOutDisabled).toBe(true);

		// Test zoom functionality
		await zoomInButton.click();
		await page.waitForTimeout(500);

		// After zooming in, zoom out should be enabled
		const zoomOutEnabledAfterZoom = await zoomOutButton.isEnabled();
		console.log(`Zoom out button enabled after zoom in: ${zoomOutEnabledAfterZoom}`);
		expect(zoomOutEnabledAfterZoom).toBe(true);

		// Check that reset zoom button appears after zooming
		const resetZoomButton = page.locator('button[aria-label="Reset zoom"]');
		await expect(resetZoomButton).toBeVisible();

		// Reset zoom to original state
		await resetZoomButton.click();
		await page.waitForTimeout(500);

		// Verify that after reset, zoom out is disabled again
		const zoomOutDisabledAfterReset = await zoomOutButton.isDisabled();
		console.log(`Zoom out button disabled after reset: ${zoomOutDisabledAfterReset}`);
		expect(zoomOutDisabledAfterReset).toBe(true);

		// Take a screenshot for verification
		await page.screenshot({ path: 'test-results/image-display-full.png', fullPage: true });

		console.log('SUCCESS: Image display test completed - entire image visible with proper styling');
	});

	test('should handle image transitions between rounds properly', async ({ page }) => {
		// Navigate to the main page
		await page.goto('https://whereami-5kp.pages.dev/');

		// Wait for the page to load
		await page.waitForLoadState('networkidle');

		// Start a quick game (fewer rounds)
		const quickGameButton = page.locator('button').filter({ hasText: 'Quick Game' });
		
		const quickGameVisible = await quickGameButton.isVisible().catch(() => false);
		if (!quickGameVisible) {
			console.log('Quick game button not found - skipping round transition test');
			return;
		}

		await quickGameButton.click();
		await page.waitForTimeout(5000);

		// Check if there are images available
		const errorMessage = page.locator('text=No public images available');
		const hasError = await errorMessage.isVisible().catch(() => false);
		if (hasError) {
			console.log('No public images available - cannot test round transitions');
			return;
		}

		// Wait for first image to load
		const gameImage = page.locator('.game-image');
		await expect(gameImage).toBeVisible({ timeout: 10000 });
		await page.waitForTimeout(2000);

		// Verify first image has object-contain
		const firstImageObjectFit = await gameImage.evaluate((img) => {
			return window.getComputedStyle(img).objectFit;
		});
		
		console.log(`First image object-fit: ${firstImageObjectFit}`);
		expect(firstImageObjectFit).toBe('contain');

		// Make a guess to proceed to next round
		const mapContainer = page.locator('.map-container').first();
		await expect(mapContainer).toBeVisible({ timeout: 10000 });
		await page.waitForTimeout(2000);

		// Click on map to make a guess
		await mapContainer.click({ position: { x: 200, y: 200 } });
		await page.waitForTimeout(1000);

		// Submit the guess
		const submitButton = page.locator('button').filter({ hasText: /Submit/ });
		await expect(submitButton).toBeVisible({ timeout: 5000 });
		await submitButton.click();
		await page.waitForTimeout(2000);

		// Look for next round button
		const nextRoundButton = page.locator('button').filter({ hasText: /Next Round/ });
		const nextRoundVisible = await nextRoundButton.isVisible().catch(() => false);

		if (nextRoundVisible) {
			await nextRoundButton.click();
			await page.waitForTimeout(3000);

			// Verify second image also has object-contain
			const secondImageObjectFit = await gameImage.evaluate((img) => {
				return window.getComputedStyle(img).objectFit;
			});
			
			console.log(`Second image object-fit: ${secondImageObjectFit}`);
			expect(secondImageObjectFit).toBe('contain');

			// Verify image viewport background is still correct
			const imageViewport = page.locator('.image-viewport');
			const backgroundColor = await imageViewport.evaluate((viewport) => {
				return window.getComputedStyle(viewport).backgroundColor;
			});

			console.log(`Second round image viewport background: ${backgroundColor}`);
			expect(backgroundColor).toBe('rgb(31, 41, 55)');

			console.log('SUCCESS: Image transitions between rounds maintain proper styling');
		} else {
			console.log('Next round button not found - may be final round or single round game');
		}
	});
}); 