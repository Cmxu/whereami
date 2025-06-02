import type { Env } from '../types';
import { corsHeaders, createResponse, createErrorResponse, getGameMetadata } from '../utils';
import { requireAuth } from '../auth';

// Handle CORS preflight requests
export async function onRequestOptions(): Promise<Response> {
	return new Response(null, {
		status: 200,
		headers: corsHeaders()
	});
}

export async function onRequestGet(context: any): Promise<Response> {
	const { request, env } = context as { request: Request; env: Env };

	try {
		// Require authentication
		const { user, error } = await requireAuth(request, env);
		if (error) {
			return error;
		}

		// Get query parameters
		const url = new URL(request.url);
		const limitParam = url.searchParams.get('limit') || '50';
		const offsetParam = url.searchParams.get('offset') || '0';
		const limit = Math.max(1, Math.min(100, parseInt(limitParam)));
		const offset = Math.max(0, parseInt(offsetParam));

		// Get user's games list from KV
		const userGamesKey = `user:${user.id}:games`;
		const userGamesData = await env.USER_DATA.get(userGamesKey);

		if (!userGamesData) {
			return createResponse([], 200);
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

		return createResponse(
			{
				games: enrichedGames,
				total: gameIds.length,
				limit,
				offset,
				hasMore: offset + limit < gameIds.length
			},
			200
		);
	} catch (error) {
		console.error('Error fetching user games:', error);
		return createErrorResponse('Internal server error', 500);
	}
}
