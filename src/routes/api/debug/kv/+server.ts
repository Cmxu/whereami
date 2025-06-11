import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';

export const GET = async ({ request, platform, url }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env) {
			return json({ error: 'Platform environment not available' }, { status: 500 });
		}

		if (!env.DB) {
			return json({ error: 'D1 Database not configured' }, { status: 500 });
		}

		const table = url.searchParams.get('table');
		const id = url.searchParams.get('id');
		const limit = parseInt(url.searchParams.get('limit') || '10');

		const db = new D1Utils(env.DB);

		if (table && id) {
			// Get specific record
			let result = null;
			
			switch (table) {
				case 'users':
					result = await db.users.getUserById(id);
					break;
				case 'images':
					result = await db.images.getImageById(id);
					break;
				case 'games':
					result = await db.games.getGameById(id);
					break;
				case 'sessions':
					result = await db.sessions.getSessionById(id);
					break;
				default:
					return json({ error: 'Invalid table specified' }, { status: 400 });
			}

			return json({
				table,
				id,
				record: result
			});
		}

		// Get database statistics
		const stats = {
			timestamp: new Date().toISOString(),
			database: 'D1 Connected',
			tables: {}
		};

		try {
			// Get table counts
			const tableQueries = [
				{ name: 'users', query: 'SELECT COUNT(*) as count FROM users' },
				{ name: 'images', query: 'SELECT COUNT(*) as count FROM images' },
				{ name: 'games', query: 'SELECT COUNT(*) as count FROM games' },
				{ name: 'game_images', query: 'SELECT COUNT(*) as count FROM game_images' },
				{ name: 'game_ratings', query: 'SELECT COUNT(*) as count FROM game_ratings' },
				{ name: 'game_sessions', query: 'SELECT COUNT(*) as count FROM game_sessions' },
				{ name: 'game_comments', query: 'SELECT COUNT(*) as count FROM game_comments' },
				{ name: 'share_tokens', query: 'SELECT COUNT(*) as count FROM share_tokens' }
			];

			for (const tableQuery of tableQueries) {
				try {
					const result = await env.DB.prepare(tableQuery.query).first();
					(stats.tables as any)[tableQuery.name] = {
						count: result?.count || 0,
						status: 'OK'
					};
				} catch (error) {
					(stats.tables as any)[tableQuery.name] = {
						count: 0,
						status: 'ERROR',
						error: error instanceof Error ? error.message : 'Unknown error'
					};
				}
			}

			// Get some sample data
			const samples: any = {};

			try {
				// Recent users
				const recentUsers = await env.DB.prepare(`
					SELECT id, username, email, joined_at
					FROM users 
					ORDER BY joined_at DESC 
					LIMIT ?
				`).bind(limit).all();
				samples.recent_users = recentUsers.results;
			} catch (e) {
				samples.recent_users = `Error: ${e}`;
			}

			try {
				// Recent images
				const recentImages = await env.DB.prepare(`
					SELECT id, filename, uploaded_by_username, uploaded_at, is_public
					FROM images 
					ORDER BY uploaded_at DESC 
					LIMIT ?
				`).bind(limit).all();
				samples.recent_images = recentImages.results;
			} catch (e) {
				samples.recent_images = `Error: ${e}`;
			}

			try {
				// Recent games
				const recentGames = await env.DB.prepare(`
					SELECT id, name, created_by_username, created_at, is_public, play_count, rating
					FROM games 
					ORDER BY created_at DESC 
					LIMIT ?
				`).bind(limit).all();
				samples.recent_games = recentGames.results;
			} catch (e) {
				samples.recent_games = `Error: ${e}`;
			}

			return json({
				...stats,
				samples
			});

		} catch (error) {
			return json({
				...stats,
				error: 'Failed to fetch database statistics',
				details: error instanceof Error ? error.message : 'Unknown error'
			});
		}

	} catch (error) {
		console.error('Debug endpoint error:', error);
		return json({ 
			error: 'Debug endpoint failed', 
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
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
