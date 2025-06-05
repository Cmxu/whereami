import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SavedGame, GameShareData, CustomGame, ImageMetadata } from '$lib/types';

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

export const GET = async ({ params, url, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.IMAGE_DATA || !env?.GAME_DATA) {
			return json(
				{ error: 'Server configuration error: KV stores not configured' },
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

		// Get game metadata from GAME_DATA namespace
		const game = await getGameMetadata(gameId, env);
		if (!game) {
			// For compatibility with saved games, also check GAME_DATA for saved games
			let savedGame: SavedGame | null = null;
			let shareData: GameShareData | null = null;

			// Check if this might be a saved game query
			const isShareToken = url.searchParams.get('shareToken');

			if (isShareToken === 'true' && env.GAME_DATA) {
				// Lookup by share token in GAME_DATA
				const shareDataStr = await env.GAME_DATA.get(`share_${gameId}`);
				if (shareDataStr) {
					shareData = JSON.parse(shareDataStr);

					// Increment access count
					if (shareData) {
						shareData.accessCount++;
						shareData.lastAccessedAt = new Date().toISOString();
						await env.GAME_DATA.put(`share_${gameId}`, JSON.stringify(shareData));

						// Get the actual game data
						const gameDataStr = await env.GAME_DATA.get(shareData.gameId);
						if (gameDataStr) {
							savedGame = JSON.parse(gameDataStr);
						}
					}
				}
			} else if (env.GAME_DATA) {
				// Try to lookup saved game by ID directly in GAME_DATA
				const gameDataStr = await env.GAME_DATA.get(gameId);
				if (gameDataStr) {
					savedGame = JSON.parse(gameDataStr);
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
			// Return game images
			const imagePromises = game.imageIds.map((id) => getImageMetadata(id, env));
			const imageResults = await Promise.all(imagePromises);
			const validImages = imageResults.filter((img) => img !== null) as ImageMetadata[];

			return json(validImages, {
				headers: { 'Access-Control-Allow-Origin': '*' }
			});
		}

		// Return game metadata
		return json(game, {
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
		if (!env?.IMAGE_DATA || !env?.USER_DATA || !env?.GAME_DATA) {
			return json(
				{ error: 'Server configuration error: KV stores not configured' },
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

		// Get game metadata
		const game = await getGameMetadata(gameId, env);
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

		// Delete game metadata from GAME_DATA
		await env.GAME_DATA.delete(`game:${gameId}`);

		// Remove from user's games list
		const userGamesKey = `user:${user.id}:games`;
		const userGamesData = await env.USER_DATA.get(userGamesKey);
		if (userGamesData) {
			const gamesList: string[] = JSON.parse(userGamesData);
			const updatedGamesList = gamesList.filter((id) => id !== gameId);
			await env.USER_DATA.put(userGamesKey, JSON.stringify(updatedGamesList));
		}

		// Remove from public games index if it was public
		if (game.isPublic) {
			const publicGamesKey = 'public_games_index';
			const existingPublicGamesStr = await env.GAME_DATA.get(publicGamesKey);
			if (existingPublicGamesStr) {
				const existingPublicGames = JSON.parse(existingPublicGamesStr);
				const updatedPublicGames = existingPublicGames.filter(
					(entry: any) => (entry.gameId || entry.id) !== gameId
				);
				await env.GAME_DATA.put(publicGamesKey, JSON.stringify(updatedPublicGames));
			}
		}

		// Update user's game count
		const userData = await getUserData(user.id, env);
		if (userData) {
			userData.gamesCreated = Math.max(0, (userData.gamesCreated || 1) - 1);
			userData.updatedAt = new Date().toISOString();
			await saveUserData(user.id, userData, env);
		}

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
