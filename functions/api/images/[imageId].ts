import type { Env } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	getImageMetadata,
	saveImageMetadata,
	getPublicImages,
	logAnalytics
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
	const imageId = params.imageId as string;

	try {
		if (!imageId) {
			return createErrorResponse('Image ID required', 400);
		}

		// Get image metadata
		const metadata = await getImageMetadata(imageId, env);
		if (!metadata) {
			return createErrorResponse('Image not found', 404);
		}

		// Check if requesting thumbnail
		const url = new URL(request.url);
		const isThumbnail = url.pathname.endsWith('/thumbnail');

		try {
			// Determine which image to serve
			const r2Key = isThumbnail
				? `thumbnails/${imageId}.${metadata.filename.split('.').pop()}`
				: metadata.r2Key;

			// Get image from R2
			const object = await env.IMAGES_BUCKET.get(r2Key);

			if (!object) {
				return createErrorResponse('Image file not found', 404);
			}

			// Log analytics for image views
			logAnalytics(
				{
					type: 'image_view',
					imageId: imageId,
					isThumbnail: isThumbnail,
					timestamp: new Date().toISOString()
				},
				env
			);

			// Return image with proper headers
			return new Response(object.body, {
				headers: {
					'Content-Type': metadata.mimeType || 'image/jpeg',
					'Cache-Control': 'public, max-age=31536000', // 1 year
					ETag: object.etag || `"${imageId}"`,
					...corsHeaders()
				}
			});
		} catch (storageError) {
			console.error('Error retrieving image from R2:', storageError);
			return createErrorResponse('Failed to retrieve image', 500);
		}
	} catch (error) {
		console.error('Error in image retrieval:', error);
		return createErrorResponse('Internal server error', 500);
	}
}

export async function onRequestPut(context: any): Promise<Response> {
	const { request, env, params } = context as { request: Request; env: Env; params: any };
	const imageId = params.imageId as string;

	try {
		if (!imageId) {
			return createErrorResponse('Image ID required', 400);
		}

		// Get existing metadata
		const metadata = await getImageMetadata(imageId, env);
		if (!metadata) {
			return createErrorResponse('Image not found', 404);
		}

		// Parse request body
		const updateData = await request.json();

		// Update metadata fields
		if (updateData.tags && Array.isArray(updateData.tags)) {
			metadata.tags = updateData.tags;
		}

		if (updateData.isPublic !== undefined) {
			metadata.isPublic = Boolean(updateData.isPublic);
		}

		// Save updated metadata
		const updated = await saveImageMetadata(metadata, env);
		if (!updated) {
			return createErrorResponse('Failed to update image metadata', 500);
		}

		return createResponse(metadata, 200, 'Image metadata updated successfully');
	} catch (error) {
		console.error('Error updating image metadata:', error);
		return createErrorResponse('Internal server error', 500);
	}
}

export async function onRequestDelete(context: any): Promise<Response> {
	const { request, env, params } = context as { request: Request; env: Env; params: any };
	const imageId = params.imageId as string;

	try {
		if (!imageId) {
			return createErrorResponse('Image ID required', 400);
		}

		// Get image metadata
		const metadata = await getImageMetadata(imageId, env);
		if (!metadata) {
			return createErrorResponse('Image not found', 404);
		}

		try {
			// Delete from R2
			await env.IMAGES_BUCKET.delete(metadata.r2Key);

			// Delete thumbnail
			const thumbnailKey = `thumbnails/${imageId}.${metadata.filename.split('.').pop()}`;
			await env.IMAGES_BUCKET.delete(thumbnailKey);

			// Delete metadata from KV
			await env.IMAGE_DATA.delete(`image:${imageId}`);

			// Remove from public images index if it was public
			if (metadata.isPublic) {
				const publicImages = await getPublicImages(env);
				const filteredImages = publicImages.filter((id) => id !== imageId);
				await env.IMAGE_DATA.put('public_images', JSON.stringify(filteredImages));
			}

			return createResponse(null, 200, 'Image deleted successfully');
		} catch (storageError) {
			console.error('Error deleting image from R2:', storageError);
			return createErrorResponse('Failed to delete image', 500);
		}
	} catch (error) {
		console.error('Error deleting image:', error);
		return createErrorResponse('Internal server error', 500);
	}
}
