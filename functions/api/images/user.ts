import type { Env } from '../types';
import { corsHeaders, createResponse, createErrorResponse, getImageMetadata } from '../utils';
import { requireAuth } from '../auth';

// Handle CORS preflight requests
export async function onRequestOptions(): Promise<Response> {
	return new Response(null, {
		status: 200,
		headers: corsHeaders()
	});
}

export async function onRequestGet(context: any): Promise<Response> {
	const { request, env } = context as { request: Request; env: Env };

	try {
		// Require authentication
		const { user, error } = await requireAuth(request, env);
		if (error) {
			return error;
		}

		// Get query parameters
		const url = new URL(request.url);
		const limitParam = url.searchParams.get('limit') || '50';
		const offsetParam = url.searchParams.get('offset') || '0';
		const limit = Math.max(1, Math.min(100, parseInt(limitParam)));
		const offset = Math.max(0, parseInt(offsetParam));

		// Get user's image list from KV
		const userImagesKey = `user:${user.id}:images`;
		const userImagesData = await env.USER_DATA.get(userImagesKey);

		if (!userImagesData) {
			return createResponse([], 200);
		}

		const imageIds: string[] = JSON.parse(userImagesData);

		// Apply pagination
		const paginatedIds = imageIds.slice(offset, offset + limit);

		// Fetch metadata for each image
		const imagePromises = paginatedIds.map((id) => getImageMetadata(id, env));
		const imageResults = await Promise.all(imagePromises);

		// Filter out null results (deleted images) and ensure user owns them
		const validImages = imageResults.filter(
			(img): img is NonNullable<typeof img> => img !== null && img.uploadedBy === user.id
		);

		// Add thumbnails and full URLs
		const enrichedImages = validImages.map((image) => ({
			...image,
			url: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl: `/api/images/${image.id}/${image.filename}?size=thumb`,
			previewUrl: `/api/images/${image.id}/${image.filename}?size=preview`
		}));

		return createResponse(
			{
				images: enrichedImages,
				total: imageIds.length,
				limit,
				offset,
				hasMore: offset + limit < imageIds.length
			},
			200
		);
	} catch (error) {
		console.error('Error fetching user images:', error);
		return createErrorResponse('Internal server error', 500);
	}
}
