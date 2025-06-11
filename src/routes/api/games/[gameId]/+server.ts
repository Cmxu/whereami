import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SavedGame, GameShareData, CustomGame, ImageMetadata } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

interface AuthenticatedUser {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

// Extract JWT token from request headers
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (authHeader?.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}
	return null;
}

// Verify Supabase JWT token
async function verifySupabaseToken(token: string, env: any): Promise<AuthenticatedUser | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const payload = JSON.parse(atob(parts[1]));

		if (payload.exp && payload.exp < Date.now() / 1000) {
			return null;
		}

		if (payload.iss !== env.PUBLIC_SUPABASE_URL + '/auth/v1') {
			return null;
		}

		return {
			id: payload.sub,
			email: payload.email,
			firstName: payload.user_metadata?.first_name,
			lastName: payload.user_metadata?.last_name,
			username: payload.user_metadata?.username || payload.email?.split('@')[0]
		};
	} catch (error) {
		console.error('Token verification failed:', error);
		return null;
	}
}

// Get game metadata from GAME_DATA namespace
async function getGameMetadata(gameId: string, env: any): Promise<CustomGame | null> {
	try {
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		return gameData ? JSON.parse(gameData) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

// Get image metadata from IMAGE_DATA namespace
async function getImageMetadata(imageId: string, env: any): Promise<ImageMetadata | null> {
	try {
		const imageData = await env.IMAGE_DATA.get(`image:${imageId}`);
		return imageData ? JSON.parse(imageData) : null;
	} catch (error) {
		console.error('Error getting image metadata:', error);
		return null;
	}
}

// Get user data from USER_DATA namespace
async function getUserData(userId: string, env: any): Promise<any | null> {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		return userData ? JSON.parse(userData) : null;
	} catch (error) {
		console.error('Error getting user data:', error);
		return null;
	}
}

// Save user data to USER_DATA namespace
async function saveUserData(userId: string, userData: any, env: any): Promise<boolean> {
	try {
		await env.USER_DATA.put(`user:${userId}`, JSON.stringify(userData));
		return true;
	} catch (error) {
		console.error('Error saving user data:', error);
		return false;
	}
}

// Helper function to get user profile data including display name and profile picture
async function getUserProfile(
	userId: string,
	env: any
): Promise<{
	displayName: string;
	profilePicture: string | null;
	createdAt: string | null;
}> {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		if (userData) {
			const profile = JSON.parse(userData);
			return {
				displayName: profile.displayName || profile.username || profile.email || 'Anonymous',
				profilePicture: profile.profilePicture || null,
				createdAt: profile.createdAt || null
			};
		}
		return {
			displayName: 'Anonymous',
			profilePicture: null,
			createdAt: null
		};
	} catch (error) {
		console.error('Error getting user profile:', error);
		return {
			displayName: 'Anonymous',
			profilePicture: null,
			createdAt: null
		};
	}
}

export const GET = async ({ params, url, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: D1 database not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const { gameId } = params;
		if (!gameId) {
			return json(
				{ error: 'Game ID required' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get game metadata from D1
		const game = await db.games.getGameById(gameId);
		if (!game) {
			// For compatibility with saved games, also check for saved game sessions
			let savedGame: SavedGame | null = null;
			let shareData: GameShareData | null = null;

			// Check if this might be a saved game query
			const isShareToken = url.searchParams.get('shareToken');

			if (isShareToken === 'true') {
				// Try to find a session by share token
				const session = await db.sessions.getSessionByShareToken(gameId);
				if (session) {
					// Convert session to saved game format
					savedGame = session;
					shareData = {
						gameId: session.id,
						shareToken: session.shareToken || gameId,
						accessCount: 1, // This could be enhanced in D1Utils if needed
						lastAccessedAt: new Date().toISOString(),
						createdAt: session.completedAt
					};
				}
			} else {
				// Try to lookup saved game session by ID directly
				const session = await db.sessions.getSessionById(gameId);
				if (session) {
					savedGame = session;
				}
			}

			// If we found a saved game, return that instead
			if (savedGame) {
				return json(
					{
						game: savedGame,
						shareData: shareData
					},
					{
						headers: { 'Access-Control-Allow-Origin': '*' }
					}
				);
			}

			// No game found at all
			return json(
				{ error: 'Game not found' },
				{
					status: 404,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Check if requesting game images
		const isImagesRequest = url.pathname.endsWith('/images');

		if (isImagesRequest) {
			// Return game images by getting each image metadata
			const imagePromises = game.imageIds.map((id) => db.images.getImageById(id));
			const imageResults = await Promise.all(imagePromises);
			const validImages = imageResults.filter((img) => img !== null) as ImageMetadata[];

			return json(validImages, {
				headers: { 'Access-Control-Allow-Origin': '*' }
			});
		}

		// Get creator profile data and enrich game metadata
		const creatorUserId = game.createdBy; // Store original user ID
		const creatorProfile = await db.users.getUserById(game.createdBy);
		
		const enrichedGame = {
			...game,
			createdBy: creatorProfile?.username || creatorProfile?.email || 'Anonymous',
			createdByUserId: creatorUserId, // Keep the original user ID
			creatorProfilePicture: creatorProfile?.avatar || null,
			creatorJoinedAt: creatorProfile?.joinedAt || null
		};

		// Return enriched game metadata
		return json(enrichedGame, {
			headers: { 'Access-Control-Allow-Origin': '*' }
		});
	} catch (error) {
		console.error('Error retrieving game:', error);
		return json(
			{ error: 'Failed to retrieve game' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};

export const DELETE = async ({ params, request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: D1 database not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const { gameId } = params;
		if (!gameId) {
			return json(
				{ error: 'Game ID required' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Require authentication
		const token = extractToken(request);
		if (!token) {
			return json(
				{ error: 'Authentication required' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const user = await verifySupabaseToken(token, env);
		if (!user) {
			return json(
				{ error: 'Invalid authentication token' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get game metadata from D1
		const game = await db.games.getGameById(gameId);
		if (!game) {
			return json(
				{ error: 'Game not found' },
				{
					status: 404,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Check if user owns this game
		if (game.createdBy !== user.id) {
			return json(
				{ error: 'You can only delete your own games' },
				{
					status: 403,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Delete game from D1 (cascade will handle game_images)
		await db.games.deleteGame(gameId);

		// Update user's game count
		await db.users.incrementUserStats(user.id, { gamesCreated: -1 });

		return json(
			{ success: true, message: 'Game deleted successfully' },
			{
				status: 200,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error deleting game:', error);
		return json(
			{ error: 'Failed to delete game' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};

export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
