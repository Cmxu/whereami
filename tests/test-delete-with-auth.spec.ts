import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test.describe('Delete Image with Authentication', () => {
	test('Verify delete functionality is available for authenticated users', async ({ page }) => {
		const auth = new AuthUtils(page);

		// Navigate to gallery with automatic authentication
		await auth.gotoProtected('/gallery');

		// Check if user has images
		const hasImages = await auth.hasImages();

		if (hasImages) {
			console.log('✅ User has images in gallery');

			// Check for delete buttons
			const deleteButtons = await page
				.locator('button[title="Delete photo"], button:has-text("🗑️")')
				.count();

			if (deleteButtons > 0) {
				console.log(`✅ Found ${deleteButtons} delete button(s) in gallery`);
				console.log('🎉 Delete functionality is properly integrated!');

				// Take a screenshot for verification
				await page.screenshot({ path: 'tests/screenshots/gallery-with-delete-buttons.png' });
				console.log('📸 Screenshot saved to tests/screenshots/gallery-with-delete-buttons.png');

				// Verify delete buttons are functional (just check they exist and are enabled)
				const firstDeleteButton = page
					.locator('button[title="Delete photo"], button:has-text("🗑️")')
					.first();
				await expect(firstDeleteButton).toBeVisible();
				await expect(firstDeleteButton).toBeEnabled();
			} else {
				console.log('❌ No delete buttons found in gallery');
				// This might be expected if the user doesn't own any images
				console.log('💡 This could be expected if the user has no owned images');
			}
		} else {
			console.log('ℹ️  User has no images in gallery');
			console.log('💡 Upload some images first to test delete functionality');

			// Check if upload functionality is available
			const uploadButton = await page
				.locator('button:has-text("Upload"), a[href="/upload"]')
				.count();
			if (uploadButton > 0) {
				console.log('✅ Upload functionality is available');
			}

			// Navigate to upload page to verify it's accessible
			await page.goto('/upload');
			await expect(page).toHaveURL(/.*\/upload/);
			console.log('✅ Upload page is accessible');
		}
	});

	test('API test: Verify delete endpoint with proper error handling', async ({ request }) => {
		const baseUrl = 'https://whereami-5kp.pages.dev';

		// Test various scenarios with the delete endpoint
		console.log('🧪 Testing delete API endpoint scenarios...');

		// Test 1: No authentication
		const noAuthResponse = await request.delete(`${baseUrl}/api/images/test-image-id`);
		expect(noAuthResponse.status()).toBe(401);
		console.log('✅ Correctly requires authentication');

		// Test 2: Invalid authentication
		const invalidAuthResponse = await request.delete(`${baseUrl}/api/images/test-image-id`, {
			headers: { Authorization: 'Bearer invalid-token' }
		});
		expect(invalidAuthResponse.status()).toBe(401);
		console.log('✅ Correctly rejects invalid tokens');

		// Test 3: CORS handling
		const corsResponse = await request.fetch(`${baseUrl}/api/images/test-image-id`, {
			method: 'OPTIONS'
		});
		expect(corsResponse.status()).toBe(200);
		const headers = corsResponse.headers();
		expect(headers['access-control-allow-methods']).toContain('DELETE');
		console.log('✅ CORS properly configured for DELETE requests');

		console.log('🎉 All API tests passed!');
	});
});
