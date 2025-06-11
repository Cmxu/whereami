import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame, ImageMetadata } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';



export const GET = async ({ params, platform }: RequestEvent) => {
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

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

		// Get game metadata from D1
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

		// Return game images
		const imagePromises = game.imageIds.map((id: string) => db.images.getImageById(id));
		const imageResults = await Promise.all(imagePromises);
		const validImages = imageResults.filter((img) => img !== null) as ImageMetadata[];

		return json(validImages, {
			headers: { 'Access-Control-Allow-Origin': '*' }
		});
	} catch (error) {
		console.error('Error retrieving game images:', error);
		return json(
			{ error: 'Failed to retrieve game images' },
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
