import type { D1Database } from '@cloudflare/workers-types';
import type { 
	UserProfile, 
	ImageMetadata, 
	CustomGame, 
	SavedGame, 
	GameRating, 
	GameComment,
	Location 
} from '$lib/types';

// Database utility functions for D1

// User operations
export class UserDB {
	constructor(private db: D1Database) {}

	async getUserById(userId: string): Promise<UserProfile | null> {
		const result = await this.db.prepare(
			'SELECT * FROM users WHERE id = ?'
		).bind(userId).first();

		if (!result) return null;

		return {
			id: result.id as string,
			username: result.username as string,
			email: result.email as string,
			avatar: result.avatar as string,
			gamesCreated: result.games_created as number,
			gamesPlayed: result.games_played as number,
			totalScore: result.total_score as number,
			averageScore: result.average_score as number,
			joinedAt: result.joined_at as string
		};
	}

	async getUserByUsername(username: string): Promise<UserProfile | null> {
		const result = await this.db.prepare(
			'SELECT * FROM users WHERE username = ?'
		).bind(username).first();

		if (!result) return null;

		return {
			id: result.id as string,
			username: result.username as string,
			email: result.email as string,
			avatar: result.avatar as string,
			gamesCreated: result.games_created as number,
			gamesPlayed: result.games_played as number,
			totalScore: result.total_score as number,
			averageScore: result.average_score as number,
			joinedAt: result.joined_at as string
		};
	}

	async createUser(user: {
		id: string;
		username?: string;
		email?: string;
		avatar?: string;
	}): Promise<UserProfile> {
		const now = new Date().toISOString();
		
		await this.db.prepare(`
			INSERT INTO users (id, username, email, avatar, joined_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`).bind(
			user.id,
			user.username || null,
			user.email || null,
			user.avatar || null,
			now,
			now
		).run();

		return {
			id: user.id,
			username: user.username || '',
			email: user.email || '',
			avatar: user.avatar || '',
			gamesCreated: 0,
			gamesPlayed: 0,
			totalScore: 0,
			averageScore: 0,
			joinedAt: now
		};
	}

	async updateUser(userId: string, updates: Partial<UserProfile>): Promise<void> {
		const now = new Date().toISOString();
		
		await this.db.prepare(`
			UPDATE users 
			SET username = COALESCE(?, username),
				email = COALESCE(?, email),
				avatar = COALESCE(?, avatar),
				games_created = COALESCE(?, games_created),
				games_played = COALESCE(?, games_played),
				total_score = COALESCE(?, total_score),
				average_score = COALESCE(?, average_score),
				updated_at = ?
			WHERE id = ?
		`).bind(
			updates.username || null,
			updates.email || null,
			updates.avatar || null,
			updates.gamesCreated || null,
			updates.gamesPlayed || null,
			updates.totalScore || null,
			updates.averageScore || null,
			now,
			userId
		).run();
	}

	async incrementUserStats(userId: string, stats: {
		gamesCreated?: number;
		gamesPlayed?: number;
		totalScore?: number;
		imagesUploaded?: number;
	}): Promise<void> {
		const now = new Date().toISOString();
		
		await this.db.prepare(`
			UPDATE users 
			SET games_created = games_created + COALESCE(?, 0),
				games_played = games_played + COALESCE(?, 0),
				total_score = total_score + COALESCE(?, 0),
				images_uploaded = images_uploaded + COALESCE(?, 0),
				updated_at = ?
			WHERE id = ?
		`).bind(
			stats.gamesCreated || 0,
			stats.gamesPlayed || 0,
			stats.totalScore || 0,
			stats.imagesUploaded || 0,
			now,
			userId
		).run();
	}

	async getUserGameStats(userId: string): Promise<{
		gamesPlayed: number;
		averageScore: number;
		bestScores: Array<{
			gameId: string;
			gameName: string;
			score: number;
			maxPossible: number;
			percentage: number;
			completedAt: string;
		}>;
	}> {
		// Get games played count and average score
		const statsResult = await this.db.prepare(`
			SELECT 
				COUNT(*) as gamesPlayed,
				AVG(ROUND((player_score * 100.0 / max_possible_score), 1)) as averageScore
			FROM game_sessions
			WHERE player_id = ?
		`).bind(userId).first();

		// Get best scores for each game
		const bestScoresResult = await this.db.prepare(`
			SELECT 
				gs.game_id as gameId,
				g.name as gameName,
				gs.player_score as score,
				gs.max_possible_score as maxPossible,
				ROUND((gs.player_score * 100.0 / gs.max_possible_score), 1) as percentage,
				gs.completed_at as completedAt
			FROM game_sessions gs
			JOIN games g ON gs.game_id = g.id
			WHERE gs.player_id = ? AND gs.game_id IS NOT NULL
			AND gs.percentage = (
				SELECT MAX(ROUND((gs2.player_score * 100.0 / gs2.max_possible_score), 1))
				FROM game_sessions gs2
				WHERE gs2.player_id = gs.player_id AND gs2.game_id = gs.game_id
			)
			ORDER BY percentage DESC
			LIMIT 10
		`).bind(userId).all();

		return {
			gamesPlayed: (statsResult?.gamesPlayed as number) || 0,
			averageScore: (statsResult?.averageScore as number) || 0,
			bestScores: bestScoresResult.results.map(row => ({
				gameId: row.gameId as string,
				gameName: row.gameName as string,
				score: row.score as number,
				maxPossible: row.maxPossible as number,
				percentage: row.percentage as number,
				completedAt: row.completedAt as string
			}))
		};
	}
}

// Image operations
export class ImageDB {
	constructor(private db: D1Database) {}

	async getImageById(imageId: string): Promise<ImageMetadata | null> {
		const result = await this.db.prepare(
			'SELECT * FROM images WHERE id = ?'
		).bind(imageId).first();

		if (!result) return null;

		return {
			id: result.id as string,
			filename: result.filename as string,
			r2Key: result.r2_key as string,
			location: { 
				lat: result.location_lat as number, 
				lng: result.location_lng as number 
			},
			uploadedBy: result.uploaded_by as string,
			uploadedByUsername: result.uploaded_by_username as string,
			uploadedAt: result.uploaded_at as string,
			isPublic: Boolean(result.is_public),
			tags: result.tags ? JSON.parse(result.tags as string) : [],
			sourceUrl: result.source_url as string
		};
	}

	async createImage(imageData: {
		id: string;
		filename: string;
		r2Key: string;
		location: Location;
		uploadedBy: string;
		uploadedByUsername?: string;
		fileSize?: number;
		mimeType?: string;
		isPublic?: boolean;
		sourceUrl?: string;
		tags?: string[];
	}): Promise<ImageMetadata> {
		const now = new Date().toISOString();
		
		await this.db.prepare(`
			INSERT INTO images (
				id, filename, r2_key, location_lat, location_lng, 
				uploaded_by, uploaded_by_username, uploaded_at, 
				file_size, mime_type, is_public, source_url, tags
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			imageData.id,
			imageData.filename,
			imageData.r2Key,
			imageData.location.lat,
			imageData.location.lng,
			imageData.uploadedBy,
			imageData.uploadedByUsername || null,
			now,
			imageData.fileSize || null,
			imageData.mimeType || null,
			imageData.isPublic !== false,
			imageData.sourceUrl || null,
			imageData.tags ? JSON.stringify(imageData.tags) : null
		).run();

		return {
			id: imageData.id,
			filename: imageData.filename,
			r2Key: imageData.r2Key,
			location: imageData.location,
			uploadedBy: imageData.uploadedBy,
			uploadedByUsername: imageData.uploadedByUsername || '',
			uploadedAt: now,
			isPublic: imageData.isPublic !== false,
			tags: imageData.tags || [],
			sourceUrl: imageData.sourceUrl
		};
	}

	async getUserImages(userId: string, limit = 50, offset = 0): Promise<ImageMetadata[]> {
		const results = await this.db.prepare(`
			SELECT * FROM images 
			WHERE uploaded_by = ? 
			ORDER BY uploaded_at DESC 
			LIMIT ? OFFSET ?
		`).bind(userId, limit, offset).all();

		return results.results.map(row => ({
			id: row.id as string,
			filename: row.filename as string,
			r2Key: row.r2_key as string,
			location: { 
				lat: row.location_lat as number, 
				lng: row.location_lng as number 
			},
			uploadedBy: row.uploaded_by as string,
			uploadedByUsername: row.uploaded_by_username as string,
			uploadedAt: row.uploaded_at as string,
			isPublic: Boolean(row.is_public),
			tags: row.tags ? JSON.parse(row.tags as string) : [],
			sourceUrl: row.source_url as string
		}));
	}

	async getPublicImages(limit = 50, offset = 0): Promise<ImageMetadata[]> {
		const results = await this.db.prepare(`
			SELECT * FROM images 
			WHERE is_public = true 
			ORDER BY uploaded_at DESC 
			LIMIT ? OFFSET ?
		`).bind(limit, offset).all();

		return results.results.map(row => ({
			id: row.id as string,
			filename: row.filename as string,
			r2Key: row.r2_key as string,
			location: { 
				lat: row.location_lat as number, 
				lng: row.location_lng as number 
			},
			uploadedBy: row.uploaded_by as string,
			uploadedByUsername: row.uploaded_by_username as string,
			uploadedAt: row.uploaded_at as string,
			isPublic: Boolean(row.is_public),
			tags: row.tags ? JSON.parse(row.tags as string) : [],
			sourceUrl: row.source_url as string
		}));
	}

	async getCuratedImages(curatorEmail: string, limit = 50, offset = 0): Promise<ImageMetadata[]> {
		const results = await this.db.prepare(`
			SELECT i.* FROM images i
			JOIN users u ON i.uploaded_by = u.id
			WHERE u.email = ? AND i.is_public = true
			ORDER BY i.uploaded_at DESC 
			LIMIT ? OFFSET ?
		`).bind(curatorEmail, limit, offset).all();

		return results.results.map(row => ({
			id: row.id as string,
			filename: row.filename as string,
			r2Key: row.r2_key as string,
			location: { 
				lat: row.location_lat as number, 
				lng: row.location_lng as number 
			},
			uploadedBy: row.uploaded_by as string,
			uploadedByUsername: row.uploaded_by_username as string,
			uploadedAt: row.uploaded_at as string,
			isPublic: Boolean(row.is_public),
			tags: row.tags ? JSON.parse(row.tags as string) : [],
			sourceUrl: row.source_url as string
		}));
	}

	async deleteImage(imageId: string): Promise<void> {
		await this.db.prepare('DELETE FROM images WHERE id = ?').bind(imageId).run();
	}

	// Counting methods for efficient pagination
	async getUserImagesCount(userId: string): Promise<number> {
		const result = await this.db.prepare(
			'SELECT COUNT(*) as count FROM images WHERE uploaded_by = ?'
		).bind(userId).first();
		return (result?.count as number) || 0;
	}

	async getPublicImagesCount(): Promise<number> {
		const result = await this.db.prepare(
			'SELECT COUNT(*) as count FROM images WHERE is_public = true'
		).first();
		return (result?.count as number) || 0;
	}

	async getCuratedImagesCount(curatorEmail: string): Promise<number> {
		const result = await this.db.prepare(`
			SELECT COUNT(*) as count FROM images i
			JOIN users u ON i.uploaded_by = u.id
			WHERE u.email = ? AND i.is_public = true
		`).bind(curatorEmail).first();
		return (result?.count as number) || 0;
	}
}

// Game operations
export class GameDB {
	constructor(private db: D1Database) {}

	async getGameById(gameId: string): Promise<CustomGame | null> {
		const gameResult = await this.db.prepare(
			'SELECT * FROM games WHERE id = ?'
		).bind(gameId).first();

		if (!gameResult) return null;

		// Get game images
		const imageResults = await this.db.prepare(`
			SELECT gi.image_id, gi.order_index 
			FROM game_images gi 
			WHERE gi.game_id = ? 
			ORDER BY gi.order_index
		`).bind(gameId).all();

		const imageIds = imageResults.results.map(row => row.image_id as string);

		return {
			id: gameResult.id as string,
			name: gameResult.name as string,
			description: gameResult.description as string,
			imageIds,
			createdBy: gameResult.created_by as string,
			createdAt: gameResult.created_at as string,
			isPublic: Boolean(gameResult.is_public),
			playCount: gameResult.play_count as number,
			rating: gameResult.rating as number,
			ratingCount: gameResult.rating_count as number,
			tags: gameResult.tags ? JSON.parse(gameResult.tags as string) : [],
			difficulty: gameResult.difficulty as 'easy' | 'medium' | 'hard'
		};
	}

	async createGame(gameData: {
		id: string;
		name: string;
		description?: string;
		imageIds: string[];
		createdBy: string;
		isPublic?: boolean;
		tags?: string[];
		difficulty?: 'easy' | 'medium' | 'hard';
	}): Promise<CustomGame> {
		const now = new Date().toISOString();
		
		// Start transaction
		await this.db.batch([
			// Insert game
			this.db.prepare(`
				INSERT INTO games (
					id, name, description, created_by, created_at, 
					updated_at, is_public, tags, difficulty
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`).bind(
				gameData.id,
				gameData.name,
				gameData.description || null,
				gameData.createdBy,
				now,
				now,
				gameData.isPublic || false,
				gameData.tags ? JSON.stringify(gameData.tags) : null,
				gameData.difficulty || null
			),
			// Insert game images
			...gameData.imageIds.map((imageId, index) =>
				this.db.prepare(`
					INSERT INTO game_images (game_id, image_id, order_index)
					VALUES (?, ?, ?)
				`).bind(gameData.id, imageId, index)
			)
		]);

		return {
			id: gameData.id,
			name: gameData.name,
			description: gameData.description,
			imageIds: gameData.imageIds,
			createdBy: gameData.createdBy,
			createdAt: now,
			isPublic: gameData.isPublic || false,
			playCount: 0,
			rating: 0,
			ratingCount: 0,
			tags: gameData.tags || [],
			difficulty: gameData.difficulty
		};
	}

	async getUserGames(userId: string, limit = 50, offset = 0): Promise<CustomGame[]> {
		const results = await this.db.prepare(`
			SELECT * FROM games 
			WHERE created_by = ? 
			ORDER BY created_at DESC 
			LIMIT ? OFFSET ?
		`).bind(userId, limit, offset).all();

		// Get image IDs for each game
		const games: CustomGame[] = [];
		for (const row of results.results) {
			const imageResults = await this.db.prepare(`
				SELECT image_id FROM game_images 
				WHERE game_id = ? 
				ORDER BY order_index
			`).bind(row.id).all();

			games.push({
				id: row.id as string,
				name: row.name as string,
				description: row.description as string,
				imageIds: imageResults.results.map(img => img.image_id as string),
				createdBy: row.created_by as string,
				createdAt: row.created_at as string,
				isPublic: Boolean(row.is_public),
				playCount: row.play_count as number,
				rating: row.rating as number,
				ratingCount: row.rating_count as number,
				tags: row.tags ? JSON.parse(row.tags as string) : [],
				difficulty: row.difficulty as 'easy' | 'medium' | 'hard'
			});
		}

		return games;
	}

	async getPublicGames(limit = 50, offset = 0): Promise<CustomGame[]> {
		const results = await this.db.prepare(`
			SELECT * FROM games 
			WHERE is_public = true 
			ORDER BY created_at DESC 
			LIMIT ? OFFSET ?
		`).bind(limit, offset).all();

		// Get image IDs for each game
		const games: CustomGame[] = [];
		for (const row of results.results) {
			const imageResults = await this.db.prepare(`
				SELECT image_id FROM game_images 
				WHERE game_id = ? 
				ORDER BY order_index
			`).bind(row.id).all();

			games.push({
				id: row.id as string,
				name: row.name as string,
				description: row.description as string,
				imageIds: imageResults.results.map(img => img.image_id as string),
				createdBy: row.created_by as string,
				createdAt: row.created_at as string,
				isPublic: Boolean(row.is_public),
				playCount: row.play_count as number,
				rating: row.rating as number,
				ratingCount: row.rating_count as number,
				tags: row.tags ? JSON.parse(row.tags as string) : [],
				difficulty: row.difficulty as 'easy' | 'medium' | 'hard'
			});
		}

		return games;
	}

	async incrementPlayCount(gameId: string): Promise<void> {
		await this.db.prepare(`
			UPDATE games 
			SET play_count = play_count + 1, updated_at = ?
			WHERE id = ?
		`).bind(new Date().toISOString(), gameId).run();
	}

	async deleteGame(gameId: string): Promise<void> {
		// Cascade delete will handle game_images
		await this.db.prepare('DELETE FROM games WHERE id = ?').bind(gameId).run();
	}

	// Counting methods for efficient pagination
	async getUserGamesCount(userId: string): Promise<number> {
		const result = await this.db.prepare(
			'SELECT COUNT(*) as count FROM games WHERE created_by = ?'
		).bind(userId).first();
		return (result?.count as number) || 0;
	}

	async getPublicGamesCount(): Promise<number> {
		const result = await this.db.prepare(
			'SELECT COUNT(*) as count FROM games WHERE is_public = true'
		).first();
		return (result?.count as number) || 0;
	}

	// Rating methods
	async getUserRating(gameId: string, userId: string): Promise<GameRating | null> {
		const result = await this.db.prepare(`
			SELECT * FROM game_ratings 
			WHERE game_id = ? AND user_id = ?
		`).bind(gameId, userId).first();

		if (!result) return null;

		return {
			gameId: result.game_id as string,
			userId: result.user_id as string,
			rating: result.rating as number,
			createdAt: result.created_at as string
		};
	}

	async upsertRating(gameId: string, userId: string, rating: number): Promise<GameRating> {
		const now = new Date().toISOString();
		
		// Use INSERT OR REPLACE to handle both create and update cases
		await this.db.prepare(`
			INSERT OR REPLACE INTO game_ratings (game_id, user_id, rating, created_at, updated_at)
			VALUES (?, ?, ?, 
				COALESCE((SELECT created_at FROM game_ratings WHERE game_id = ? AND user_id = ?), ?),
				?
			)
		`).bind(gameId, userId, rating, gameId, userId, now, now).run();

		// Update game's aggregate rating
		await this.updateGameRating(gameId);

		return {
			gameId,
			userId,
			rating,
			createdAt: now
		};
	}

	private async updateGameRating(gameId: string): Promise<void> {
		// Calculate average rating and count from all ratings for this game
		const result = await this.db.prepare(`
			SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count
			FROM game_ratings
			WHERE game_id = ?
		`).bind(gameId).first();

		if (result) {
			await this.db.prepare(`
				UPDATE games 
				SET rating = ?, rating_count = ?, updated_at = ?
				WHERE id = ?
			`).bind(
				result.avg_rating || 0,
				result.rating_count || 0,
				new Date().toISOString(),
				gameId
			).run();
		}
	}

	// Score/leaderboard methods
	async getGameLeaderboard(gameId: string, limit = 50): Promise<Array<{
		userId: string;
		playerScore: number;
		maxPossibleScore: number;
		percentage: number;
		completedAt: string;
	}>> {
		const results = await this.db.prepare(`
			SELECT 
				player_id as userId,
				player_score as playerScore,
				max_possible_score as maxPossibleScore,
				completed_at as completedAt,
				ROUND((player_score * 100.0 / max_possible_score), 1) as percentage
			FROM game_sessions
			WHERE game_id = ? AND player_id IS NOT NULL
			ORDER BY percentage DESC, completed_at ASC
			LIMIT ?
		`).bind(gameId, limit).all();

		return results.results.map(row => ({
			userId: row.userId as string,
			playerScore: row.playerScore as number,
			maxPossibleScore: row.maxPossibleScore as number,
			percentage: row.percentage as number,
			completedAt: row.completedAt as string
		}));
	}

	async getUserBestScore(gameId: string, userId: string): Promise<{
		playerScore: number;
		maxPossibleScore: number;
		percentage: number;
		completedAt: string;
	} | null> {
		const result = await this.db.prepare(`
			SELECT 
				player_score as playerScore,
				max_possible_score as maxPossibleScore,
				completed_at as completedAt,
				ROUND((player_score * 100.0 / max_possible_score), 1) as percentage
			FROM game_sessions
			WHERE game_id = ? AND player_id = ?
			ORDER BY percentage DESC, completed_at ASC
			LIMIT 1
		`).bind(gameId, userId).first();

		if (!result) return null;

		return {
			playerScore: result.playerScore as number,
			maxPossibleScore: result.maxPossibleScore as number,
			percentage: result.percentage as number,
			completedAt: result.completedAt as string
		};
	}
}

// Game session operations
export class GameSessionDB {
	constructor(private db: D1Database) {}

	async createSession(sessionData: {
		id: string;
		gameId?: string;
		gameType: 'random' | 'custom';
		playerId?: string;
		playerScore: number;
		maxPossibleScore: number;
		roundsData: any[];
		gameSettings?: any;
		shareToken?: string;
		isShared?: boolean;
	}): Promise<SavedGame> {
		const now = new Date().toISOString();
		
		await this.db.prepare(`
			INSERT INTO game_sessions (
				id, game_id, game_type, player_id, player_score, 
				max_possible_score, completed_at, rounds_data, 
				game_settings, share_token, is_shared
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`).bind(
			sessionData.id,
			sessionData.gameId || null,
			sessionData.gameType,
			sessionData.playerId || null,
			sessionData.playerScore,
			sessionData.maxPossibleScore,
			now,
			JSON.stringify(sessionData.roundsData),
			sessionData.gameSettings ? JSON.stringify(sessionData.gameSettings) : null,
			sessionData.shareToken || null,
			sessionData.isShared || false
		).run();

		return {
			id: sessionData.id,
			gameType: sessionData.gameType,
			customGameId: sessionData.gameId,
			imageIds: [], // Will be populated from rounds data
			rounds: sessionData.roundsData,
			playerScore: sessionData.playerScore,
			maxPossibleScore: sessionData.maxPossibleScore,
			completedAt: now,
			playedBy: sessionData.playerId,
			shareToken: sessionData.shareToken,
			isShared: sessionData.isShared || false,
			gameSettings: sessionData.gameSettings || { numRounds: 5, gameMode: sessionData.gameType }
		};
	}

	async getSessionById(sessionId: string): Promise<SavedGame | null> {
		const result = await this.db.prepare(
			'SELECT * FROM game_sessions WHERE id = ?'
		).bind(sessionId).first();

		if (!result) return null;

		const roundsData = JSON.parse(result.rounds_data as string);
		const gameSettings = result.game_settings ? JSON.parse(result.game_settings as string) : {};

		return {
			id: result.id as string,
			gameType: result.game_type as 'random' | 'custom',
			customGameId: result.game_id as string,
			imageIds: roundsData.map((round: any) => round.imageId),
			rounds: roundsData,
			playerScore: result.player_score as number,
			maxPossibleScore: result.max_possible_score as number,
			completedAt: result.completed_at as string,
			playedBy: result.player_id as string,
			shareToken: result.share_token as string,
			isShared: Boolean(result.is_shared),
			gameSettings
		};
	}

	async getSessionByShareToken(shareToken: string): Promise<SavedGame | null> {
		const result = await this.db.prepare(
			'SELECT * FROM game_sessions WHERE share_token = ?'
		).bind(shareToken).first();

		if (!result) return null;

		const roundsData = JSON.parse(result.rounds_data as string);
		const gameSettings = result.game_settings ? JSON.parse(result.game_settings as string) : {};

		return {
			id: result.id as string,
			gameType: result.game_type as 'random' | 'custom',
			customGameId: result.game_id as string,
			imageIds: roundsData.map((round: any) => round.imageId),
			rounds: roundsData,
			playerScore: result.player_score as number,
			maxPossibleScore: result.max_possible_score as number,
			completedAt: result.completed_at as string,
			playedBy: result.player_id as string,
			shareToken: result.share_token as string,
			isShared: Boolean(result.is_shared),
			gameSettings
		};
	}
}

// Main DB utility class
export class D1Utils {
	public users: UserDB;
	public images: ImageDB;
	public games: GameDB;
	public sessions: GameSessionDB;

	constructor(db: D1Database) {
		this.users = new UserDB(db);
		this.images = new ImageDB(db);
		this.games = new GameDB(db);
		this.sessions = new GameSessionDB(db);
	}
} 