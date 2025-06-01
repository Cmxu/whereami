import type { Env, ImageMetadata } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	getGameMetadata,
	saveGameMetadata,
	getImageMetadata,
	logAnalytics,
} from '../utils';

// Handle CORS preflight requests
export async function onRequestOptions(): Promise<Response> {
	return new Response(null, { 
		status: 200,
		headers: corsHeaders() 
	});
}

export async function onRequestGet(context: any): Promise<Response> {
	const { request, env, params } = context as { request: Request; env: Env; params: any };
	const gameId = params.gameId as string;

	try {
		if (!gameId) {
			return createErrorResponse('Game ID required', 400);
		}

		// Get game metadata
		const game = await getGameMetadata(gameId, env);
		if (!game) {
			return createErrorResponse('Game not found', 404);
		}

		// Check if requesting game images
		const url = new URL(request.url);
		const isImagesRequest = url.pathname.endsWith('/images');

		if (isImagesRequest) {
			// Return game images
			const imagePromises = game.imageIds.map(id => getImageMetadata(id, env));
			const imageResults = await Promise.all(imagePromises);
			const validImages = imageResults.filter(img => img !== null) as ImageMetadata[];

			return createResponse(validImages, 200);
		}

		// Return game metadata
		return createResponse(game, 200);
	} catch (error) {
		console.error('Error retrieving game:', error);
		return createErrorResponse('Internal server error', 500);
	}
}

export async function onRequestPost(context: any): Promise<Response> {
	const { request, env, params } = context as { request: Request; env: Env; params: any };
	const gameId = params.gameId as string;

	try {
		if (!gameId) {
			return createErrorResponse('Game ID required', 400);
		}

		// Check if this is a play count increment
		const url = new URL(request.url);
		const isPlayRequest = url.pathname.endsWith('/play');

		if (isPlayRequest) {
			// Increment play count
			const game = await getGameMetadata(gameId, env);
			if (!game) {
				return createErrorResponse('Game not found', 404);
			}

			game.playCount += 1;
			const updated = await saveGameMetadata(game, env);
			if (!updated) {
				return createErrorResponse('Failed to update play count', 500);
			}

			// Log analytics
			logAnalytics(
				{
					type: 'game_start',
					gameId: gameId,
					timestamp: new Date().toISOString(),
				},
				env
			);

			return createResponse({ playCount: game.playCount }, 200, 'Play count updated');
		}

		return createErrorResponse('Invalid request', 400);
	} catch (error) {
		console.error('Error processing game request:', error);
		return createErrorResponse('Internal server error', 500);
	}
} 