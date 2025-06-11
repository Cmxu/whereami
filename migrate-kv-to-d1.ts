/**
 * Migration script to move data from KV to D1 database
 * Run this script after setting up the D1 database and schema
 */

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { D1Utils } from './src/lib/db/d1-utils';

interface MigrationEnv {
  DB: D1Database;
  IMAGE_DATA: KVNamespace;
  USER_DATA: KVNamespace;
  GAME_DATA: KVNamespace;
}

interface KVUserData {
  id: string;
  username?: string;
  email?: string;
  avatar?: string;
  gamesCreated?: number;
  gamesPlayed?: number;
  totalScore?: number;
  averageScore?: number;
  joinedAt?: string;
  updatedAt?: string;
  imagesUploaded?: number;
}

interface KVImageData {
  id: string;
  filename: string;
  r2Key: string;
  location: { lat: number; lng: number };
  uploadedBy: string;
  uploadedByUsername?: string;
  uploadedAt: string;
  fileSize?: number;
  mimeType?: string;
  isPublic?: boolean;
  sourceUrl?: string;
  tags?: string[];
}

interface KVGameData {
  id: string;
  name: string;
  description?: string;
  imageIds: string[];
  createdBy: string;
  createdAt: string;
  isPublic?: boolean;
  playCount?: number;
  rating?: number;
  ratingCount?: number;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface MigrationStats {
  users: { total: number; migrated: number; failed: number };
  images: { total: number; migrated: number; failed: number };
  games: { total: number; migrated: number; failed: number };
  errors: string[];
}

class KVToD1Migrator {
  private db: D1Utils;
  private kvNamespaces: {
    imageData: KVNamespace;
    userData: KVNamespace;
    gameData: KVNamespace;
  };
  private stats: MigrationStats;

  constructor(env: MigrationEnv) {
    this.db = new D1Utils(env.DB);
    this.kvNamespaces = {
      imageData: env.IMAGE_DATA,
      userData: env.USER_DATA,
      gameData: env.GAME_DATA
    };
    this.stats = {
      users: { total: 0, migrated: 0, failed: 0 },
      images: { total: 0, migrated: 0, failed: 0 },
      games: { total: 0, migrated: 0, failed: 0 },
      errors: []
    };
  }

  async migrate(): Promise<MigrationStats> {
    console.log('🚀 Starting KV to D1 migration...');
    
    try {
      // Migrate in order: Users -> Images -> Games
      await this.migrateUsers();
      await this.migrateImages();
      await this.migrateGames();
      
      console.log('✅ Migration completed!');
      this.printStats();
      
      return this.stats;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.stats.errors.push(`Migration failed: ${error}`);
      throw error;
    }
  }

  private async migrateUsers(): Promise<void> {
    console.log('👥 Migrating users...');
    
    try {
      // Get all user keys
      const userKeys = await this.getAllKeysWithPrefix(this.kvNamespaces.userData, 'user:');
      const filteredUserKeys = userKeys.filter(key => !key.includes(':games') && !key.includes(':images'));
      
      this.stats.users.total = filteredUserKeys.length;
      console.log(`Found ${filteredUserKeys.length} users to migrate`);

      for (const key of filteredUserKeys) {
        try {
          const userData = await this.kvNamespaces.userData.get(key);
          if (!userData) continue;

          const user: KVUserData = JSON.parse(userData);
          
          // Check if user already exists in D1
          const existingUser = await this.db.users.getUserById(user.id);
          if (existingUser) {
            console.log(`User ${user.id} already exists, skipping...`);
            this.stats.users.migrated++;
            continue;
          }

          // Create user in D1
          await this.db.users.createUser({
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar
          });

          // Update stats if they exist
          if (user.gamesCreated || user.gamesPlayed || user.totalScore || user.imagesUploaded) {
            await this.db.users.incrementUserStats(user.id, {
              gamesCreated: user.gamesCreated,
              gamesPlayed: user.gamesPlayed,
              totalScore: user.totalScore,
              imagesUploaded: user.imagesUploaded
            });
          }

          this.stats.users.migrated++;
          console.log(`✅ Migrated user: ${user.username || user.id}`);
          
        } catch (error) {
          this.stats.users.failed++;
          const errorMsg = `Failed to migrate user ${key}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          this.stats.errors.push(errorMsg);
        }
      }
      
      console.log(`👥 Users migration complete: ${this.stats.users.migrated}/${this.stats.users.total}`);
    } catch (error) {
      console.error('❌ Users migration failed:', error);
      throw error;
    }
  }

  private async migrateImages(): Promise<void> {
    console.log('🖼️ Migrating images...');
    
    try {
      // Get all image keys
      const imageKeys = await this.getAllKeysWithPrefix(this.kvNamespaces.imageData, 'image:');
      
      this.stats.images.total = imageKeys.length;
      console.log(`Found ${imageKeys.length} images to migrate`);

      for (const key of imageKeys) {
        try {
          const imageData = await this.kvNamespaces.imageData.get(key);
          if (!imageData) continue;

          const image: KVImageData = JSON.parse(imageData);
          
          // Check if image already exists in D1
          const existingImage = await this.db.images.getImageById(image.id);
          if (existingImage) {
            console.log(`Image ${image.id} already exists, skipping...`);
            this.stats.images.migrated++;
            continue;
          }

          // Create image in D1
          await this.db.images.createImage({
            id: image.id,
            filename: image.filename,
            r2Key: image.r2Key,
            location: image.location,
            uploadedBy: image.uploadedBy,
            uploadedByUsername: image.uploadedByUsername,
            fileSize: image.fileSize,
            mimeType: image.mimeType,
            isPublic: image.isPublic,
            sourceUrl: image.sourceUrl,
            tags: image.tags
          });

          this.stats.images.migrated++;
          console.log(`✅ Migrated image: ${image.filename}`);
          
        } catch (error) {
          this.stats.images.failed++;
          const errorMsg = `Failed to migrate image ${key}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          this.stats.errors.push(errorMsg);
        }
      }
      
      console.log(`🖼️ Images migration complete: ${this.stats.images.migrated}/${this.stats.images.total}`);
    } catch (error) {
      console.error('❌ Images migration failed:', error);
      throw error;
    }
  }

  private async migrateGames(): Promise<void> {
    console.log('🎮 Migrating games...');
    
    try {
      // Get all game keys
      const gameKeys = await this.getAllKeysWithPrefix(this.kvNamespaces.gameData, 'game:');
      
      this.stats.games.total = gameKeys.length;
      console.log(`Found ${gameKeys.length} games to migrate`);

      for (const key of gameKeys) {
        try {
          const gameData = await this.kvNamespaces.gameData.get(key);
          if (!gameData) continue;

          const game: KVGameData = JSON.parse(gameData);
          
          // Check if game already exists in D1
          const existingGame = await this.db.games.getGameById(game.id);
          if (existingGame) {
            console.log(`Game ${game.id} already exists, skipping...`);
            this.stats.games.migrated++;
            continue;
          }

          // Create game in D1
          await this.db.games.createGame({
            id: game.id,
            name: game.name,
            description: game.description,
            imageIds: game.imageIds,
            createdBy: game.createdBy,
            isPublic: game.isPublic,
            tags: game.tags,
            difficulty: game.difficulty
          });

          // Update play count if it exists
          if (game.playCount && game.playCount > 0) {
            for (let i = 0; i < game.playCount; i++) {
              await this.db.games.incrementPlayCount(game.id);
            }
          }

          this.stats.games.migrated++;
          console.log(`✅ Migrated game: ${game.name}`);
          
        } catch (error) {
          this.stats.games.failed++;
          const errorMsg = `Failed to migrate game ${key}: ${error}`;
          console.error(`❌ ${errorMsg}`);
          this.stats.errors.push(errorMsg);
        }
      }
      
      console.log(`🎮 Games migration complete: ${this.stats.games.migrated}/${this.stats.games.total}`);
    } catch (error) {
      console.error('❌ Games migration failed:', error);
      throw error;
    }
  }

  private async getAllKeysWithPrefix(kv: KVNamespace, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;
    
    do {
      const result = await kv.list({ prefix, cursor });
      keys.push(...result.keys.map(k => k.name));
      cursor = result.list_complete ? undefined : result.keys[result.keys.length - 1]?.name;
    } while (cursor);
    
    return keys;
  }

  private printStats(): void {
    console.log('\n📊 Migration Statistics:');
    console.log('========================');
    console.log(`👥 Users: ${this.stats.users.migrated}/${this.stats.users.total} (${this.stats.users.failed} failed)`);
    console.log(`🖼️ Images: ${this.stats.images.migrated}/${this.stats.images.total} (${this.stats.images.failed} failed)`);
    console.log(`🎮 Games: ${this.stats.games.migrated}/${this.stats.games.total} (${this.stats.games.failed} failed)`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    const totalItems = this.stats.users.total + this.stats.images.total + this.stats.games.total;
    const totalMigrated = this.stats.users.migrated + this.stats.images.migrated + this.stats.games.migrated;
    const totalFailed = this.stats.users.failed + this.stats.images.failed + this.stats.games.failed;
    
    console.log(`\n📈 Overall: ${totalMigrated}/${totalItems} (${totalFailed} failed)`);
    console.log(`Success Rate: ${((totalMigrated / totalItems) * 100).toFixed(1)}%`);
  }
}

// Export function to run migration
export async function runMigration(env: MigrationEnv): Promise<MigrationStats> {
  const migrator = new KVToD1Migrator(env);
  return await migrator.migrate();
}

// Verification function to check data consistency
export async function verifyMigration(env: MigrationEnv): Promise<{
  consistent: boolean;
  discrepancies: string[];
}> {
  console.log('🔍 Verifying migration...');
  const discrepancies: string[] = [];
  
  try {
    const db = new D1Utils(env.DB);
    
    // Verify users
    const userKeys = await getAllKVKeys(env.USER_DATA, 'user:');
    const filteredUserKeys = userKeys.filter(key => !key.includes(':games') && !key.includes(':images'));
    
    for (const key of filteredUserKeys.slice(0, 10)) { // Sample check
      const kvData = await env.USER_DATA.get(key);
      if (kvData) {
        const kvUser = JSON.parse(kvData);
        const d1User = await db.users.getUserById(kvUser.id);
        if (!d1User) {
          discrepancies.push(`User ${kvUser.id} missing in D1`);
        }
      }
    }
    
    // Add more verification logic as needed...
    
    console.log(`✅ Verification complete. Found ${discrepancies.length} discrepancies.`);
    return {
      consistent: discrepancies.length === 0,
      discrepancies
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return {
      consistent: false,
      discrepancies: [`Verification error: ${error}`]
    };
  }
}

async function getAllKVKeys(kv: KVNamespace, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  
  do {
    const result = await kv.list({ prefix, cursor });
    keys.push(...result.keys.map(k => k.name));
    cursor = result.list_complete ? undefined : result.keys[result.keys.length - 1]?.name;
  } while (cursor);
  
  return keys;
} 