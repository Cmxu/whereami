import { requireAuth, getUserData, saveUserData, upsertUserProfile } from '../auth.ts';

// D1 utilities for Cloudflare Functions
class D1Utils {
	constructor(db) {
		this.db = db;
		this.users = new UserDB(db);
		this.images = new ImageDB(db);
	}
}

class UserDB {
	constructor(db) {
		this.db = db;
	}

	async getUserById(userId) {
		const result = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
		return result;
	}

	async createUser(user) {
		const result = await this.db.prepare(`
			INSERT INTO users (id, username, email, avatar, created_at)
			VALUES (?, ?, ?, ?, datetime('now'))
			ON CONFLICT(id) DO UPDATE SET
				username = excluded.username,
				email = excluded.email,
				updated_at = datetime('now')
			RETURNING *
		`).bind(
			user.id,
			user.username || null,
			user.email || null,
			user.avatar || null
		).first();
		return result;
	}

	async incrementUserStats(userId, stats) {
		if (stats.imagesUploaded) {
			await this.db.prepare(`
				UPDATE users 
				SET images_uploaded = images_uploaded + ?, updated_at = datetime('now')
				WHERE id = ?
			`).bind(stats.imagesUploaded, userId).run();
		}
	}
}

class ImageDB {
	constructor(db) {
		this.db = db;
	}

	async createImage(image) {
		const result = await this.db.prepare(`
			INSERT INTO images (
				id, filename, r2_key, location_lat, location_lng, 
				uploaded_by, uploaded_by_username, file_size, mime_type, 
				is_public, source_url, tags, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
			RETURNING *
		`).bind(
			image.id,
			image.filename,
			image.r2Key,
			image.location.lat,
			image.location.lng,
			image.uploadedBy,
			image.uploadedByUsername,
			image.fileSize,
			image.mimeType,
			image.isPublic ? 1 : 0,
			image.sourceUrl || null,
			JSON.stringify(image.tags || [])
		).first();
		return result;
	}
}

// Handle CORS preflight requests
export async function onRequestOptions() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
}

// Update user's upload count with retry mechanism to prevent race conditions
const MAX_RETRY_ATTEMPTS = 10;
const BASE_DELAY = 50; // Base delay in milliseconds

async function atomicIncrementUserImages(userId, env) {
	// This is now handled by D1Utils.users.incrementUserStats
	// Keep for backward compatibility but no longer used
}

async function upsertUserProfileD1(user, db) {
	try {
		let userProfile = await db.users.getUserById(user.id);
		
		if (!userProfile) {
			// Create new user
			userProfile = await db.users.createUser({
				id: user.id,
				username: user.username || user.email?.split('@')[0],
				email: user.email,
				avatar: undefined
			});
		}
		return userProfile;
	} catch (error) {
		console.error('Failed to upsert user profile:', error);
		throw error;
	}
}

export async function onRequestPost(context) {
	try {
		const { request, env } = context;

		// Require authentication
		const { user, error } = await requireAuth(request, env);
		if (error) {
			return error;
		}

		// Check if D1 database is available
		if (!env.DB) {
			console.error('D1 database not found');
			return new Response(
				JSON.stringify({
					error: 'Server configuration error: Database not configured'
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

		// Ensure user profile exists in D1
		await upsertUserProfileD1(user, db);

		// Check if R2 bucket is available
		if (!env.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return new Response(
				JSON.stringify({
					error: 'Server configuration error: R2 bucket not configured'
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Parse form data
		const formData = await request.formData();
		const imageFile = formData.get('image');
		const locationStr = formData.get('location');
		const customName = formData.get('customName');
		const sourceUrl = formData.get('sourceUrl');
		const isPublicStr = formData.get('isPublic');

		if (!imageFile) {
			return new Response(
				JSON.stringify({
					error: 'No image file provided'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		if (!locationStr) {
			return new Response(
				JSON.stringify({
					error: 'Location data required'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
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
			return new Response(
				JSON.stringify({
					error: 'Invalid location data format'
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Validate file type and size
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedTypes.includes(imageFile.type)) {
			return new Response(
				JSON.stringify({
					error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}

		// Check file size (10MB limit)
		const maxSizeBytes = 10 * 1024 * 1024; // 10MB
		if (imageFile.size > maxSizeBytes) {
			return new Response(
				JSON.stringify({
					error: `File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB`
				}),
				{
					status: 400,
					headers: {
						'Content-Type': 'application/json',
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
			// Upload to R2
			await env.IMAGES_BUCKET.put(r2Key, await imageFile.arrayBuffer(), {
				httpMetadata: {
					contentType: imageFile.type,
					cacheControl: 'public, max-age=31536000' // 1 year cache
				},
				customMetadata: {
					originalFilename: imageFile.name,
					uploadedAt: new Date().toISOString(),
					locationLat: String(location.lat),
					locationLng: String(location.lng || location.lon), // Support both lng and lon
					uploadedBy: user.id // Track who uploaded this image
				}
			});

			// Construct the image URL
			const imageUrl = `/api/images/${uniqueId}/${sanitizedName}`;
			const thumbnailUrl = `/api/images/${uniqueId}/${sanitizedName}?w=300&h=300&fit=cover&q=80`;

			// Prepare metadata for response
			const metadata = {
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				location: {
					lat: location.lat,
					lng: location.lng || location.lon // Support both lng and lon
				},
				uploadedAt: new Date().toISOString(),
				uploadedBy: user.id,
				uploadedByUsername: user.username || user.email?.split('@')[0] || 'User',
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				url: imageUrl,
				thumbnailUrl: thumbnailUrl,
				isPublic: isPublic,
				...(sourceUrl && sourceUrl.trim() && { sourceUrl: sourceUrl.trim() })
			};

			// Store image metadata in D1
			await db.images.createImage({
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				location: {
					lat: location.lat,
					lng: location.lng || location.lon // Support both lng and lon
				},
				uploadedBy: user.id,
				uploadedByUsername: user.username || user.email?.split('@')[0] || 'User',
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				isPublic: isPublic,
				sourceUrl: sourceUrl?.trim() || undefined,
				tags: []
			});

			// Update user image upload count
			await db.users.incrementUserStats(user.id, { imagesUploaded: 1 });

			return new Response(
				JSON.stringify({
					success: true,
					message: 'Image uploaded successfully',
					imageUrl: imageUrl,
					thumbnailUrl: thumbnailUrl,
					metadata: metadata
				}),
				{
					status: 201,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		} catch (uploadError) {
			console.error('Upload error:', uploadError);
			return new Response(
				JSON.stringify({
					error: 'Failed to upload image to storage',
					details: uploadError.message
				}),
				{
					status: 500,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*'
					}
				}
			);
		}
	} catch (error) {
		console.error('Server error:', error);
		return new Response(
			JSON.stringify({
				error: 'Internal server error',
				details: error.message
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}
}
