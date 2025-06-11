import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

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





export const POST = async ({ request, platform }: RequestEvent) => {
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

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

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

		// Validate that all images exist and belong to the user
		const imagePromises = gameData.imageIds.map((id) => db.images.getImageById(id));
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
		const gameId = crypto.randomUUID();

		// Create game in D1 database
		const game = await db.games.createGame({
			id: gameId,
			name: gameData.name.trim(),
			description: gameData.description?.trim(),
			imageIds: gameData.imageIds,
			createdBy: user.id,
			isPublic: gameData.isPublic || false,
			tags: gameData.tags,
			difficulty: gameData.difficulty
		});

		// Update user's game count
		await db.users.incrementUserStats(user.id, { gamesCreated: 1 });

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
