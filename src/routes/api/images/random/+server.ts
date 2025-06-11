import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { ImageMetadata } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

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

		if (!env?.DB) {
			console.error('D1 database not available');
			throw error(500, 'Server configuration error');
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Parse query parameters
		const countParam = url.searchParams.get('count') || '10';
		const count = Math.max(1, parseInt(countParam)); // Minimum 1, no maximum limit

		// Get all public images (we'll randomize them)
		// Fetch more than requested to have a good selection for randomization
		const fetchLimit = Math.max(count * 3, 100); // Get at least 3x more for good randomization
		const publicImages = await db.images.getPublicImages(fetchLimit, 0);

		if (publicImages.length === 0) {
			throw error(404, 'No public images available. Upload some images first!');
		}

		// Shuffle and select random images
		const shuffled = [...publicImages].sort(() => 0.5 - Math.random());
		const selectedImages = shuffled.slice(0, Math.min(count, shuffled.length));

		// Add URLs for the images
		const enrichedImages = selectedImages.map((image: ImageMetadata) => ({
			...image,
			src: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl:
				image.thumbnailUrl || `/api/images/${image.id}/${image.filename}?w=300&h=300&fit=cover&q=80`
		}));

		return json(enrichedImages, {
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
