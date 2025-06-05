import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ request, platform, url }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env) {
			return json({ error: 'Platform environment not available' }, { status: 500 });
		}

		const namespace = url.searchParams.get('namespace') || 'IMAGE_DATA';
		const key = url.searchParams.get('key');
		const limit = parseInt(url.searchParams.get('limit') || '10');

		if (key) {
			// Get specific key
			let value = null;
			if (namespace === 'IMAGE_DATA' && env.IMAGE_DATA) {
				value = await env.IMAGE_DATA.get(key);
			} else if (namespace === 'USER_DATA' && env.USER_DATA) {
				value = await env.USER_DATA.get(key);
			} else if (namespace === 'GAME_DATA' && env.GAME_DATA) {
				value = await env.GAME_DATA.get(key);
			}

			return json({
				namespace,
				key,
				value: value ? JSON.parse(value) : null,
				raw: value
			});
		}

		// List keys (limited functionality in KV)
		const debugInfo = {
			timestamp: new Date().toISOString(),
			namespaces: {
				IMAGE_DATA: env.IMAGE_DATA ? 'available' : 'missing',
				USER_DATA: env.USER_DATA ? 'available' : 'missing',
				GAME_DATA: env.GAME_DATA ? 'available' : 'missing'
			}
		};

		// Try to get some common keys to verify functionality
		const commonKeys = [
			'public_images',
			'public_games_index'
		];

		const samples: any = {};
		
		if (env.IMAGE_DATA) {
			for (const sampleKey of commonKeys) {
				try {
					const value = await env.IMAGE_DATA.get(sampleKey);
					samples[`IMAGE_DATA:${sampleKey}`] = value ? JSON.parse(value) : null;
				} catch (e) {
					samples[`IMAGE_DATA:${sampleKey}`] = `Error: ${e}`;
				}
			}
		}

		if (env.GAME_DATA) {
			try {
				const value = await env.GAME_DATA.get('public_games_index');
				samples[`GAME_DATA:public_games_index`] = value ? JSON.parse(value) : null;
			} catch (e) {
				samples[`GAME_DATA:public_games_index`] = `Error: ${e}`;
			}
		}

		return json({
			...debugInfo,
			samples
		});

	} catch (error) {
		console.error('Debug endpoint error:', error);
		return json({ error: 'Debug endpoint failed', details: error }, { status: 500 });
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