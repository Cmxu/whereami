import type { Env, CustomGame, GetPublicGamesQuery } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	getPublicGames,
	getGameMetadata,
} from '../utils';

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
		// Parse query parameters
		const url = new URL(request.url);
		const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20')));
		const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));
		const search = url.searchParams.get('search')?.trim();
		const sortBy = url.searchParams.get('sortBy') as 'newest' | 'popular' | 'rating' || 'newest';

		// Get public games list
		const publicGameIds = await getPublicGames(env);
		
		if (publicGameIds.length === 0) {
			return createResponse([], 200);
		}

		// Get game metadata for all public games
		const gamePromises = publicGameIds.map(id => getGameMetadata(id, env));
		const gameResults = await Promise.all(gamePromises);
		
		// Filter out null results (deleted games)
		let validGames = gameResults.filter(game => game !== null) as CustomGame[];

		// Apply search filter if provided
		if (search) {
			const searchLower = search.toLowerCase();
			validGames = validGames.filter(game => 
				game.name.toLowerCase().includes(searchLower) ||
				game.description?.toLowerCase().includes(searchLower)
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
				validGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
				break;
		}

		// Apply pagination
		const paginatedGames = validGames.slice(offset, offset + limit);

		// Add computed fields
		const enrichedGames = paginatedGames.map(game => ({
			...game,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0,
			imageCount: game.imageIds.length,
		}));

		return createResponse({
			games: enrichedGames,
			total: validGames.length,
			limit,
			offset,
			hasMore: offset + limit < validGames.length,
		}, 200);
	} catch (error) {
		console.error('Error getting public games:', error);
		return createErrorResponse('Internal server error', 500);
	}
} 