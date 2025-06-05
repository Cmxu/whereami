import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame, ImageMetadata } from '$lib/types';

// Get game metadata from GAME_DATA namespace
async function getGameMetadata(gameId: string, env: any): Promise<CustomGame | null> {
	try {
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		return gameData ? JSON.parse(gameData) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

// Get image metadata from IMAGE_DATA namespace
async function getImageMetadata(imageId: string, env: any): Promise<ImageMetadata | null> {
	try {
		const imageData = await env.IMAGE_DATA.get(`image:${imageId}`);
		return imageData ? JSON.parse(imageData) : null;
	} catch (error) {
		console.error('Error getting image metadata:', error);
		return null;
	}
}

export const GET = async ({ params, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.IMAGE_DATA || !env?.GAME_DATA) {
			return json(
				{ error: 'Server configuration error: KV stores not configured' },
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

		// Get game metadata from GAME_DATA namespace
		const game = await getGameMetadata(gameId, env);
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
		const imagePromises = game.imageIds.map((id) => getImageMetadata(id, env));
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