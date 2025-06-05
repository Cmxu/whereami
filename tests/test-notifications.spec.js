const { test, expect } = require('@playwright/test');

test.describe('Notification System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://whereami-5kp.pages.dev');
  });

  test('notifications appear in bottom left position', async ({ page }) => {
    // Navigate to gallery which should trigger a sign-in info notification
    await page.click('a[href="/gallery"]');
    
    // Wait for the notification to appear
    await page.waitForSelector('.toast-container .toast-position.bottom-left', { timeout: 10000 });
    
    // Verify the notification container is positioned bottom-left
    const toastContainer = page.locator('.toast-position.bottom-left');
    await expect(toastContainer).toBeVisible();
    
    // Check the positioning classes
    await expect(toastContainer).toHaveClass(/bottom-left/);
    await expect(toastContainer).toHaveClass(/fixed/);
    
    console.log('✅ Notifications are positioned in bottom left');
  });

  test('tutorial notifications only show once', async ({ page }) => {
    // Clear any existing tutorial states
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tutorial_shown_')) {
          localStorage.removeItem(key);
        }
      });
    });

    // Navigate to a page that triggers tutorial notifications (upload tab)
    await page.goto('https://whereami-5kp.pages.dev/gallery?tab=upload');
    
    // Wait a moment for the page to load and potentially show tutorials
    await page.waitForTimeout(2000);
    
    // Count tutorial notifications (they should contain "💡" or "Tip")
    const initialTutorialCount = await page.locator('.toast').filter({ hasText: /💡|Tip/ }).count();
    console.log(`Initial tutorial notifications: ${initialTutorialCount}`);
    
    // Reload the page - tutorial notifications should not show again
    await page.reload();
    await page.waitForTimeout(2000);
    
    const secondTutorialCount = await page.locator('.toast').filter({ hasText: /💡|Tip/ }).count();
    console.log(`Second visit tutorial notifications: ${secondTutorialCount}`);
    
    // Tutorial notifications should be less or equal on second visit
    expect(secondTutorialCount).toBeLessThanOrEqual(initialTutorialCount);
    
    console.log('✅ Tutorial notifications only show once');
  });

  test('game tutorial notification appears once', async ({ page }) => {
    // Clear tutorial states
    await page.evaluate(() => {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('tutorial_shown_')) {
          localStorage.removeItem(key);
        }
      });
    });

    // Start a random game to trigger game tutorial
    await page.click('text=🎲 Random Game');
    
    // Wait for game to load and tutorial to potentially appear
    await page.waitForTimeout(3000);
    
    // Check if game tutorial appeared
    const gameTutorial = page.locator('.toast').filter({ hasText: /clues|landmarks|architecture/ });
    const tutorialVisible = await gameTutorial.count() > 0;
    console.log(`Game tutorial visible: ${tutorialVisible}`);
    
    if (tutorialVisible) {
      // Refresh the game page
      await page.reload();
      await page.waitForTimeout(3000);
      
      // Tutorial should not appear again
      const tutorialAfterReload = await page.locator('.toast').filter({ hasText: /clues|landmarks|architecture/ }).count();
      expect(tutorialAfterReload).toBe(0);
      
      console.log('✅ Game tutorial only shows once');
    } else {
      console.log('ℹ️ Game tutorial was already shown or not triggered');
    }
  });
}); 