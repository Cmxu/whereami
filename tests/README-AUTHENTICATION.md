# Playwright Authentication Setup

This document explains the improved authentication setup for Playwright tests, implementing best practices from the official Playwright documentation.

## Overview

The authentication system uses Playwright's recommended approach with:
- **Setup projects** that run authentication once before all tests
- **Storage state** to persist authentication across test runs
- **Utility classes** for consistent authentication handling
- **Flexible detection** for various authentication states

## Files Structure

```
tests/
├── auth.setup.ts           # Main authentication setup
├── auth-utils.ts           # Authentication utility class
├── playwright.config.ts    # Configuration with setup projects
└── screenshots/            # Debug screenshots
playwright/
└── .auth/
    └── user.json           # Stored authentication state
```

## How It Works

### 1. Setup Project (`auth.setup.ts`)

The setup project runs before all tests and:
- Navigates to `/gallery` to trigger authentication
- Detects various sign-in elements and authentication interfaces
- Waits for manual authentication completion (60 seconds timeout)
- Saves authentication state to `playwright/.auth/user.json`
- Takes screenshots for debugging

### 2. Configuration (`playwright.config.ts`)

The configuration defines:
- A `setup` project that runs `auth.setup.ts`
- Browser projects (chromium, firefox, webkit) that depend on setup
- Storage state configuration pointing to the saved auth file
- Special projects for non-authenticated and API tests

### 3. Authentication Utilities (`auth-utils.ts`)

The `AuthUtils` class provides:
- `isAuthenticated()` - Check current authentication status
- `ensureAuthenticated()` - Perform login if needed
- `gotoProtected(path)` - Navigate to protected pages
- `hasImages()` - Check if user has uploaded images
- `getImageCount()` - Get count of user's images

## Usage

### Running Tests

```bash
# Run all tests (setup runs automatically)
npx playwright test

# Run setup only
npx playwright test tests/auth.setup.ts

# Run specific test with authentication
npx playwright test tests/test-auth-verification.spec.ts
```

### Using in Tests

```typescript
import { test, expect } from '@playwright/test';
import { AuthUtils } from './auth-utils';

test('My authenticated test', async ({ page }) => {
  const auth = new AuthUtils(page);
  
  // Navigate to protected page (auto-authenticates if needed)
  await auth.gotoProtected('/gallery');
  
  // Check authentication status
  const isAuth = await auth.isAuthenticated();
  
  // Get user data
  const imageCount = await auth.getImageCount();
  
  // Your test logic here...
});
```

### Manual Authentication

When running setup, you'll see:
```
📝 Authentication interface detected!
   Email: cmxu@comcast.net
   Password: admin1
   Please complete authentication manually
   This setup will wait for up to 60 seconds...
```

Complete the authentication in the browser window within 60 seconds.

## Current Status

✅ **Working:**
- Authentication setup runs successfully
- Manual authentication completion works
- Storage state is saved and loaded
- Tests can detect authentication requirements
- Flexible authentication interface detection

⚠️ **Known Issues:**
- Authentication state may not persist properly (only theme data saved)
- This suggests the app uses token-based auth (Supabase) that needs special handling
- Tests still require manual authentication on each run

## Troubleshooting

### Authentication Not Persisting

If tests still require authentication despite setup:

1. Check the storage state file:
   ```bash
   cat playwright/.auth/user.json
   ```

2. Look for authentication tokens in browser storage:
   - Supabase tokens are often in localStorage with keys like `supabase.auth.token`
   - Check browser dev tools during manual authentication

3. Run debug test:
   ```bash
   npx playwright test tests/test-simple-auth-check.spec.ts
   ```

### Screenshots for Debugging

The setup creates screenshots in `tests/screenshots/`:
- `auth-setup-complete.png` - Final state after setup
- `auth-timeout-debug.png` - If authentication times out
- `debug-gallery-state.png` - Current page state

## Next Steps

To fully resolve authentication persistence:

1. **Investigate Supabase Auth**: The app likely uses Supabase authentication which stores tokens in localStorage with specific keys
2. **Capture Auth Tokens**: Modify the setup to capture and save Supabase auth tokens
3. **Token-based Setup**: Create a setup that uses API authentication instead of UI-based auth
4. **Environment Variables**: Store test credentials securely

## Security Notes

- The `playwright/.auth/` directory is in `.gitignore`
- Never commit authentication state files
- Use environment variables for test credentials
- Consider using dedicated test accounts

## References

- [Playwright Authentication Guide](https://playwright.dev/docs/auth)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Storage State Documentation](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state) 