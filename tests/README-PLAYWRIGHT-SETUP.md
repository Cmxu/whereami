# Playwright Test Setup

## Overview
This document describes the Playwright test setup for the WhereAmI application.

## Configuration Changes
1. **Headless by default**: All tests run headless unless specifically configured otherwise
2. **Base URL**: Updated to use `https://whereami-5kp.pages.dev` (always contains the most up-to-date deployment)
3. **Authentication**: Simplified authentication setup using email/password flow with environment variables
4. **HTML Report**: HTML reports are generated but never auto-open to avoid interrupting workflow

## Environment Variables
Create a `.env` file in the project root with your test credentials:

```env
# Test credentials for Playwright
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
```

**Security Note**: The `.env` file is already in `.gitignore` so your credentials won't be committed to the repository.

## Running Tests

### All Tests (headless)
```bash
npx playwright test
```

### Specific Test File
```bash
npx playwright test tests/check-website-errors.spec.js
```

### With UI (headed) - Only for debugging
```bash
npx playwright test --headed
```

### Setup Authentication (headed mode for manual auth)
```bash
npx playwright test tests/auth.setup.ts --headed
```

### View HTML Report (when needed)
```bash
npx playwright show-report
```

## Authentication Setup
The authentication setup (`tests/auth.setup.ts`) will:
1. Navigate to `/gallery` which triggers authentication
2. Automatically fill in credentials from environment variables (`TEST_EMAIL` and `TEST_PASSWORD`)
3. Save authentication state to `playwright/.auth/user.json`
4. Run in headed mode locally to allow manual intervention if needed
5. Run headless in CI environments

## Test Structure
- **Setup project**: Handles authentication setup (headed locally, headless in CI)
- **Main browsers**: chromium, firefox, webkit (all run headless, use saved auth state)
- **No-auth project**: For tests that don't need authentication (headless)
- **API tests**: For API endpoint testing (headless)

## URLs
All tests now use `https://whereami-5kp.pages.dev` as the base URL, which always contains the most up-to-date deployment.

## Reports
- **Console output**: Uses list reporter for clean console output during test runs
- **HTML report**: Generated but never auto-opens (use `npx playwright show-report` to view when needed)
- **Screenshots**: Test screenshots are saved to `tests/screenshots/` for debugging and verification

## Environment Variables
- `CI`: When set, forces all tests including auth setup to run headless
- `TEST_EMAIL`: Email address for test authentication (defaults to fallback if not set)
- `TEST_PASSWORD`: Password for test authentication (defaults to fallback if not set)

## Screenshots
Test screenshots are saved to `tests/screenshots/` for debugging and verification. 