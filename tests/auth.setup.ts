import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  console.log('🚀 Starting authentication setup...');
  
  // Navigate to the gallery page which will trigger authentication
  await page.goto('/gallery');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  console.log('📄 Page loaded, checking authentication state...');
  
  // Check if we need to sign in by looking for various possible sign-in indicators
  const signInSelectors = [
    'text="Sign In to Continue"',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
    'a:has-text("Sign In")',
    'a:has-text("Login")',
    '[data-testid="sign-in"]',
    '.sign-in-button',
    'button:has-text("Sign in with Email")',
    'button[type="submit"]:has-text("Sign In")'
  ];
  
  let signInElement = null;
  for (const selector of signInSelectors) {
    const element = page.locator(selector);
    if (await element.isVisible({ timeout: 2000 })) {
      signInElement = element;
      console.log(`🔍 Found sign-in element: ${selector}`);
      break;
    }
  }
  
  if (signInElement) {
    console.log('🔐 Authentication required, proceeding with login...');
    
    // Click the sign in element
    await signInElement.click();
    
    // Wait for authentication form to appear and any toast messages to settle
    await page.waitForTimeout(3000);
    
    // Try to dismiss any toast messages that might interfere
    const toastContainer = page.locator('.toast-container');
    if (await toastContainer.isVisible({ timeout: 1000 })) {
      console.log('🍞 Dismissing toast message...');
      await toastContainer.click();
      await page.waitForTimeout(1000);
    }
    
    // Look for email input field
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"], input[placeholder*="password"]').first();
    
    if (await emailInput.isVisible({ timeout: 5000 })) {
      console.log('📧 Email input found, filling in credentials...');
      
      // Fill in the email
      await emailInput.fill('cmxu@comcast.net');
      
      if (await passwordInput.isVisible({ timeout: 2000 })) {
        console.log('🔑 Password input found, filling in password...');
        await passwordInput.fill('admin1');
        
        // Look for submit button
        const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
        if (await submitButton.isVisible({ timeout: 2000 })) {
          console.log('🚀 Submitting login form...');
          try {
            await submitButton.click({ force: true });
          } catch (error) {
            console.log('🔄 Force click failed, trying Enter key...');
            await passwordInput.press('Enter');
          }
        } else {
          console.log('🔍 Submit button not found, trying Enter key...');
          await passwordInput.press('Enter');
        }
      } else {
        console.log('⚠️  Password input not found, trying Enter key on email...');
        await emailInput.press('Enter');
      }
      
      // Wait for authentication to complete
      console.log('⏳ Waiting for authentication to complete...');
      
      try {
        // Wait for authentication success indicators
        await Promise.race([
          // Wait for navigation away from auth page
          page.waitForURL(/\/gallery|\/profile|\/create/, { timeout: 30000 }),
          // Wait for gallery content to load
          page.waitForSelector('.gallery-grid, .empty-state, [data-testid="gallery-content"]', { timeout: 30000 }),
          // Wait for user menu or profile indicators
          page.waitForSelector('[data-testid="user-menu"], .user-profile, button[title*="profile"]', { timeout: 30000 })
        ]);
        
        console.log('✅ Authentication successful!');
        
      } catch (error) {
        console.log('⚠️  Authentication may have failed, checking current state...');
        
        // Take a screenshot for debugging
        await page.screenshot({ path: 'tests/screenshots/auth-debug.png' });
        
        const currentUrl = page.url();
        console.log(`🔗 Current URL: ${currentUrl}`);
        
        // If we're still on an auth page, authentication likely failed
        if (currentUrl.includes('auth') || currentUrl.includes('login') || currentUrl.includes('sign')) {
          throw new Error('Authentication failed - still on auth page');
        }
        
        console.log('✅ Authentication appears successful based on URL');
      }
      
    } else {
      console.log('⚠️  Email input not found - authentication interface may be different');
      console.log('💡 Taking screenshot for debugging...');
      await page.screenshot({ path: 'tests/screenshots/no-email-input-debug.png' });
      
      // If no email input, this might be a social login or different auth flow
      // Let's wait for manual intervention if running headed
      if (!process.env.CI) {
        console.log('💡 Manual authentication may be required. Waiting 30 seconds...');
        await page.waitForTimeout(30000);
      }
    }
    
  } else {
    console.log('✅ No sign-in prompts found - already authenticated or no authentication required');
  }
  
  // Ensure we're on a valid page
  const currentUrl = page.url();
  if (!currentUrl.includes('whereami-5kp.pages.dev')) {
    console.log('🔄 Redirecting to gallery to ensure we are on the correct domain...');
    await page.goto('/gallery');
    await page.waitForLoadState('networkidle');
  }
  
  // Save the authentication state
  await page.context().storageState({ path: authFile });
  console.log('💾 Authentication state saved to:', authFile);
  
  // Take a final screenshot for verification
  await page.screenshot({ path: 'tests/screenshots/auth-setup-complete.png' });
  console.log('📸 Final screenshot saved');
});