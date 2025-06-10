import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';

interface CreateGameRequest {
	name: string;
	description?: string;
	imageIds: string[];
	isPublic?: boolean;
	tags?: string[];
	difficulty?: 'easy' | 'medium' | 'hard';
}

interface AuthenticatedUser {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

// Extract token from Authorization header
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader?.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
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

// Generate unique ID for game
function generateGameId(): string {
	return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get image metadata from KV
async function getImageMetadata(imageId: string, env: any) {
	try {
		const imageData = await env.IMAGE_DATA.get(`image:${imageId}`);
		return imageData ? JSON.parse(imageData) : null;
	} catch (error) {
		console.error('Error getting image metadata:', error);
		return null;
	}
}

// Get user data from KV
async function getUserData(userId: string, env: any) {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		return userData ? JSON.parse(userData) : null;
	} catch (error) {
		console.error('Error getting user data:', error);
		return null;
	}
}

// Save user data to KV
async function saveUserData(userId: string, userData: any, env: any) {
	try {
		await env.USER_DATA.put(`user:${userId}`, JSON.stringify(userData));
		return true;
	} catch (error) {
		console.error('Error saving user data:', error);
		return false;
	}
}

export const POST = async ({ request, platform }: RequestEvent) => {
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

		// Parse request body
		const gameData: CreateGameRequest = await request.json();

		// Validate required fields
		if (!gameData.name || !gameData.imageIds || !Array.isArray(gameData.imageIds)) {
			return json(
				{ error: 'Name and imageIds are required' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		if (gameData.imageIds.length < 3) {
			return json(
				{ error: 'At least 3 images are required for a game' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// No maximum limit on images per game

		// Validate that all images exist and belong to the user
		const imagePromises = gameData.imageIds.map((id) => getImageMetadata(id, env));
		const imageResults = await Promise.all(imagePromises);
		const validImages = imageResults.filter((img) => img !== null);

		if (validImages.length !== gameData.imageIds.length) {
			return json(
				{ error: 'One or more images not found' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Check if all images belong to the user
		const unauthorizedImages = validImages.filter((img) => img!.uploadedBy !== user.id);
		if (unauthorizedImages.length > 0) {
			return json(
				{ error: 'You can only create games with your own photos' },
				{
					status: 403,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Generate game ID
		const gameId = generateGameId();

		// Create game metadata
		const game: CustomGame = {
			id: gameId,
			name: gameData.name.trim(),
			description: gameData.description?.trim(),
			imageIds: gameData.imageIds,
			createdBy: user.id,
			createdAt: new Date().toISOString(),
			isPublic: gameData.isPublic || false,
			playCount: 0,
			rating: 0,
			ratingCount: 0,
			tags: gameData.tags,
			difficulty: gameData.difficulty
		};

		// Save game metadata to GAME_DATA KV (correct namespace)
		await env.GAME_DATA.put(`game:${gameId}`, JSON.stringify(game));

		// Update user's game count and add to user's games list
		const userData = await getUserData(user.id, env);
		if (userData) {
			userData.gamesCreated = (userData.gamesCreated || 0) + 1;
			userData.updatedAt = new Date().toISOString();
			await saveUserData(user.id, userData, env);
		}

		// Add to user's games list
		const userGamesKey = `user:${user.id}:games`;
		const userGames = await env.USER_DATA.get(userGamesKey);
		const gamesList = userGames ? JSON.parse(userGames) : [];
		gamesList.unshift(gameId); // Add to beginning of list

		// Keep only the last 1000 games per user
		if (gamesList.length > 1000) {
			gamesList.splice(1000);
		}

		await env.USER_DATA.put(userGamesKey, JSON.stringify(gamesList));

		// Add to public games index if public
		if (game.isPublic) {
			const publicGamesKey = 'public_games_index';
			const existingPublicGamesStr = await env.GAME_DATA.get(publicGamesKey);
			const existingPublicGames = existingPublicGamesStr ? JSON.parse(existingPublicGamesStr) : [];

			existingPublicGames.unshift({
				gameId: gameId,
				name: game.name,
				description: game.description,
				createdBy: game.createdBy,
				createdAt: game.createdAt,
				playCount: game.playCount,
				imageCount: game.imageIds.length,
				tags: game.tags,
				difficulty: game.difficulty
			});

			// Keep only the last 1000 public games
			if (existingPublicGames.length > 1000) {
				existingPublicGames.splice(1000);
			}

			await env.GAME_DATA.put(publicGamesKey, JSON.stringify(existingPublicGames));
		}

		return json(
			{ gameId: gameId, url: `/api/games/${gameId}`, success: true },
			{
				status: 201,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error creating game:', error);
		return json(
			{ error: 'Internal server error' },
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
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
