# KV to D1 Migration Guide

This guide will help you migrate your WhereAmI application from Cloudflare KV to D1 database for better relational data management.

## Prerequisites

- [x] Wrangler CLI installed and authenticated
- [x] Existing KV data in your WhereAmI application
- [x] Admin access to your Cloudflare account

## Step 1: Create D1 Database

First, create your D1 database:

```bash
# Create the database
wrangler d1 create whereami-db

# Copy the database ID from the output
# It will look like: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## Step 2: Update Configuration

Update your `wrangler.toml` file with the D1 database configuration:

```toml
# Add this to your existing wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "whereami-db"
database_id = "your-actual-database-id-here"  # Replace with your actual ID
```

## Step 3: Initialize Database Schema

Run the schema to create all necessary tables:

```bash
# Apply the schema to your D1 database
wrangler d1 execute whereami-db --file=schema.sql
```

You can verify the schema was applied:

```bash
# List tables
wrangler d1 execute whereami-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## Step 4: Run Migration

### Option A: Automated Migration (Recommended)

```bash
# Run the migration script
node run-migration.js
```

This will:
- Check prerequisites
- Create a temporary migration worker
- Run the full migration
- Provide detailed statistics
- Clean up temporary files

### Option B: Manual Migration

If you prefer more control, you can run the migration manually:

```bash
# Deploy a migration worker manually
wrangler deploy migrate-kv-to-d1.ts --name migration-worker

# Trigger the migration
curl https://migration-worker.YOUR_SUBDOMAIN.workers.dev/migrate
```

## Step 5: Verify Migration

After migration, verify your data:

```bash
# Check user count
wrangler d1 execute whereami-db --command="SELECT COUNT(*) as user_count FROM users;"

# Check image count  
wrangler d1 execute whereami-db --command="SELECT COUNT(*) as image_count FROM images;"

# Check game count
wrangler d1 execute whereami-db --command="SELECT COUNT(*) as game_count FROM games;"

# Check a sample user
wrangler d1 execute whereami-db --command="SELECT * FROM users LIMIT 1;"
```

## Step 6: Update Your Application Code

Now you need to update your API routes to use D1 instead of KV. Here's an example of how to update an API route:

### Before (KV):
```typescript
// Old KV approach
const userData = await env.USER_DATA.get(`user:${userId}`);
const user = userData ? JSON.parse(userData) : null;
```

### After (D1):
```typescript
// New D1 approach
import { D1Utils } from '$lib/db/d1-utils';

const db = new D1Utils(env.DB);
const user = await db.users.getUserById(userId);
```

## Step 7: Update Package Scripts

Update your `package.json` dev script to include D1:

```json
{
  "scripts": {
    "dev:functions": "npm run build && wrangler pages dev .svelte-kit/cloudflare --d1 DB --r2 IMAGES_BUCKET --kv IMAGE_DATA --kv USER_DATA --port 8788"
  }
}
```

## Step 8: Test Your Application

1. **Start your development server:**
   ```bash
   npm run dev:functions
   ```

2. **Test key functionality:**
   - [ ] User authentication and profile creation
   - [ ] Image upload and metadata storage
   - [ ] Game creation and management
   - [ ] Game playing and score storage
   - [ ] Public image and game browsing

3. **Check browser network tab for any API errors**

## Step 9: Update API Routes (Gradual Migration)

Update your API routes one by one. Here are the key files to update:

### Priority Order:
1. `src/routes/api/images/upload-simple/+server.ts` - Image uploads
2. `src/routes/api/user/profile/+server.ts` - User profiles  
3. `src/routes/api/games/create/+server.ts` - Game creation
4. `src/routes/api/games/[gameId]/+server.ts` - Game retrieval
5. All other game and image API routes

### Example Migration Pattern:

```typescript
// 1. Import D1 utilities
import { D1Utils } from '$lib/db/d1-utils';

// 2. Initialize D1 in your handler
const db = new D1Utils(env.DB);

// 3. Replace KV calls with D1 calls
// OLD: const userData = await env.USER_DATA.get(`user:${userId}`);
// NEW: const userData = await db.users.getUserById(userId);

// 4. Keep KV as fallback during transition (optional)
let user = await db.users.getUserById(userId);
if (!user) {
  // Fallback to KV for users not yet migrated
  const kvData = await env.USER_DATA.get(`user:${userId}`);
  if (kvData) {
    const kvUser = JSON.parse(kvData);
    // Migrate this user to D1 on-the-fly
    user = await db.users.createUser(kvUser);
  }
}
```

## Step 10: Deploy and Monitor

1. **Deploy your application:**
   ```bash
   npm run build && npx wrangler pages deploy .svelte-kit/cloudflare
   ```

2. **Monitor for errors:**
   - Check Cloudflare dashboard for Worker errors
   - Monitor application logs
   - Test all critical user flows

## Step 11: Clean Up (After Verification)

After confirming everything works correctly for at least a week:

1. **Remove KV fallback code** from your API routes
2. **Update wrangler.toml** to remove KV bindings (optional, keep as backup)
3. **Update package.json** dev script to remove KV bindings

## Rollback Plan

If you need to rollback:

1. **Revert your API routes** to use KV again
2. **Redeploy** your application
3. **Your KV data is untouched** and ready to use

## Migration Benefits

After migration, you'll have:

- ✅ **Better Performance**: SQL queries are often faster than KV lookups
- ✅ **Relational Data**: Proper foreign keys and relationships
- ✅ **Complex Queries**: Sort, filter, and join data easily  
- ✅ **Atomic Transactions**: Ensure data consistency
- ✅ **Better Analytics**: Query your data directly with SQL
- ✅ **Scalability**: D1 can handle more complex data operations

## Troubleshooting

### Common Issues:

**Migration fails with "Database not found"**
- Ensure you created the D1 database: `wrangler d1 create whereami-db`
- Verify the database ID in `wrangler.toml` matches the created database

**Schema errors**
- Make sure you ran: `wrangler d1 execute whereami-db --file=schema.sql`
- Check for SQL syntax errors in `schema.sql`

**API errors after migration**
- Check that all API routes are updated to use D1Utils
- Verify environment bindings in `wrangler.toml`
- Check browser console for specific error messages

**Performance issues**
- Ensure all indexes are created (they're in `schema.sql`)
- Consider adding more specific indexes for your query patterns

### Getting Help:

- Check Cloudflare D1 documentation: https://developers.cloudflare.com/d1/
- Review the migration logs for specific error messages
- Test API endpoints individually to isolate issues

## Summary

This migration will modernize your data layer and provide better performance and capabilities. The process is designed to be safe with your existing KV data remaining as a backup.

Key commands to remember:
```bash
# Create database
wrangler d1 create whereami-db

# Apply schema  
wrangler d1 execute whereami-db --file=schema.sql

# Run migration
node run-migration.js

# Verify data
wrangler d1 execute whereami-db --command="SELECT COUNT(*) FROM users;"
``` 