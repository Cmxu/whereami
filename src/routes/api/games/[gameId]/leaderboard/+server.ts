import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

interface GameScore {
	gameId: string;
	userId: string;
	username: string;
	score: number;
	maxPossible: number;
	percentage: number;
	rounds: number;
	playedAt: string;
	id?: string;
}

interface LeaderboardEntry {
	userId: string;
	username: string;
	score: number;
	percentage: number;
	playedAt: string;
	rank: number;
}

interface LeaderboardResponse {
	averageScore: number;
	averagePercentage: number;
	totalPlays: number;
	uniquePlayers: number;
	leaderboard: LeaderboardEntry[];
}

export const GET = async ({ params, platform }: RequestEvent) => {
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

		// Get all scores for this game
		const gameLeaderboardKey = `scores:game:${gameId}`;
		const leaderboardData = await env.GAME_DATA.get(gameLeaderboardKey);

		if (!leaderboardData) {
			// No scores yet
			return json(
				{
					averageScore: 0,
					averagePercentage: 0,
					totalPlays: 0,
					uniquePlayers: 0,
					leaderboard: []
				} as LeaderboardResponse,
				{
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const allScores: GameScore[] = JSON.parse(leaderboardData);

		// Calculate statistics
		const totalPlays = allScores.length;
		const totalScore = allScores.reduce((sum, score) => sum + score.score, 0);
		const totalPercentage = allScores.reduce((sum, score) => sum + score.percentage, 0);
		const averageScore = totalPlays > 0 ? Math.round(totalScore / totalPlays) : 0;
		const averagePercentage = totalPlays > 0 ? Math.round(totalPercentage / totalPlays) : 0;

		// Get unique players and their best scores
		const userBestScores = new Map<string, GameScore>();

		allScores.forEach((score) => {
			const existing = userBestScores.get(score.userId);
			if (!existing || score.score > existing.score) {
				userBestScores.set(score.userId, score);
			}
		});

		// Create leaderboard from best scores, sorted by score descending
		const leaderboard: LeaderboardEntry[] = Array.from(userBestScores.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, 20) // Top 20 players
			.map((score, index) => ({
				userId: score.userId,
				username: score.username,
				score: score.score,
				percentage: score.percentage,
				playedAt: score.playedAt,
				rank: index + 1
			}));

		const response: LeaderboardResponse = {
			averageScore,
			averagePercentage,
			totalPlays,
			uniquePlayers: userBestScores.size,
			leaderboard
		};

		return json(response, {
			headers: { 'Access-Control-Allow-Origin': '*' }
		});
	} catch (error) {
		console.error('Error fetching leaderboard:', error);
		return json(
			{ error: 'Failed to fetch leaderboard' },
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
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
