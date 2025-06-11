import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';

interface AuthenticatedUser {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	username: string;
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

export const POST = async ({ params, request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error' },
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

		// Parse request body
		const { rating } = await request.json();

		// Validate rating
		if (typeof rating !== 'number' || rating < 1 || rating > 5) {
			return json(
				{ error: 'Rating must be between 1 and 5' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const db = new D1Utils(env.DB);

		// Verify game exists
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

		// Upsert the rating (handles both create and update)
		const userRating = await db.games.upsertRating(gameId, user.id, rating);

		return json(
			{ success: true, rating: userRating },
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error rating game:', error);
		return json(
			{ error: 'Failed to rate game' },
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
