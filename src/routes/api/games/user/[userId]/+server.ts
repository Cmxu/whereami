import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';

async function getGameMetadata(gameId: string, env: any): Promise<CustomGame | null> {
	try {
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		return gameData ? JSON.parse(gameData) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

export const GET = async ({ params, platform, url }: RequestEvent) => {
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

		const { userId } = params;
		if (!userId) {
			return json(
				{ error: 'User ID required' },
				{
					status: 400,
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
		const userGamesKey = `user:${userId}:games`;
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
			(game): game is NonNullable<typeof game> => game !== null && game.createdBy === userId
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