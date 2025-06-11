import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { ImageMetadata } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

// Get image metadata from KV
async function getImageMetadata(imageId: string, env: any): Promise<ImageMetadata | null> {
	try {
		const metadata = await env.IMAGE_DATA.get(`image:${imageId}`);
		return metadata ? JSON.parse(metadata) : null;
	} catch (error) {
		console.error('Failed to get image metadata:', error);
		return null;
	}
}

// Get public user ID by searching for the public email
async function getPublicUserId(env: any): Promise<string | null> {
	try {
		// Look for user with the public email address
		const PUBLIC_EMAIL = 'public@geo.cmxu.io';
		
		// We need to search through user data to find the user with this email
		// This is a simple implementation - in production you might want to maintain an email->ID index
		const listResult = await env.USER_DATA.list({ prefix: 'user:' });
		
		for (const key of listResult.keys) {
			if (key.name.startsWith('user:') && !key.name.includes(':images')) {
				try {
					const userData = await env.USER_DATA.get(key.name);
					if (userData) {
						const user = JSON.parse(userData);
						if (user.email === PUBLIC_EMAIL) {
							return user.id;
						}
					}
				} catch (error) {
					console.warn('Error parsing user data for key:', key.name);
				}
			}
		}
		
		console.error(`Public user not found with email: ${PUBLIC_EMAIL}`);
		return null;
	} catch (error) {
		console.error('Error finding public user ID:', error);
		return null;
	}
}

// Get public user's images from KV store
async function getPublicUserImages(env: any): Promise<{ publicImageIds: string[], publicUserId: string | null }> {
	try {
		// Get the actual public user ID
		const publicUserId = await getPublicUserId(env);
		
		if (!publicUserId) {
			console.error('Could not find public user ID');
			return { publicImageIds: [], publicUserId: null };
		}
		
		console.log(`Found public user ID: ${publicUserId}`);
		
		// Get the public user's images list
		const userImagesKey = `user:${publicUserId}:images`;
		const userImagesData = await env.USER_DATA.get(userImagesKey);
		
		const result = userImagesData ? JSON.parse(userImagesData) : [];
		console.log(`Found ${result.length} images for public user`);
		return { publicImageIds: result, publicUserId };
	} catch (error) {
		console.error('Error getting public user images:', error);
		return { publicImageIds: [], publicUserId: null };
	}
}

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
		const limit = Math.max(1, parseInt(limitParam)); // No maximum limit
		const offset = Math.max(0, parseInt(offsetParam));

		// Get public images from D1
		const publicImages = await db.images.getPublicImages(limit, offset);

		// Add URLs for the images
		const enrichedImages = publicImages.map((image: ImageMetadata) => ({
			...image,
			url: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl:
				image.thumbnailUrl ||
				`/api/images/${image.id}/${image.filename}?w=300&h=300&fit=cover&q=80`,
			previewUrl: `/api/images/${image.id}/${image.filename}?w=800&h=600&fit=scale-down&q=85`
		}));

		// Get total count efficiently
		const total = await db.images.getPublicImagesCount();

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
		console.error('Error fetching public images:', error);
		return json(
			{ error: 'Failed to fetch public images' },
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