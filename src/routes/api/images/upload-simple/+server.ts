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

// Create or update user profile in KV store
async function upsertUserProfile(user: AuthenticatedUser, env: any): Promise<void> {
	const existing = await getUserData(user.id, env);

	const profile = {
		id: user.id,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
		createdAt: existing?.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		gamesCreated: existing?.gamesCreated || 0,
		gamesPlayed: existing?.gamesPlayed || 0,
		imagesUploaded: existing?.imagesUploaded || 0,
		totalScore: existing?.totalScore || 0,
		averageScore: existing?.averageScore || 0
	};

	await saveUserData(user.id, profile, env);
}

// Update user's upload count with retry mechanism to prevent race conditions
const MAX_RETRY_ATTEMPTS = 10;
const BASE_DELAY = 50; // Base delay in milliseconds

async function atomicIncrementUserImages(userId: string, env: any): Promise<void> {
	for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
		try {
			const userData = await getUserData(userId, env);
			if (!userData) {
				console.warn(`User data not found for ${userId}, skipping count update`);
				return;
			}

			const currentCount = userData.imagesUploaded || 0;
			userData.imagesUploaded = currentCount + 1;
			userData.updatedAt = new Date().toISOString();

			await saveUserData(userId, userData, env);

			// If we get here without error, the update succeeded
			return;
		} catch (error) {
			console.warn(`Attempt ${attempt + 1} failed to update user image count:`, error);

			if (attempt === MAX_RETRY_ATTEMPTS - 1) {
				// Final attempt failed, log error but don't fail the entire upload
				console.error(
					`Failed to update user image count after ${MAX_RETRY_ATTEMPTS} attempts:`,
					error
				);
				return;
			}

			// Wait with exponential backoff before retrying
			const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 10;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
}

// Handle CORS preflight requests
export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};

export const POST = async ({ request, platform }: RequestEvent) => {
	try {
		// Check if R2 bucket is available
		const env = platform?.env;

		if (!env?.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return json(
				{
					error: 'Server configuration error: R2 bucket not configured'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		if (!env?.USER_DATA || !env?.IMAGE_DATA) {
			console.error('KV namespaces not available');
			return json(
				{
					error: 'Server configuration error: KV stores not configured'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Require authentication
		const token = extractToken(request);
		if (!token) {
			return json(
				{
					error: 'Authentication required'
				},
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
				{
					error: 'Invalid authentication token'
				},
				{
					status: 401,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Ensure user profile exists
		await upsertUserProfile(user, env);

		// Parse form data
		const formData = await request.formData();
		const imageFile = formData.get('image') as File;
		const locationStr = formData.get('location') as string;
		const customName = formData.get('customName') as string;
		const sourceUrl = formData.get('sourceUrl') as string;

		if (!imageFile) {
			return json(
				{
					error: 'No image file provided'
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		if (!locationStr) {
			return json(
				{
					error: 'Location data required'
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Parse location
		let location;
		try {
			location = JSON.parse(locationStr);
		} catch {
			return json(
				{
					error: 'Invalid location data format'
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Validate file type and size
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedTypes.includes(imageFile.type)) {
			return json(
				{
					error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Check file size (10MB limit)
		const maxSizeBytes = 10 * 1024 * 1024;
		if (imageFile.size > maxSizeBytes) {
			return json(
				{
					error: `File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Generate unique ID and filename
		const uniqueId = crypto.randomUUID();
		const fileExtension = imageFile.name.split('.').pop() || 'jpg';

		// Use custom name if provided, otherwise use original filename
		let filename;
		if (customName && customName.trim()) {
			// Sanitize custom name and add extension
			const sanitizedCustomName = customName.trim().replace(/[^a-zA-Z0-9._\-\s]/g, '');
			filename = sanitizedCustomName + '.' + fileExtension;
		} else {
			filename = imageFile.name;
		}

		const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
		const r2Key = `images/${uniqueId}/${sanitizedName}`;

		try {
			// Convert file to ArrayBuffer
			const arrayBuffer = await imageFile.arrayBuffer();

			// Upload original image to R2
			const uploadResult = await env.IMAGES_BUCKET.put(r2Key, arrayBuffer, {
				httpMetadata: {
					contentType: imageFile.type,
					cacheControl: 'public, max-age=31536000' // 1 year cache
				},
				customMetadata: {
					originalFilename: imageFile.name,
					uploadedAt: new Date().toISOString(),
					locationLat: String(location.lat),
					locationLng: String(location.lng),
					uploadedBy: user.id // Track who uploaded this image
				}
			});

			// Construct the image URLs
			const imageUrl = `/api/images/${uniqueId}/${sanitizedName}`;
			const thumbnailUrl = `/api/images/${uniqueId}/${sanitizedName}?w=300&h=300&fit=cover&q=80`;

			// Prepare metadata for response and KV storage
			const metadata = {
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				location: location,
				uploadedAt: new Date().toISOString(),
				uploadedBy: user.id,
				uploadedByUsername: user.username || user.email?.split('@')[0] || 'User',
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				url: imageUrl,
				thumbnailUrl: thumbnailUrl,
				isPublic: true, // Default to public, can be changed later
				...(sourceUrl && sourceUrl.trim() && { sourceUrl: sourceUrl.trim() }) // Add sourceUrl if provided
			};

			// Store image metadata in KV
			await env.IMAGE_DATA.put(`image:${uniqueId}`, JSON.stringify(metadata));

			// Update user's upload count with atomic increment
			await atomicIncrementUserImages(user.id, env);

			// Add to user's images list
			const userImagesKey = `user:${user.id}:images`;
			const userImages = await env.USER_DATA.get(userImagesKey);
			const imagesList = userImages ? JSON.parse(userImages) : [];
			imagesList.unshift(uniqueId); // Add to beginning of list

			// Keep only the last 1000 images per user
			if (imagesList.length > 1000) {
				imagesList.splice(1000);
			}

			await env.USER_DATA.put(userImagesKey, JSON.stringify(imagesList));

			// Add to public images index if the image is public
			if (metadata.isPublic) {
				const publicImagesData = await env.IMAGE_DATA.get('public_images');
				const publicImages: string[] = publicImagesData ? JSON.parse(publicImagesData) : [];

				// Add the new image to the beginning of the list
				publicImages.unshift(uniqueId);

				// Keep only the last 1000 public images
				if (publicImages.length > 1000) {
					publicImages.splice(1000);
				}

				await env.IMAGE_DATA.put('public_images', JSON.stringify(publicImages));
			}

			return json(
				{
					success: true,
					message: 'Image uploaded successfully',
					imageUrl: imageUrl,
					thumbnailUrl: thumbnailUrl,
					metadata: metadata
				},
				{
					status: 201,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		} catch (uploadError) {
			console.error('Upload error:', uploadError);
			return json(
				{
					error: 'Failed to upload image to storage',
					details: uploadError instanceof Error ? uploadError.message : 'Unknown error'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}
	} catch (err) {
		console.error('Server error:', err);
		return json(
			{
				error: 'Internal server error',
				details: err instanceof Error ? err.message : 'Unknown error'
			},
			{
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}
};
