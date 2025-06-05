import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export class AuthUtils {
	constructor(private page: Page) {}

	/**
	 * Check if the user is currently authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		try {
			// Wait for page to load first
			await this.page.waitForLoadState('networkidle', { timeout: 5000 });

			// Check for sign-in prompt (indicates not authenticated)
			const hasSignInPrompt = await this.page.evaluate(() => {
				return Array.from(document.querySelectorAll('*')).some((el) =>
					el.textContent?.includes('Sign In to Continue')
				);
			});

			if (hasSignInPrompt) {
				return false;
			}

			// Check for authenticated indicators
			const authenticatedIndicators = [
				'.gallery-grid',
				'.empty-state',
				'[data-testid="user-menu"]',
				'.user-profile',
				'button[title*="profile"]',
				'nav a[href="/profile"]',
				'nav a[href="/create"]',
				'a[href="/upload"]'
			];

			for (const selector of authenticatedIndicators) {
				if (await this.page.locator(selector).isVisible({ timeout: 2000 })) {
					return true;
				}
			}

			// Additional check: if we're on a protected page and no sign-in prompt, likely authenticated
			const currentUrl = this.page.url();
			if (
				(currentUrl.includes('/gallery') ||
					currentUrl.includes('/profile') ||
					currentUrl.includes('/create')) &&
				!hasSignInPrompt
			) {
				return true;
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * Wait for authentication to complete
	 */
	async waitForAuthentication(timeoutMs: number = 30000): Promise<void> {
		const startTime = Date.now();

		while (Date.now() - startTime < timeoutMs) {
			if (await this.isAuthenticated()) {
				return;
			}
			await this.page.waitForTimeout(1000);
		}

		throw new Error(`Authentication did not complete within ${timeoutMs}ms`);
	}

	/**
	 * Navigate to a protected route and verify authentication
	 */
	async gotoProtected(path: string): Promise<void> {
		await this.page.goto(path);
		await this.page.waitForLoadState('networkidle');

		// Verify we're authenticated
		if (!(await this.isAuthenticated())) {
			throw new Error(`Not authenticated when accessing protected route: ${path}`);
		}
	}

	/**
	 * Check if user has uploaded images
	 */
	async hasImages(): Promise<boolean> {
		try {
			// Make sure we're on the gallery page
			if (!this.page.url().includes('/gallery')) {
				await this.gotoProtected('/gallery');
			}

			// Wait for page to load
			await this.page.waitForLoadState('networkidle', { timeout: 10000 });

			// Check for gallery items
			const galleryItems = this.page.locator('.gallery-grid .gallery-item');
			const count = await galleryItems.count();

			return count > 0;
		} catch {
			return false;
		}
	}

	/**
	 * Get the count of user's images
	 */
	async getImageCount(): Promise<number> {
		try {
			// Make sure we're on the gallery page
			if (!this.page.url().includes('/gallery')) {
				await this.gotoProtected('/gallery');
			}

			// Wait for page to load
			await this.page.waitForLoadState('networkidle', { timeout: 10000 });

			const galleryItems = this.page.locator('.gallery-grid .gallery-item');
			return await galleryItems.count();
		} catch {
			return 0;
		}
	}
}
