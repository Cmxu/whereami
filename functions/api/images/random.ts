import type { Env, ImageMetadata } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	getImageMetadata,
	getPublicImages,
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
	const { request, env } = context as { request: Request; env: Env };

	// Parse query parameters
	const url = new URL(request.url);
	const countParam = url.searchParams.get('count') || '10';
	const count = Math.max(1, Math.min(50, parseInt(countParam))); // Limit between 1-50

	try {
		// Get public images list
		const publicImageIds = await getPublicImages(env);
		
		if (publicImageIds.length === 0) {
			return createErrorResponse('No public images available. Upload some images first!', 404);
		}

		// Shuffle and select random images
		const shuffled = [...publicImageIds].sort(() => 0.5 - Math.random());
		const selectedIds = shuffled.slice(0, Math.min(count, shuffled.length));

		// Fetch metadata for selected images
		const imagePromises = selectedIds.map(id => getImageMetadata(id, env));
		const imageResults = await Promise.all(imagePromises);

		// Filter out any null results (deleted images)
		const validImages = imageResults.filter(img => img !== null) as ImageMetadata[];

		// Return error if we don't have enough valid images
		if (validImages.length === 0) {
			return createErrorResponse('No valid images found. Upload some images first!', 404);
		}

		// Log analytics
		logAnalytics(
			{
				type: 'game_start',
				imageCount: validImages.length,
				timestamp: new Date().toISOString(),
			},
			env
		);

		return createResponse(validImages.slice(0, count), 200);
	} catch (error) {
		console.error('Error getting random images:', error);
		return createErrorResponse('Failed to get random images', 500);
	}
} 