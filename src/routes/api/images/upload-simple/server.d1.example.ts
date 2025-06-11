/**
 * EXAMPLE: Image upload API route migrated to use D1 instead of KV
 * This is an example of how to migrate your existing KV-based routes to D1
 * 
 * Key changes:
 * 1. Import D1Utils instead of direct KV access
 * 2. Use structured database operations instead of JSON key-value storage
 * 3. Leverage relational data and transactions
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';
import { D1Utils } from '$lib/db/d1-utils';

interface AuthenticatedUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}
	return null;
}

async function verifySupabaseToken(token: string, env: any): Promise<AuthenticatedUser | null> {
	try {
		const response = await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/user`, {
			headers: {
				Authorization: `Bearer ${token}`,
				apikey: env.PUBLIC_SUPABASE_ANON_KEY
			}
		});

		if (!response.ok) {
			return null;
		}

		const userData = await response.json();
		return {
			id: userData.id,
			email: userData.email,
			firstName: userData.user_metadata?.first_name,
			lastName: userData.user_metadata?.last_name,
			username: userData.user_metadata?.username
		};
	} catch (error) {
		console.error('Token verification error:', error);
		return null;
	}
}

export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};

export const POST = async ({ request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.IMAGES_BUCKET || !env?.DB) {
			return json(
				{
					error: 'Server configuration error: Required services not configured'
				},
				{
					status: 500,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

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

		// Parse form data
		const formData = await request.formData();
		const imageFile = formData.get('image') as File;
		const locationStr = formData.get('location') as string;
		const customName = formData.get('customName') as string;
		const sourceUrl = formData.get('sourceUrl') as string;

		// Validate required fields
		if (!imageFile || !locationStr) {
			return json(
				{
					error: 'Image file and location data are required'
				},
				{
					status: 400,
					headers: {
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Parse and validate location
		let location;
		try {
			location = JSON.parse(locationStr);
			if (!location.lat || !location.lng) {
				throw new Error('Invalid location format');
			}
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

		const maxSizeBytes = 10 * 1024 * 1024; // 10MB
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

		let filename;
		if (customName && customName.trim()) {
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
			await env.IMAGES_BUCKET.put(r2Key, arrayBuffer, {
				httpMetadata: {
					contentType: imageFile.type,
					cacheControl: 'public, max-age=31536000'
				},
				customMetadata: {
					originalFilename: imageFile.name,
					uploadedAt: new Date().toISOString(),
					locationLat: String(location.lat),
					locationLng: String(location.lng),
					uploadedBy: user.id
				}
			});

			// Create or update user in D1 (upsert pattern)
			let userProfile = await db.users.getUserById(user.id);
			if (!userProfile) {
				userProfile = await db.users.createUser({
					id: user.id,
					username: user.username || user.email?.split('@')[0],
					email: user.email,
					avatar: undefined // Could be set from user data
				});
			}

			// Create image record in D1
			const imageMetadata = await db.images.createImage({
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				location: { lat: location.lat, lng: location.lng },
				uploadedBy: user.id,
				uploadedByUsername: userProfile.username,
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				isPublic: true, // Default to public
				sourceUrl: sourceUrl?.trim() || undefined,
				tags: [] // Could be extracted from EXIF or user input
			});

			// Update user's image count
			await db.users.incrementUserStats(user.id, {
				imagesUploaded: 1
			});

			// Construct response URLs
			const imageUrl = `/api/images/${uniqueId}/${sanitizedName}`;
			const thumbnailUrl = `/api/images/${uniqueId}/${sanitizedName}?w=300&h=300&fit=cover&q=80`;

			return json(
				{
					success: true,
					message: 'Image uploaded successfully',
					imageUrl: imageUrl,
					thumbnailUrl: thumbnailUrl,
					metadata: {
						...imageMetadata,
						url: imageUrl,
						thumbnailUrl: thumbnailUrl
					}
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
					error: 'Failed to upload image',
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

/*
KEY DIFFERENCES FROM KV VERSION:

1. DATA STORAGE:
   - KV: await env.IMAGE_DATA.put(`image:${uniqueId}`, JSON.stringify(metadata));
   - D1: await db.images.createImage(imageData);

2. USER MANAGEMENT:
   - KV: Manual JSON manipulation and atomic increment functions
   - D1: Proper user table with foreign key relationships and atomic SQL operations

3. QUERYING:
   - KV: await env.USER_DATA.get(`user:${userId}:images`); (requires maintaining lists)
   - D1: await db.images.getUserImages(userId); (uses SQL with proper indexing)

4. CONSISTENCY:
   - KV: Manual list management, potential for inconsistency
   - D1: Relational integrity with foreign keys and transactions

5. PERFORMANCE:
   - KV: Multiple separate operations for related data
   - D1: Single transaction for related operations, proper indexing

MIGRATION BENEFITS:
- Automatic relationship management
- Better query performance with indexes
- Atomic transactions ensure data consistency
- Easier to add new features like image tagging, user statistics, etc.
- More maintainable code with structured data operations
*/ 