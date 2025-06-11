import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';

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

		// Get game statistics
		const statsResult = await env.DB.prepare(`
			SELECT 
				COUNT(*) as totalPlays,
				COUNT(DISTINCT player_id) as uniquePlayers,
				AVG(player_score) as averageScore,
				AVG(ROUND((player_score * 100.0 / max_possible_score), 1)) as averagePercentage
			FROM game_sessions
			WHERE game_id = ? AND player_id IS NOT NULL
		`).bind(gameId).first();

		// Get leaderboard entries
		const leaderboardResults = await env.DB.prepare(`
			WITH player_best_scores AS (
				SELECT 
					player_id,
					MAX(ROUND((player_score * 100.0 / max_possible_score), 1)) as best_percentage,
					MAX(player_score) as best_score
				FROM game_sessions
				WHERE game_id = ? AND player_id IS NOT NULL
				GROUP BY player_id
			)
			SELECT 
				gs.player_id as userId,
				u.username,
				gs.player_score as score,
				gs.max_possible_score as maxPossible,
				ROUND((gs.player_score * 100.0 / gs.max_possible_score), 1) as percentage,
				gs.completed_at as playedAt
			FROM game_sessions gs
			LEFT JOIN users u ON gs.player_id = u.id
			INNER JOIN player_best_scores pbs ON gs.player_id = pbs.player_id
			WHERE gs.game_id = ? 
			AND gs.player_id IS NOT NULL
			AND ROUND((gs.player_score * 100.0 / gs.max_possible_score), 1) = pbs.best_percentage
			AND gs.player_score = pbs.best_score
			ORDER BY percentage DESC, score DESC, playedAt ASC
			LIMIT 20
		`).bind(gameId, gameId).all();

		const leaderboard: LeaderboardEntry[] = leaderboardResults.results.map((row, index) => ({
			userId: row.userId as string,
			username: (row.username as string) || 'Anonymous',
			score: row.score as number,
			percentage: row.percentage as number,
			playedAt: row.playedAt as string,
			rank: index + 1
		}));

		const response: LeaderboardResponse = {
			averageScore: Math.round((statsResult?.averageScore as number) || 0),
			averagePercentage: Math.round((statsResult?.averagePercentage as number) || 0),
			totalPlays: (statsResult?.totalPlays as number) || 0,
			uniquePlayers: (statsResult?.uniquePlayers as number) || 0,
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
