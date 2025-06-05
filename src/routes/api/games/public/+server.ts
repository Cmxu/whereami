import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';

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

export const GET = async ({ url, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.GAME_DATA) {
			return json(
				{ error: 'Server configuration error: KV stores not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Parse query parameters
		const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20')));
		const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));
		const search = url.searchParams.get('search')?.trim();
		const sortBy = (url.searchParams.get('sortBy') as 'newest' | 'popular' | 'rating') || 'newest';
		const difficulty = url.searchParams.get('difficulty')?.trim();
		const minRating = parseFloat(url.searchParams.get('minRating') || '0');
		const tags =
			url.searchParams
				.get('tags')
				?.split(',')
				.filter((tag) => tag.trim()) || [];

		// Get public games index from GAME_DATA
		const publicGamesKey = 'public_games_index';
		const existingPublicGamesStr = await env.GAME_DATA.get(publicGamesKey);

		if (!existingPublicGamesStr) {
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

		const publicGamesIndex = JSON.parse(existingPublicGamesStr);

		if (publicGamesIndex.length === 0) {
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

		// Get full game metadata for all public games
		const gamePromises = publicGamesIndex.map((indexEntry: any) =>
			getGameMetadata(indexEntry.gameId || indexEntry.id, env)
		);
		const gameResults = await Promise.all(gamePromises);

		// Filter out null results (deleted games) and ensure they're public
		let validGames = gameResults.filter(
			(game): game is CustomGame => game !== null && game.isPublic
		);

		// Apply search filter if provided
		if (search) {
			const searchLower = search.toLowerCase();
			validGames = validGames.filter(
				(game) =>
					game.name.toLowerCase().includes(searchLower) ||
					game.description?.toLowerCase().includes(searchLower)
			);
		}

		// Apply difficulty filter if provided
		if (difficulty && difficulty !== 'all') {
			validGames = validGames.filter((game) => game.difficulty === difficulty);
		}

		// Apply minimum rating filter
		if (minRating > 0) {
			validGames = validGames.filter((game) => {
				const avgRating =
					(game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0;
				return avgRating >= minRating;
			});
		}

		// Apply tags filter
		if (tags.length > 0) {
			validGames = validGames.filter(
				(game) => game.tags && game.tags.some((tag) => tags.includes(tag))
			);
		}

		// Sort games
		switch (sortBy) {
			case 'popular':
				validGames.sort((a, b) => b.playCount - a.playCount);
				break;
			case 'rating':
				validGames.sort((a, b) => {
					const ratingA = (a.ratingCount || 0) > 0 ? (a.rating || 0) / (a.ratingCount || 1) : 0;
					const ratingB = (b.ratingCount || 0) > 0 ? (b.rating || 0) / (b.ratingCount || 1) : 0;
					return ratingB - ratingA;
				});
				break;
			case 'newest':
			default:
				validGames.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
				break;
		}

		// Apply pagination
		const paginatedGames = validGames.slice(offset, offset + limit);

		// Add computed fields
		const enrichedGames = paginatedGames.map((game) => ({
			...game,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0,
			imageCount: game.imageIds.length
		}));

		return json(
			{
				games: enrichedGames,
				total: validGames.length,
				limit,
				offset,
				hasMore: offset + limit < validGames.length
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error fetching public games:', error);
		return json(
			{ error: 'Failed to fetch public games' },
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
