import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

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
		if (!env?.GAME_DATA) {
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
		const { score, maxPossible, rounds } = await request.json();

		// Validate score data
		if (typeof score !== 'number' || typeof maxPossible !== 'number' || typeof rounds !== 'number') {
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

		// Verify game exists
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		if (!gameData) {
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

		// Create score record
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

		// Save user's score (keep their best score for this game)
		const userScoreKey = `scores:user:${user.id}:${gameId}`;
		const existingUserScoreData = await env.GAME_DATA.get(userScoreKey);
		
		if (existingUserScoreData) {
			const existingScore = JSON.parse(existingUserScoreData);
			// Only save if this is a better score
			if (score > existingScore.score) {
				await env.GAME_DATA.put(userScoreKey, JSON.stringify(gameScore));
			}
		} else {
			// First time playing this game
			await env.GAME_DATA.put(userScoreKey, JSON.stringify(gameScore));
		}

		// Add to game leaderboard (keep all attempts for average calculation)
		const gameLeaderboardKey = `scores:game:${gameId}`;
		const existingLeaderboardData = await env.GAME_DATA.get(gameLeaderboardKey);
		const leaderboard = existingLeaderboardData ? JSON.parse(existingLeaderboardData) : [];
		
		// Add this score with unique ID for tracking
		const scoreId = `${user.id}:${Date.now()}`;
		leaderboard.push({
			...gameScore,
			id: scoreId
		});

		// Keep only the last 1000 scores per game to prevent unlimited growth
		if (leaderboard.length > 1000) {
			leaderboard.splice(0, leaderboard.length - 1000);
		}

		await env.GAME_DATA.put(gameLeaderboardKey, JSON.stringify(leaderboard));

		return json(
			{ 
				success: true, 
				score: gameScore,
				isNewBest: !existingUserScoreData || score > JSON.parse(existingUserScoreData).score
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