import { requireAuth, getUserData, saveUserData, upsertUserProfile } from '../auth.ts';

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
				console.error(`Failed to update user image count after ${MAX_RETRY_ATTEMPTS} attempts:`, error);
				return;
			}
			
			// Wait with exponential backoff before retrying
			const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 10;
			await new Promise(resolve => setTimeout(resolve, delay));
		}
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

		// Ensure user profile exists
		await upsertUserProfile(user, env);

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

		// Generate unique ID and filename
		const uniqueId = crypto.randomUUID();
		const fileExtension = imageFile.name.split('.').pop() || 'jpg';
		const sanitizedName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
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
					locationLng: String(location.lng),
					uploadedBy: user.id // Track who uploaded this image
				}
			});

			// Construct the image URL
			const imageUrl = `/api/images/${uniqueId}/${sanitizedName}`;

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
				isPublic: true // Default to public, can be changed later
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
				const publicImages = publicImagesData ? JSON.parse(publicImagesData) : [];

				// Add the new image to the beginning of the list
				publicImages.unshift(uniqueId);

				// Keep only the last 1000 public images
				if (publicImages.length > 1000) {
					publicImages.splice(1000);
				}

				await env.IMAGE_DATA.put('public_images', JSON.stringify(publicImages));
			}

			return new Response(
				JSON.stringify({
					success: true,
					message: 'Image uploaded successfully',
					imageUrl: imageUrl,
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
