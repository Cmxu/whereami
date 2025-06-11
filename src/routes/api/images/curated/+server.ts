import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { ImageMetadata } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

// Get curated images specifically from the public@geo.cmxu.io account
export const GET = async ({ url, platform }: RequestEvent) => {
	try {
		const env = platform?.env;

		if (!env?.DB) {
			console.error('D1 database not available');
			return json(
				{ error: 'Server configuration error' },
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Parse query parameters
		const limitParam = url.searchParams.get('limit') || '50';
		const offsetParam = url.searchParams.get('offset') || '0';
		const limit = Math.max(1, parseInt(limitParam));
		const offset = Math.max(0, parseInt(offsetParam));

		// Get curated images from the public@geo.cmxu.io account
		const CURATOR_EMAIL = 'public@geo.cmxu.io';
		const curatedImages = await db.images.getCuratedImages(CURATOR_EMAIL, limit, offset);

		// Add URLs for the images
		const enrichedImages = curatedImages.map((image: ImageMetadata) => ({
			...image,
			url: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl:
				image.thumbnailUrl ||
				`/api/images/${image.id}/${image.filename}?w=300&h=300&fit=cover&q=80`,
			previewUrl: `/api/images/${image.id}/${image.filename}?w=800&h=600&fit=scale-down&q=85`
		}));

		// Get total count efficiently
		const total = await db.images.getCuratedImagesCount(CURATOR_EMAIL);

		return json(
			{
				images: enrichedImages,
				total,
				limit,
				offset,
				hasMore: offset + limit < total
			},
			{
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	} catch (error) {
		console.error('Error fetching curated images:', error);
		return json(
			{ error: 'Failed to fetch curated images' },
			{
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
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