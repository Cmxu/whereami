import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

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

export const GET = async ({ request, platform, url }: RequestEvent) => {
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

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get user's games from D1
		const userGames = await db.games.getUserGames(user.id, limit, offset);

		// Add computed fields
		const enrichedGames = userGames.map((game) => ({
			...game,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0,
			imageCount: game.imageIds.length,
			url: `/games/${game.id}`
		}));

		// Get total count efficiently
		const total = await db.games.getUserGamesCount(user.id);

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
