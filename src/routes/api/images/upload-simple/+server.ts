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

// Create or update user profile in D1
async function upsertUserProfile(user: AuthenticatedUser, db: D1Utils): Promise<void> {
	try {
		let userProfile = await db.users.getUserById(user.id);
		
		if (!userProfile) {
			// Create new user
			await db.users.createUser({
				id: user.id,
				username: user.username || user.email?.split('@')[0],
				email: user.email,
				avatar: undefined
			});
		} else {
			// Update existing user if needed
			await db.users.updateUser(user.id, {
				username: user.username || userProfile.username,
				email: user.email || userProfile.email
			});
		}
	} catch (error) {
		console.error('Failed to upsert user profile:', error);
		throw error;
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

		if (!env?.DB) {
			console.error('D1 database not available');
			return json(
				{
					error: 'Server configuration error: Database not configured'
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

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);
		
		// Ensure user profile exists
		await upsertUserProfile(user, db);

		// Parse form data
		const formData = await request.formData();
		const imageFile = formData.get('image') as File;
		const locationStr = formData.get('location') as string;
		const customName = formData.get('customName') as string;
		const sourceUrl = formData.get('sourceUrl') as string;
		const isPublicStr = formData.get('isPublic') as string;

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

		// Parse privacy setting (defaults to true if not provided)
		const isPublic = isPublicStr !== null ? isPublicStr === 'true' : true;

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
				isPublic: isPublic,
				...(sourceUrl && sourceUrl.trim() && { sourceUrl: sourceUrl.trim() }) // Add sourceUrl if provided
			};

			// Store image metadata in D1
			await db.images.createImage({
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				location: location,
				uploadedBy: user.id,
				uploadedByUsername: user.username || user.email?.split('@')[0] || 'User',
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				isPublic: isPublic,
				sourceUrl: sourceUrl?.trim() || undefined
			});

			// Update user image upload count
			await db.users.incrementUserStats(user.id, { imagesUploaded: 1 });

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
