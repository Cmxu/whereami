// Handle CORS preflight requests
export async function onRequestOptions() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
	});
}

export async function onRequestGet(context) {
	try {
		const { request, env } = context;
		
		// Check if R2 bucket is available
		if (!env.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return new Response('Server configuration error', { status: 500 });
		}

		// Extract the path from the URL
		const url = new URL(request.url);
		const path = url.pathname.replace('/api/images/', '');
		
		if (!path) {
			return new Response('Image path required', { status: 400 });
		}

		// Construct the R2 key
		const r2Key = `images/${path}`;

		try {
			// Get the object from R2
			const object = await env.IMAGES_BUCKET.get(r2Key);
			
			if (!object) {
				return new Response('Image not found', { status: 404 });
			}

			// Get the content type from metadata or default to a generic image type
			const contentType = object.httpMetadata?.contentType || 'image/jpeg';
			
			// Return the image with proper headers
			return new Response(object.body, {
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=31536000', // 1 year cache
					'Access-Control-Allow-Origin': '*',
				},
			});

		} catch (storageError) {
			console.error('Error retrieving image from R2:', storageError);
			return new Response('Failed to retrieve image', { status: 500 });
		}

	} catch (error) {
		console.error('Server error:', error);
		return new Response('Internal server error', { status: 500 });
	}
} 