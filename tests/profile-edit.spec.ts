import { test, expect } from '@playwright/test';

test.describe('Profile Editing', () => {
	test.beforeEach(async ({ page }) => {
		// Go to the home page
		await page.goto('https://whereami-5kp.pages.dev');
		
		// Fill in login credentials (from auth setup)
		await page.click('button:has-text("Sign In")');
		
		// Wait for auth modal
		await page.waitForSelector('input[type="email"]');
		await page.fill('input[type="email"]', 'cmxu@comcast.net');
		await page.fill('input[type="password"]', 'admin1');
		
		// Sign in
		await page.click('button:has-text("Sign In")');
		
		// Wait for successful login - check for user menu
		await page.waitForSelector('.user-menu-trigger', { timeout: 10000 });
		
		// Navigate to profile page
		await page.goto('https://whereami-5kp.pages.dev/profile');
		await page.waitForLoadState('networkidle');
	});

	test('should display edit profile button', async ({ page }) => {
		// Check that the edit profile button exists
		const editButton = page.locator('button:has-text("Edit Profile")');
		await expect(editButton).toBeVisible();
	});

	test('should open profile edit modal', async ({ page }) => {
		// Click edit profile button
		await page.click('button:has-text("Edit Profile")');
		
		// Check that modal is open
		await expect(page.locator('[role="dialog"]')).toBeVisible();
		await expect(page.locator('h2:has-text("Edit Profile")')).toBeVisible();
		
		// Check form fields are present
		await expect(page.locator('input#displayName')).toBeVisible();
		await expect(page.locator('label:has-text("Profile Picture")')).toBeVisible();
	});

	test('should update display name', async ({ page }) => {
		// Click edit profile button
		await page.click('button:has-text("Edit Profile")');
		
		// Wait for modal to be visible
		await page.waitForSelector('[role="dialog"]');
		
		// Update display name
		const newDisplayName = `Test User ${Date.now()}`;
		await page.fill('input#displayName', newDisplayName);
		
		// Submit form
		await page.click('button:has-text("Update Profile")');
		
		// Wait for success message or modal to close
		await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 10000 });
		
		// Check that display name was updated on the profile page
		await expect(page.locator(`h1:has-text("${newDisplayName}")`)).toBeVisible();
	});

	test('should close modal when clicking cancel', async ({ page }) => {
		// Click edit profile button
		await page.click('button:has-text("Edit Profile")');
		
		// Wait for modal to be visible
		await page.waitForSelector('[role="dialog"]');
		
		// Click cancel
		await page.click('button:has-text("Cancel")');
		
		// Check that modal is closed
		await expect(page.locator('[role="dialog"]')).not.toBeVisible();
	});

	test('should close modal when clicking X button', async ({ page }) => {
		// Click edit profile button
		await page.click('button:has-text("Edit Profile")');
		
		// Wait for modal to be visible
		await page.waitForSelector('[role="dialog"]');
		
		// Click X button
		await page.click('button[aria-label="Close modal"]');
		
		// Check that modal is closed
		await expect(page.locator('[role="dialog"]')).not.toBeVisible();
	});

	test('should validate profile picture file type', async ({ page }) => {
		// Click edit profile button
		await page.click('button:has-text("Edit Profile")');
		
		// Wait for modal to be visible
		await page.waitForSelector('[role="dialog"]');
		
		// Try to upload a non-image file
		// Note: This is a basic test - in a real scenario we'd need actual file upload testing
		const fileInput = page.locator('input[type="file"]');
		await expect(fileInput).toHaveAttribute('accept', 'image/*');
	});
}); 