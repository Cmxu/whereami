import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test.describe('Basic Authentication Tests', () => {
  test('should be authenticated and access gallery', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to gallery (protected route)
    await auth.gotoProtected('/gallery');
    
    // Verify we're authenticated
    expect(await auth.isAuthenticated()).toBe(true);
    
    // Check that we can see gallery content (more flexible check)
    await expect(page.locator('main')).toBeVisible();
    
    // Check that we're actually on the gallery page
    expect(page.url()).toContain('/gallery');
    
    console.log('✅ Authentication test passed');
  });

  test('should be able to access profile page', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to profile (protected route)
    await auth.gotoProtected('/profile');
    
    // Verify we're authenticated
    expect(await auth.isAuthenticated()).toBe(true);
    
    // Check that we can see profile content (use first h1 only)
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Check that we're actually on the profile page
    expect(page.url()).toContain('/profile');
    
    console.log('✅ Profile access test passed');
  });

  test('should be able to access create page', async ({ page }) => {
    const auth = new AuthUtils(page);
    
    // Navigate to create (protected route)
    await auth.gotoProtected('/create');
    
    // Verify we're authenticated
    expect(await auth.isAuthenticated()).toBe(true);
    
    // Check that we can see create content
    await expect(page.locator('main')).toBeVisible();
    
    // Check that we're actually on the create page
    expect(page.url()).toContain('/create');
    
    console.log('✅ Create page access test passed');
  });
}); 