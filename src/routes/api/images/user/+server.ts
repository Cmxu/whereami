import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';

interface AuthenticatedUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

// Extract token from Authorization header
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) return null;

	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

	return parts[1];
}

// Verify Supabase JWT token
async function verifySupabaseToken(token: string, env: any): Promise<AuthenticatedUser | null> {
	try {
		// Decode the JWT payload (without verification for now)
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const payload = JSON.parse(atob(parts[1]));

		// Check if token is expired
		if (payload.exp && payload.exp < Date.now() / 1000) {
			return null;
		}

		// Check if it's a Supabase token
		if (payload.iss !== env.PUBLIC_SUPABASE_URL + '/auth/v1') {
			return null;
		}

		// Extract user data from payload
		return {
			id: payload.sub,
			email: payload.email,
			firstName: payload.user_metadata?.first_name,
			lastName: payload.user_metadata?.last_name,
			username: payload.user_metadata?.username || payload.email?.split('@')[0]
		};
	} catch (error) {
		console.error('Token verification failed:', error);
		return null;
	}
}

// Get image metadata from KV
async function getImageMetadata(imageId: string, env: any): Promise<any> {
	try {
		const metadata = await env.IMAGE_DATA.get(`image:${imageId}`);
		return metadata ? JSON.parse(metadata) : null;
	} catch (error) {
		console.error('Failed to get image metadata:', error);
		return null;
	}
}

export const GET = async ({ request, platform }: RequestEvent) => {
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

		// Extract and verify authentication token
		const token = extractToken(request);
		if (!token) {
			return json(
				{ error: 'Authentication required' },
				{
					status: 401,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		const user = await verifySupabaseToken(token, env);
		if (!user) {
			return json(
				{ error: 'Invalid authentication token' },
				{
					status: 401,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get query parameters
		const url = new URL(request.url);
		const limitParam = url.searchParams.get('limit') || '50';
		const offsetParam = url.searchParams.get('offset') || '0';
		const limit = Math.max(1, parseInt(limitParam)); // No maximum limit
		const offset = Math.max(0, parseInt(offsetParam));

		// Get user's images from D1
		const userImages = await db.images.getUserImages(user.id, limit, offset);

		// Add thumbnails and full URLs
		const enrichedImages = userImages.map((image) => ({
			...image,
			url: `/api/images/${image.id}/${image.filename}`,
			thumbnailUrl:
				image.thumbnailUrl ||
				`/api/images/${image.id}/${image.filename}?w=300&h=300&fit=cover&q=80`,
			previewUrl: `/api/images/${image.id}/${image.filename}?w=800&h=600&fit=scale-down&q=85`
		}));

		// Get total count efficiently
		const total = await db.images.getUserImagesCount(user.id);

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
		console.error('Error fetching user images:', error);
		return json(
			{ error: 'Failed to fetch user images' },
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
