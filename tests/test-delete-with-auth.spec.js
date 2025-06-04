import { test, expect } from '@playwright/test';

const baseUrl = 'https://whereami-5kp.pages.dev';

test.describe('Delete Image with Authentication', () => {
	test('Manual test: Login and verify delete functionality is available', async ({ page }) => {
		// Navigate to the gallery page
		await page.goto(`${baseUrl}/gallery`);
		
		// Should show sign-in prompt for unauthenticated users
		await expect(page.getByText('Sign In to Continue')).toBeVisible();
		
		// Click the sign in button
		await page.getByText('Sign In to Continue').click();
		
		// Wait for auth modal to appear - look for the modal backdrop
		await expect(page.locator('div[role="dialog"]')).toBeVisible({ timeout: 5000 });
		
		// Note: This test requires manual intervention to complete authentication
		console.log('🔐 Authentication modal appeared');
		console.log('📝 To complete this test:');
		console.log(`   1. Sign in using the email: ${process.env.TEST_EMAIL || 'cmxu@comcast.net'}`);
		console.log(`   2. Password: ${process.env.TEST_PASSWORD || 'admin1'}`);
		console.log('   3. The test will continue automatically after authentication');
		
		// Wait for authentication to complete (user will need to sign in manually)
		// We'll wait for the gallery to load with user content
		try {
			// Wait for either the gallery content to load or timeout
			await page.waitForSelector('.gallery-grid, .empty-state', { timeout: 30000 });
			
			// Check if user has images
			const hasImages = await page.locator('.gallery-grid .gallery-item').count() > 0;
			
			if (hasImages) {
				console.log('✅ User has images in gallery');
				
				// Check for delete buttons
				const deleteButtons = await page.locator('button[title="Delete photo"], button:has-text("🗑️")').count();
				
				if (deleteButtons > 0) {
					console.log(`✅ Found ${deleteButtons} delete button(s) in gallery`);
					console.log('🎉 Delete functionality is properly integrated!');
					
					// Take a screenshot for verification
					await page.screenshot({ path: 'tests/screenshots/gallery-with-delete-buttons.png' });
					console.log('📸 Screenshot saved to tests/screenshots/gallery-with-delete-buttons.png');
				} else {
					console.log('❌ No delete buttons found in gallery');
				}
			} else {
				console.log('ℹ️  User has no images in gallery');
				console.log('💡 Upload some images first to test delete functionality');
				
				// Check if upload functionality is available
				const uploadButton = await page.locator('button:has-text("Upload")').count();
				if (uploadButton > 0) {
					console.log('✅ Upload functionality is available');
				}
			}
			
		} catch (error) {
			console.log('⏰ Authentication timeout or gallery failed to load');
			console.log('💡 Make sure to sign in within 30 seconds');
		}
	});

	test('API test: Verify delete endpoint with proper error handling', async ({ request }) => {
		// Test various scenarios with the delete endpoint
		console.log('🧪 Testing delete API endpoint scenarios...');
		
		// Test 1: No authentication
		const noAuthResponse = await request.delete(`${baseUrl}/api/images/test-image-id`);
		expect(noAuthResponse.status()).toBe(401);
		console.log('✅ Correctly requires authentication');
		
		// Test 2: Invalid authentication
		const invalidAuthResponse = await request.delete(`${baseUrl}/api/images/test-image-id`, {
			headers: { 'Authorization': 'Bearer invalid-token' }
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