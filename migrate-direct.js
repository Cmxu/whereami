/**
 * Direct KV to D1 Migration Script
 * This runs locally using wrangler commands to migrate your data
 */

import { execSync } from 'child_process';
import fs from 'fs';

// Helper function to execute wrangler commands
function execWrangler(command) {
  try {
    const result = execSync(command, { encoding: 'utf8' });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

// Get all KV keys with a prefix
async function getKVKeys(namespace, prefix = '') {
  const command = `wrangler kv key list --namespace-id="${namespace}" --prefix="${prefix}"`;
  const result = execWrangler(command);
  
  if (!result.success) {
    console.error(`Failed to list KV keys: ${result.error}`);
    return [];
  }
  
  try {
    const keys = JSON.parse(result.output);
    return keys.map(k => k.name);
  } catch (error) {
    console.error('Failed to parse KV keys:', error);
    return [];
  }
}

// Get KV value
async function getKVValue(namespace, key) {
  const command = `wrangler kv key get "${key}" --namespace-id="${namespace}"`;
  const result = execWrangler(command);
  
  if (!result.success) {
    return null;
  }
  
  try {
    return JSON.parse(result.output);
  } catch (error) {
    // Return raw value if not JSON
    return result.output.trim();
  }
}

// Execute D1 command
function executeD1(query, params = []) {
  // Escape single quotes in the query and parameters
  const escapedQuery = query.replace(/'/g, "''");
  const command = `wrangler d1 execute whereami-db --command="${escapedQuery}"`;
  
  const result = execWrangler(command);
  return result;
}

// KV namespace IDs from your wrangler.toml
const KV_NAMESPACES = {
  IMAGE_DATA: 'ed09b9a23eeb4a58b500f03e636ea811',
  USER_DATA: '7fb86fe8775e461996350c8f2dc6f86b',
  GAME_DATA: '8b8aaaeb40844b2c9591c98860b9dd47'
};

// Migration statistics
const stats = {
  users: { total: 0, migrated: 0, failed: 0 },
  images: { total: 0, migrated: 0, failed: 0 },
  games: { total: 0, migrated: 0, failed: 0 },
  errors: []
};

// Migrate users
async function migrateUsers() {
  console.log('👥 Migrating users...');
  
  const userKeys = await getKVKeys(KV_NAMESPACES.USER_DATA, 'user:');
  const filteredUserKeys = userKeys.filter(key => !key.includes(':games') && !key.includes(':images'));
  
  stats.users.total = filteredUserKeys.length;
  console.log(`Found ${filteredUserKeys.length} users to migrate`);

  for (const key of filteredUserKeys) {
    try {
      const userData = await getKVValue(KV_NAMESPACES.USER_DATA, key);
      if (!userData) continue;

      const user = typeof userData === 'string' ? JSON.parse(userData) : userData;
      
      // Insert user into D1
      const insertQuery = `
        INSERT OR IGNORE INTO users (
          id, username, email, avatar, games_created, games_played, 
          total_score, average_score, images_uploaded, joined_at, updated_at
        ) VALUES (
          '${user.id || ''}', 
          ${user.username ? `'${user.username.replace(/'/g, "''")}'` : 'NULL'}, 
          ${user.email ? `'${user.email.replace(/'/g, "''")}'` : 'NULL'}, 
          ${user.avatar ? `'${user.avatar.replace(/'/g, "''")}'` : 'NULL'}, 
          ${user.gamesCreated || 0}, 
          ${user.gamesPlayed || 0}, 
          ${user.totalScore || 0}, 
          ${user.averageScore || 0}, 
          ${user.imagesUploaded || 0}, 
          '${user.joinedAt || new Date().toISOString()}', 
          '${new Date().toISOString()}'
        )
      `;

      const result = executeD1(insertQuery);
      if (result.success) {
        stats.users.migrated++;
        console.log(`✅ Migrated user: ${user.username || user.id || 'Unknown'}`);
      } else {
        stats.users.failed++;
        console.error(`❌ Failed to migrate user ${key}: ${result.error}`);
        stats.errors.push(`User ${key}: ${result.error}`);
      }
      
    } catch (error) {
      stats.users.failed++;
      console.error(`❌ Error processing user ${key}:`, error);
      stats.errors.push(`User ${key}: ${error.message}`);
    }
  }
  
  console.log(`👥 Users migration complete: ${stats.users.migrated}/${stats.users.total}`);
}

// Migrate images
async function migrateImages() {
  console.log('🖼️ Migrating images...');
  
  const imageKeys = await getKVKeys(KV_NAMESPACES.IMAGE_DATA, 'image:');
  
  stats.images.total = imageKeys.length;
  console.log(`Found ${imageKeys.length} images to migrate`);

  for (const key of imageKeys) {
    try {
      const imageData = await getKVValue(KV_NAMESPACES.IMAGE_DATA, key);
      if (!imageData) continue;

      const image = typeof imageData === 'string' ? JSON.parse(imageData) : imageData;
      
      // Insert image into D1
      const insertQuery = `
        INSERT OR IGNORE INTO images (
          id, filename, r2_key, location_lat, location_lng, 
          uploaded_by, uploaded_by_username, uploaded_at, 
          file_size, mime_type, is_public, source_url, tags
        ) VALUES (
          '${image.id || ''}', 
          '${(image.filename || '').replace(/'/g, "''")}', 
          '${(image.r2Key || '').replace(/'/g, "''")}', 
          ${image.location?.lat || 0}, 
          ${image.location?.lng || 0}, 
          '${image.uploadedBy || ''}', 
          ${image.uploadedByUsername ? `'${image.uploadedByUsername.replace(/'/g, "''")}'` : 'NULL'}, 
          '${image.uploadedAt || new Date().toISOString()}', 
          ${image.fileSize || 0}, 
          ${image.mimeType ? `'${image.mimeType.replace(/'/g, "''")}'` : 'NULL'}, 
          ${image.isPublic !== false ? 1 : 0}, 
          ${image.sourceUrl ? `'${image.sourceUrl.replace(/'/g, "''")}'` : 'NULL'}, 
          ${image.tags ? `'${JSON.stringify(image.tags).replace(/'/g, "''")}'` : 'NULL'}
        )
      `;

      const result = executeD1(insertQuery);
      if (result.success) {
        stats.images.migrated++;
        console.log(`✅ Migrated image: ${image.filename || image.id}`);
      } else {
        stats.images.failed++;
        console.error(`❌ Failed to migrate image ${key}: ${result.error}`);
        stats.errors.push(`Image ${key}: ${result.error}`);
      }
      
    } catch (error) {
      stats.images.failed++;
      console.error(`❌ Error processing image ${key}:`, error);
      stats.errors.push(`Image ${key}: ${error.message}`);
    }
  }
  
  console.log(`🖼️ Images migration complete: ${stats.images.migrated}/${stats.images.total}`);
}

// Migrate games
async function migrateGames() {
  console.log('🎮 Migrating games...');
  
  const gameKeys = await getKVKeys(KV_NAMESPACES.GAME_DATA, 'game:');
  
  stats.games.total = gameKeys.length;
  console.log(`Found ${gameKeys.length} games to migrate`);

  for (const key of gameKeys) {
    try {
      const gameData = await getKVValue(KV_NAMESPACES.GAME_DATA, key);
      if (!gameData) continue;

      const game = typeof gameData === 'string' ? JSON.parse(gameData) : gameData;
      
      // Insert game into D1
      const insertQuery = `
        INSERT OR IGNORE INTO games (
          id, name, description, created_by, created_by_username,
          created_at, updated_at, is_public, play_count, rating, 
          rating_count, tags, difficulty
        ) VALUES (
          '${game.id || ''}', 
          '${(game.name || '').replace(/'/g, "''")}', 
          ${game.description ? `'${game.description.replace(/'/g, "''")}'` : 'NULL'}, 
          '${game.createdBy || ''}', 
          ${game.createdByUsername ? `'${game.createdByUsername.replace(/'/g, "''")}'` : 'NULL'}, 
          '${game.createdAt || new Date().toISOString()}', 
          '${new Date().toISOString()}', 
          ${game.isPublic ? 1 : 0}, 
          ${game.playCount || 0}, 
          ${game.rating || 0}, 
          ${game.ratingCount || 0}, 
          ${game.tags ? `'${JSON.stringify(game.tags).replace(/'/g, "''")}'` : 'NULL'}, 
          ${game.difficulty ? `'${game.difficulty}'` : 'NULL'}
        )
      `;

      const result = executeD1(insertQuery);
      if (result.success) {
        // Insert game images
        if (game.imageIds && Array.isArray(game.imageIds)) {
          for (let i = 0; i < game.imageIds.length; i++) {
            const imageInsertQuery = `
              INSERT OR IGNORE INTO game_images (game_id, image_id, order_index)
              VALUES ('${game.id}', '${game.imageIds[i]}', ${i})
            `;
            executeD1(imageInsertQuery);
          }
        }
        
        stats.games.migrated++;
        console.log(`✅ Migrated game: ${game.name || game.id}`);
      } else {
        stats.games.failed++;
        console.error(`❌ Failed to migrate game ${key}: ${result.error}`);
        stats.errors.push(`Game ${key}: ${result.error}`);
      }
      
    } catch (error) {
      stats.games.failed++;
      console.error(`❌ Error processing game ${key}:`, error);
      stats.errors.push(`Game ${key}: ${error.message}`);
    }
  }
  
  console.log(`🎮 Games migration complete: ${stats.games.migrated}/${stats.games.total}`);
}

// Print final statistics
function printStats() {
  console.log('\n📊 Migration Statistics:');
  console.log('========================');
  console.log(`👥 Users: ${stats.users.migrated}/${stats.users.total} (${stats.users.failed} failed)`);
  console.log(`🖼️ Images: ${stats.images.migrated}/${stats.images.total} (${stats.images.failed} failed)`);
  console.log(`🎮 Games: ${stats.games.migrated}/${stats.games.total} (${stats.games.failed} failed)`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.slice(0, 10).forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`... and ${stats.errors.length - 10} more errors`);
    }
  }
  
  const totalItems = stats.users.total + stats.images.total + stats.games.total;
  const totalMigrated = stats.users.migrated + stats.images.migrated + stats.games.migrated;
  const totalFailed = stats.users.failed + stats.images.failed + stats.games.failed;
  
  console.log(`\n📈 Overall: ${totalMigrated}/${totalItems} (${totalFailed} failed)`);
  if (totalItems > 0) {
    console.log(`Success Rate: ${((totalMigrated / totalItems) * 100).toFixed(1)}%`);
  }
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting KV to D1 migration...');
  
  try {
    await migrateUsers();
    await migrateImages();
    await migrateGames();
    
    console.log('\n✅ Migration completed!');
    printStats();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run the migration
runMigration(); 