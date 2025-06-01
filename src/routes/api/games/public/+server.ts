import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ url, platform }: RequestEvent) => {
	try {
		// For now, return an empty array since we don't have games stored yet
		// This can be expanded later when game storage is implemented
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		
		return json([], {
			headers: {
				'Access-Control-Allow-Origin': '*',
			}
		});
	} catch (error) {
		console.error('Error fetching public games:', error);
		return json({ error: 'Failed to fetch public games' }, { 
			status: 500,
			headers: {
				'Access-Control-Allow-Origin': '*',
			}
		});
	}
};

export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
	});
}; 