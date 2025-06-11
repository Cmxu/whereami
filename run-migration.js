/**
 * Simple script to run the KV to D1 migration
 * Usage: node run-migration.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';

// Function to run migration via Wrangler
function runMigration() {
  console.log('🚀 Starting KV to D1 migration...');
  
  try {
    // Create temporary migration handler
    const migrationScript = `
import { runMigration } from '../migrate-kv-to-d1.js';

export default {
  async fetch(request, env) {
    if (request.url.includes('/migrate')) {
      try {
        const stats = await runMigration(env);
        return new Response(JSON.stringify({
          success: true,
          stats
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Migration endpoint. Use /migrate to start migration.');
  }
};
`;

    // Write temporary migration worker
    fs.writeFileSync('_temp_migration_worker.js', migrationScript);
    
    console.log('📦 Deploying temporary migration worker...');
    
    // Deploy the migration worker
    execSync('wrangler deploy _temp_migration_worker.js --name migration-worker --compatibility-date 2023-05-18', {
      stdio: 'inherit'
    });
    
    console.log('🔄 Running migration...');
    
    // Trigger the migration
    execSync('curl -X GET https://migration-worker.YOUR_SUBDOMAIN.workers.dev/migrate', {
      stdio: 'inherit'
    });
    
    console.log('✅ Migration completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    // Clean up temporary files
    if (fs.existsSync('_temp_migration_worker.js')) {
      fs.unlinkSync('_temp_migration_worker.js');
    }
  }
}

// Check if we have the required setup
function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');
  
  // Check if D1 database exists
  try {
    execSync('wrangler d1 list', { stdio: 'pipe' });
    console.log('✅ Wrangler CLI is working');
  } catch (error) {
    console.error('❌ Wrangler CLI not found or not authenticated');
    console.log('Please run: npm install -g wrangler && wrangler login');
    process.exit(1);
  }
  
  // Check if wrangler.toml exists
  if (!fs.existsSync('wrangler.toml')) {
    console.error('❌ wrangler.toml not found');
    process.exit(1);
  }
  
  console.log('✅ Prerequisites checked');
}

// Main execution
function main() {
  console.log('📋 KV to D1 Migration Tool');
  console.log('==========================');
  
  checkPrerequisites();
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('1. Make sure you have created your D1 database: wrangler d1 create whereami-db');
  console.log('2. Update wrangler.toml with your D1 database ID');
  console.log('3. Run the schema: wrangler d1 execute whereami-db --file=schema.sql');
  console.log('4. This migration will NOT delete your KV data (it will remain as backup)');
  console.log('5. Test thoroughly before switching your app to use D1\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Are you ready to proceed? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      rl.close();
      runMigration();
    } else {
      console.log('Migration cancelled.');
      rl.close();
    }
  });
}

main(); 