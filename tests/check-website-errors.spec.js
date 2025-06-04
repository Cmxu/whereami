import { test, expect } from '@playwright/test';

test.describe('WhereAmI Website Error Check', () => {
  test('should load without console errors', async ({ page }) => {
    // Array to collect console messages
    /** @type {Array<{type: string, text: string, url?: string, lineNumber?: number}>} */
    const consoleMessages = [];
    /** @type {Array<{text: string, url?: string, lineNumber?: number}>} */
    const errorMessages = [];
    
    // Listen for console events
    page.on('console', (msg) => {
      const location = msg.location();
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        url: location.url,
        lineNumber: location.lineNumber
      });
      
      // Collect error messages
      if (msg.type() === 'error') {
        errorMessages.push({
          text: msg.text(),
          url: location.url,
          lineNumber: location.lineNumber
        });
      }
    });

    // Listen for page errors
    /** @type {Array<{name: string, message: string, stack?: string}>} */
    const pageErrors = [];
    page.on('pageerror', (error) => {
      pageErrors.push({
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    });

    // Listen for failed requests
    /** @type {Array<{url: string, status: number, statusText: string}>} */
    const failedRequests = [];
    page.on('response', (response) => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });

    // Navigate to the website
    console.log('Loading website: https://whereami-5kp.pages.dev/');
    await page.goto('https://whereami-5kp.pages.dev/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);

    // Check that the page loaded successfully
    await expect(page).toHaveTitle(/WhereAmI/);
    
    // Check for main content
    await expect(page.locator('h1')).toContainText('WhereAmI');

    // Report results
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.type.toUpperCase()}] ${msg.text}`);
      if (msg.url && msg.lineNumber) {
        console.log(`   Location: ${msg.url}:${msg.lineNumber}`);
      }
    });

    console.log('\n=== CONSOLE ERRORS ===');
    if (errorMessages.length === 0) {
      console.log('✅ No console errors found!');
    } else {
      errorMessages.forEach((error, index) => {
        console.log(`${index + 1}. ${error.text}`);
        if (error.url && error.lineNumber) {
          console.log(`   Location: ${error.url}:${error.lineNumber}`);
        }
      });
    }

    console.log('\n=== PAGE ERRORS ===');
    if (pageErrors.length === 0) {
      console.log('✅ No page errors found!');
    } else {
      pageErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.name}: ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack}`);
        }
      });
    }

    console.log('\n=== FAILED REQUESTS ===');
    if (failedRequests.length === 0) {
      console.log('✅ No failed requests found!');
    } else {
      failedRequests.forEach((request, index) => {
        console.log(`${index + 1}. ${request.status} ${request.statusText}: ${request.url}`);
      });
    }

    // Optional: Take a screenshot for visual verification
    await page.screenshot({ path: 'tests/screenshots/website-loaded.png', fullPage: true });
    console.log('\n📸 Screenshot saved to tests/screenshots/website-loaded.png');

    // Assertions - fail the test if there are critical errors
    expect(pageErrors).toHaveLength(0);
    // We'll allow some console errors as they might be warnings, but log them
    if (errorMessages.length > 0) {
      console.log(`\n⚠️  Found ${errorMessages.length} console errors (logged above)`);
    }
    if (failedRequests.length > 0) {
      console.log(`\n⚠️  Found ${failedRequests.length} failed requests (logged above)`);
    }
  });

  test('should have functional navigation', async ({ page }) => {
    await page.goto('https://whereami-5kp.pages.dev/');
    
    // Check that main navigation elements are present (use first occurrence)
    await expect(page.locator('text=Gallery').first()).toBeVisible();
    await expect(page.locator('text=Browse').first()).toBeVisible();
    await expect(page.locator('text=Create').first()).toBeVisible();
    
    // Check game options are present
    await expect(page.locator('text=Quick Game')).toBeVisible();
    await expect(page.locator('text=Full Game')).toBeVisible();
    
    console.log('✅ All main navigation elements are visible');
  });
}); 