import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

export const GET = async ({ params, platform, url }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: Database not configured' },
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
		const limit = Math.max(1, parseInt(limitParam));
		const offset = Math.max(0, parseInt(offsetParam));

		const db = new D1Utils(env.DB);

		// Verify user exists
		const user = await db.users.getUserById(userId);
		if (!user) {
			return json(
				{ error: 'User not found' },
				{
					status: 404,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Get user's games with pagination
		const games = await db.games.getUserGames(userId, limit, offset);

		// Get total count for pagination
		const totalResult = await env.DB.prepare(`
			SELECT COUNT(*) as total
			FROM games 
			WHERE created_by = ?
		`).bind(userId).first();
		const total = (totalResult?.total as number) || 0;

		// Add computed fields
		const enrichedGames = games.map((game) => ({
			...game,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) : 0,
			imageCount: game.imageIds.length,
			url: `/games/${game.id}`
		}));

		return json(
			{
				games: enrichedGames,
				total,
				limit,
				offset,
				hasMore: offset + limit < total
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
