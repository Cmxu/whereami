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

export const DELETE = async ({ params, request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;

		if (!env?.DB || !env?.IMAGES_BUCKET) {
			console.error('D1 database or R2 bucket not available');
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

		const imageId = params.imageId;
		if (!imageId) {
			return json(
				{ error: 'Image ID required' },
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get image metadata from D1
		const metadata = await db.images.getImageById(imageId);
		if (!metadata) {
			return json(
				{ error: 'Image not found' },
				{
					status: 404,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Check if user owns the image
		if (metadata.uploadedBy !== user.id) {
			return json(
				{ error: 'Unauthorized to delete this image' },
				{
					status: 403,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		try {
			// Delete original image from R2
			await env.IMAGES_BUCKET.delete(metadata.r2Key);

			// Delete thumbnail if it exists
			const thumbnailKey = `thumbnails/${imageId}.${metadata.filename.split('.').pop()}`;
			await env.IMAGES_BUCKET.delete(thumbnailKey);

			// Delete image from D1 database
			await db.images.deleteImage(imageId);

			// Update user's image count
			await db.users.incrementUserStats(user.id, { imagesUploaded: -1 });

			return json(
				{
					success: true,
					message: 'Image deleted successfully'
				},
				{
					status: 200,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		} catch (deleteError) {
			console.error('Error deleting image:', deleteError);
			return json(
				{
					error: 'Failed to delete image',
					details: deleteError instanceof Error ? deleteError.message : 'Unknown error'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}
	} catch (error) {
		console.error('Error in delete endpoint:', error);
		return json(
			{ error: 'Internal server error' },
			{
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}
};

// Update image metadata
export const PUT = async ({ params, request, platform }: RequestEvent) => {
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

		const imageId = params.imageId;
		if (!imageId) {
			return json(
				{ error: 'Image ID required' },
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// Get image metadata from D1
		const metadata = await db.images.getImageById(imageId);
		if (!metadata) {
			return json(
				{ error: 'Image not found' },
				{
					status: 404,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Check if user owns the image
		if (metadata.uploadedBy !== user.id) {
			return json(
				{ error: 'Unauthorized to modify this image' },
				{
					status: 403,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Parse request body
		const updateData = await request.json();

		// Prepare update object
		const updates: any = {};

		// Validate and update allowed fields
		if (updateData.filename !== undefined) {
			// Sanitize filename
			const sanitizedFilename = updateData.filename.trim().replace(/[^a-zA-Z0-9._\-\s]/g, '');
			if (sanitizedFilename.length === 0) {
				return json(
					{ error: 'Invalid filename' },
					{
						status: 400,
						headers: {
							'Access-Control-Allow-Origin': '*'
						}
					}
				);
			}
			updates.filename = sanitizedFilename;
		}

		if (updateData.isPublic !== undefined) {
			updates.isPublic = Boolean(updateData.isPublic);
		}

		if (updateData.tags !== undefined && Array.isArray(updateData.tags)) {
			updates.tags = updateData.tags
				.map((tag: string) => tag.trim())
				.filter((tag: string) => tag.length > 0);
		}

		try {
			// Update the image in D1
			// Note: We need to implement an updateImage method in D1Utils
			// For now, we'll handle this at the database level
			const updateFields = [];
			const updateValues = [];

			if (updates.filename) {
				updateFields.push('filename = ?');
				updateValues.push(updates.filename);
			}
			if (updates.isPublic !== undefined) {
				updateFields.push('is_public = ?');
				updateValues.push(updates.isPublic);
			}
			if (updates.tags) {
				updateFields.push('tags = ?');
				updateValues.push(JSON.stringify(updates.tags));
			}

			if (updateFields.length > 0) {
				updateFields.push('updated_at = ?');
				updateValues.push(new Date().toISOString());
				updateValues.push(imageId);

				await env.DB.prepare(`
					UPDATE images 
					SET ${updateFields.join(', ')}
					WHERE id = ?
				`).bind(...updateValues).run();
			}

			// Get updated metadata
			const updatedMetadata = await db.images.getImageById(imageId);

			return json(
				{
					success: true,
					message: 'Image updated successfully',
					metadata: updatedMetadata
				},
				{
					status: 200,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		} catch (saveError) {
			console.error('Error saving updated metadata:', saveError);
			return json(
				{
					error: 'Failed to save changes',
					details: saveError instanceof Error ? saveError.message : 'Unknown error'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}
	} catch (error) {
		console.error('Error in PUT endpoint:', error);
		return json(
			{ error: 'Internal server error' },
			{
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}
};

// Handle CORS preflight requests
export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'DELETE, PUT, GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};

export const GET = async ({ params, platform }: RequestEvent) => {
	try {
		const { imageId } = params;
		const env = platform?.env;

		if (!imageId) {
			return new Response('Image ID required', { status: 400 });
		}

		if (!env?.IMAGES_BUCKET || !env?.DB) {
			console.error('IMAGES_BUCKET R2 binding or DB not found');
			return new Response('Server configuration error', { status: 500 });
		}

		// Handle different types of image requests
		let objectKey: string;

		// Check if it's a profile picture request
		if (imageId.startsWith('profile-pictures/')) {
			objectKey = imageId;
		} else {
			// For regular images, get metadata from D1 to find the correct R2 key
			const db = new D1Utils(env.DB);
			const metadata = await db.images.getImageById(imageId);
			
			if (!metadata) {
				return new Response('Image not found', { status: 404 });
			}
			
			objectKey = metadata.r2Key;
		}

		// Get the image from R2
		const object = await env.IMAGES_BUCKET.get(objectKey);

		if (!object) {
			return new Response('Image not found', { status: 404 });
		}

		const imageData = await object.arrayBuffer();
		const contentType = object.httpMetadata?.contentType || 'image/jpeg';

		return new Response(imageData, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000', // 1 year cache
				'Access-Control-Allow-Origin': '*'
			}
		});
	} catch (error) {
		console.error('Image serving error:', error);
		return new Response('Internal server error', { status: 500 });
	}
};
