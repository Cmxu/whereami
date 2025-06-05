import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

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

// Get user data from KV store
async function getUserData(userId: string, env: any): Promise<any> {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		return userData ? JSON.parse(userData) : null;
	} catch (error) {
		console.error('Failed to get user data:', error);
		return null;
	}
}

// Save user data to KV store
async function saveUserData(userId: string, data: any, env: any): Promise<void> {
	try {
		await env.USER_DATA.put(`user:${userId}`, JSON.stringify(data));
	} catch (error) {
		console.error('Failed to save user data:', error);
		throw error;
	}
}

export const DELETE = async ({ params, request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;

		if (!env?.USER_DATA || !env?.IMAGE_DATA || !env?.IMAGES_BUCKET) {
			console.error('KV namespaces or R2 bucket not available');
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

		// Get image metadata
		const metadata = await getImageMetadata(imageId, env);
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

			// Delete metadata from KV
			await env.IMAGE_DATA.delete(`image:${imageId}`);

			// Remove from user's images list
			const userImagesKey = `user:${user.id}:images`;
			const userImagesData = await env.USER_DATA.get(userImagesKey);
			if (userImagesData) {
				const imagesList: string[] = JSON.parse(userImagesData);
				const filteredImages = imagesList.filter(id => id !== imageId);
				await env.USER_DATA.put(userImagesKey, JSON.stringify(filteredImages));
			}

			// Remove from public images index if it was public
			if (metadata.isPublic) {
				const publicImagesData = await env.IMAGE_DATA.get('public_images');
				if (publicImagesData) {
					const publicImages: string[] = JSON.parse(publicImagesData);
					const filteredPublicImages = publicImages.filter(id => id !== imageId);
					await env.IMAGE_DATA.put('public_images', JSON.stringify(filteredPublicImages));
				}
			}

			// Update user's image count
			const userData = await getUserData(user.id, env);
			if (userData && userData.imagesUploaded > 0) {
				userData.imagesUploaded = userData.imagesUploaded - 1;
				userData.updatedAt = new Date().toISOString();
				await saveUserData(user.id, userData, env);
			}

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

		if (!env?.USER_DATA || !env?.IMAGE_DATA) {
			console.error('KV namespaces not available');
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

		// Get image metadata
		const metadata = await getImageMetadata(imageId, env);
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
			metadata.filename = sanitizedFilename;
		}

		if (updateData.isPublic !== undefined) {
			const wasPublic = metadata.isPublic;
			metadata.isPublic = Boolean(updateData.isPublic);

			// Update public images index if visibility changed
			if (wasPublic !== metadata.isPublic) {
				const publicImagesData = await env.IMAGE_DATA.get('public_images');
				const publicImages: string[] = publicImagesData ? JSON.parse(publicImagesData) : [];

				if (metadata.isPublic && !publicImages.includes(imageId)) {
					// Add to public index
					publicImages.unshift(imageId);
					if (publicImages.length > 1000) {
						publicImages.splice(1000);
					}
				} else if (!metadata.isPublic && publicImages.includes(imageId)) {
					// Remove from public index
					const filteredImages = publicImages.filter(id => id !== imageId);
					await env.IMAGE_DATA.put('public_images', JSON.stringify(filteredImages));
				}

				if (metadata.isPublic) {
					await env.IMAGE_DATA.put('public_images', JSON.stringify(publicImages));
				}
			}
		}

		if (updateData.tags !== undefined && Array.isArray(updateData.tags)) {
			metadata.tags = updateData.tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
		}

		// Update the updatedAt timestamp
		metadata.updatedAt = new Date().toISOString();

		try {
			// Save updated metadata to KV
			await env.IMAGE_DATA.put(`image:${imageId}`, JSON.stringify(metadata));

			return json(
				{ 
					success: true, 
					message: 'Image updated successfully',
					metadata: metadata
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
			'Access-Control-Allow-Methods': 'DELETE, PUT, OPTIONS',
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

		if (!env?.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return new Response('Server configuration error', { status: 500 });
		}

		// Handle different types of image requests
		let objectKey: string;
		
		// Check if it's a profile picture request
		if (imageId.startsWith('profile-pictures/')) {
			objectKey = imageId;
		} else {
			// Legacy handling for regular images
			objectKey = imageId;
		}

		console.log('Fetching image with key:', objectKey);

		// Get the image from R2
		const object = await env.IMAGES_BUCKET.get(objectKey);

		if (!object) {
			console.log('Image not found:', objectKey);
			return new Response('Image not found', { status: 404 });
		}

		const imageData = await object.arrayBuffer();
		const contentType = object.httpMetadata?.contentType || 'image/jpeg';

		console.log('Image found, size:', imageData.byteLength, 'type:', contentType);

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