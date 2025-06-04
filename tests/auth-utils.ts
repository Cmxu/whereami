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
      const signInButton = this.page.getByText('Sign In to Continue');
      if (await signInButton.isVisible({ timeout: 3000 })) {
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
      if ((currentUrl.includes('/gallery') || currentUrl.includes('/profile') || currentUrl.includes('/create')) 
          && !await signInButton.isVisible({ timeout: 1000 })) {
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
   * Perform login if needed - more flexible approach
   */
  async ensureAuthenticated(): Promise<void> {
    // First check if already authenticated
    if (await this.isAuthenticated()) {
      console.log('✅ Already authenticated');
      return;
    }

    console.log('🔐 Authentication required, attempting login...');
    
    // Look for various sign-in elements
    const signInSelectors = [
      'text="Sign In to Continue"',
      'button:has-text("Sign In")',
      'button:has-text("Login")',
      'a:has-text("Sign In")',
      'a:has-text("Login")',
      '[data-testid="sign-in"]',
      '.sign-in-button'
    ];
    
    let signInElement = null;
    for (const selector of signInSelectors) {
      const element = this.page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        signInElement = element;
        console.log(`🔍 Found sign-in element: ${selector}`);
        break;
      }
    }
    
    if (signInElement) {
      await signInElement.click();
      
      // Look for various authentication interfaces
      const authSelectors = [
        'div[role="dialog"]',
        '.modal',
        '.auth-modal',
        '.login-modal',
        'iframe[src*="supabase"]',
        'iframe[src*="auth"]',
        'form[action*="auth"]',
        'form[action*="login"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email"]'
      ];
      
      let authInterface = null;
      for (const selector of authSelectors) {
        const element = this.page.locator(selector);
        if (await element.isVisible({ timeout: 5000 })) {
          authInterface = element;
          console.log(`🎯 Found authentication interface: ${selector}`);
          break;
        }
      }
      
      if (authInterface) {
        console.log('📝 Please complete authentication manually');
        console.log('   Email: cmxu@comcast.net');
        console.log('   Password: admin1');
        
        // Wait for authentication to complete
        await this.waitForAuthentication(60000);
        console.log('✅ Authentication completed');
      } else {
        console.log('⚠️  No authentication interface found - checking if already authenticated');
        // Sometimes clicking sign-in immediately authenticates (e.g., with stored credentials)
        await this.page.waitForTimeout(2000);
        if (await this.isAuthenticated()) {
          console.log('✅ Authentication completed automatically');
        } else {
          throw new Error('Authentication interface not found and not authenticated');
        }
      }
    } else {
      console.log('⚠️  No sign-in button found - checking authentication state');
      // Maybe we're already on an authenticated page but detection failed
      await this.page.waitForTimeout(2000);
      if (!await this.isAuthenticated()) {
        throw new Error('Sign In button not found and not authenticated');
      }
    }
  }

  /**
   * Check if user has uploaded images
   */
  async hasImages(): Promise<boolean> {
    try {
      // Make sure we're on the gallery page
      if (!this.page.url().includes('/gallery')) {
        await this.page.goto('/gallery');
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
        await this.page.goto('/gallery');
      }
      
      // Wait for page to load
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      const galleryItems = this.page.locator('.gallery-grid .gallery-item');
      return await galleryItems.count();
    } catch {
      return 0;
    }
  }

  /**
   * Navigate to a protected page and ensure authentication
   */
  async gotoProtected(path: string): Promise<void> {
    await this.page.goto(path);
    
    // Wait for page to load
    await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Only try to authenticate if we detect we need to
    if (!await this.isAuthenticated()) {
      await this.ensureAuthenticated();
    }
  }
} 