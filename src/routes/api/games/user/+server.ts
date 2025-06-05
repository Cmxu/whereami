import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';

interface AuthenticatedUser {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

// Authentication helper functions
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7);
}

// Verify Supabase JWT token using the same method as other endpoints
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

async function getGameMetadata(gameId: string, env: any): Promise<CustomGame | null> {
	try {
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		return gameData ? JSON.parse(gameData) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

export const GET = async ({ request, platform, url }: RequestEvent) => {
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

		// Get query parameters
		const limitParam = url.searchParams.get('limit') || '50';
		const offsetParam = url.searchParams.get('offset') || '0';
		const limit = Math.max(1, Math.min(100, parseInt(limitParam)));
		const offset = Math.max(0, parseInt(offsetParam));

		// Get user's games list from KV
		const userGamesKey = `user:${user.id}:games`;
		const userGamesData = await env.USER_DATA.get(userGamesKey);

		if (!userGamesData) {
			return json(
				{
					games: [],
					total: 0,
					limit,
					offset,
					hasMore: false
				},
				{
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const gameIds: string[] = JSON.parse(userGamesData);

		// Apply pagination
		const paginatedIds = gameIds.slice(offset, offset + limit);

		// Fetch metadata for each game
		const gamePromises = paginatedIds.map((id) => getGameMetadata(id, env));
		const gameResults = await Promise.all(gamePromises);

		// Filter out null results (deleted games) and ensure user owns them
		const validGames = gameResults.filter(
			(game): game is NonNullable<typeof game> => game !== null && game.createdBy === user.id
		);

		// Add computed fields
		const enrichedGames = validGames.map((game) => ({
			...game,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0,
			imageCount: game.imageIds.length,
			url: `/games/${game.id}`
		}));

		return json(
			{
				games: enrichedGames,
				total: gameIds.length,
				limit,
				offset,
				hasMore: offset + limit < gameIds.length
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error fetching user games:', error);
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
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
