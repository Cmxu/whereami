import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ImageMetadata } from '$lib/types';

// Get public images list from KV store
async function getPublicImages(env: any): Promise<string[]> {
	try {
		const images = await env.IMAGE_DATA.get('public_images');
		const result = images ? JSON.parse(images) : [];
		return result;
	} catch (error) {
		console.error('Error getting public images:', error);
		return [];
	}
}

// Get image metadata from KV store
async function getImageMetadata(imageId: string, env: any): Promise<ImageMetadata | null> {
	try {
		const metadata = await env.IMAGE_DATA.get(`image:${imageId}`);
		return metadata ? JSON.parse(metadata) : null;
	} catch (error) {
		console.error('Error getting image metadata:', error);
		return null;
	}
}

export const GET: RequestHandler = async ({ url, platform }) => {
	try {
		const env = platform?.env;

		if (!env?.IMAGE_DATA) {
			console.error('KV namespaces not available');
			throw error(500, 'Server configuration error');
		}

		// Parse query parameters
		const countParam = url.searchParams.get('count') || '10';
		const count = Math.max(1, Math.min(50, parseInt(countParam))); // Limit between 1-50

		// Get public images list
		const publicImageIds = await getPublicImages(env);

		if (publicImageIds.length === 0) {
			throw error(404, 'No public images available. Upload some images first!');
		}

		// Shuffle and select random images
		const shuffled = [...publicImageIds].sort(() => 0.5 - Math.random());
		const selectedIds = shuffled.slice(0, Math.min(count, shuffled.length));

		// Fetch metadata for selected images
		const imagePromises = selectedIds.map((id) => getImageMetadata(id, env));
		const imageResults = await Promise.all(imagePromises);

		// Filter out any null results
		const validImages = imageResults.filter((img): img is ImageMetadata => img !== null);

		// Return error if we don't have enough valid images
		if (validImages.length === 0) {
			throw error(404, 'No valid images found. Upload some images first!');
		}

		// Add URLs for the images
		const enrichedImages = validImages.map((image) => ({
			...image,
			src: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl:
				image.thumbnailUrl || `/api/images/${image.id}/${image.filename}?w=300&h=300&fit=cover&q=80`
		}));

		return json(enrichedImages.slice(0, count), {
			headers: {
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (err) {
		console.error('Error getting random images:', err);
		if (err instanceof Error && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		throw error(500, 'Failed to get random images');
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
