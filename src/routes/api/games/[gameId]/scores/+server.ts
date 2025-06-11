import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';
import { nanoid } from 'nanoid';

interface AuthenticatedUser {
	id: string;
	email: string;
	firstName?: string;
	lastName?: string;
	username: string;
}

interface GameScore {
	gameId: string;
	userId: string;
	username: string;
	score: number;
	maxPossible: number;
	percentage: number;
	rounds: number;
	playedAt: string;
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
		const { score, maxPossible, rounds, roundData } = await request.json();

		// Validate score data
		if (
			typeof score !== 'number' ||
			typeof maxPossible !== 'number' ||
			typeof rounds !== 'number'
		) {
			return json(
				{ error: 'Invalid score data: score, maxPossible, and rounds must be numbers' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		if (score < 0 || score > maxPossible) {
			return json(
				{ error: 'Invalid score: must be between 0 and maxPossible' },
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

		const percentage = Math.round((score / maxPossible) * 100);
		const playedAt = new Date().toISOString();

		// Get user's current best score for comparison
		const existingBestScore = await db.games.getUserBestScore(gameId, user.id);
		const isNewBest = !existingBestScore || percentage > existingBestScore.percentage;

		// Create game session record
		const sessionId = nanoid();
		await db.sessions.createSession({
			id: sessionId,
			gameId,
			gameType: 'custom',
			playerId: user.id,
			playerScore: score,
			maxPossibleScore: maxPossible,
			roundsData: roundData || [],
			gameSettings: {
				numRounds: rounds,
				gameMode: 'custom'
			}
		});

		// Increment play count for the game
		await db.games.incrementPlayCount(gameId);

		// Update user stats
		await db.users.incrementUserStats(user.id, {
			gamesPlayed: 1,
			totalScore: score
		});

		// Create score response
		const gameScore: GameScore = {
			gameId,
			userId: user.id,
			username: user.username,
			score,
			maxPossible,
			percentage,
			rounds,
			playedAt
		};

		return json(
			{
				success: true,
				score: gameScore,
				isNewBest
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error submitting score:', error);
		return json(
			{ error: 'Failed to submit score' },
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
