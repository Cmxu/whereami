import type { RequestEvent } from '@sveltejs/kit';

export const GET = async ({ params, url, request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;

		if (!env?.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return new Response('Server configuration error', { status: 500 });
		}

		// Extract the path from params
		const path = params.path;

		if (!path) {
			return new Response('Image path required', { status: 400 });
		}

		// Construct the R2 key
		// Special handling for profile pictures - they are stored directly at the path
		let r2Key: string;
		if (path.startsWith('profile-pictures/')) {
			r2Key = path;
		} else {
			r2Key = `images/${path}`;
		}

		// Parse transformation parameters from query string
		const width = url.searchParams.get('w');
		const height = url.searchParams.get('h');
		const fit = url.searchParams.get('fit') || 'scale-down';
		const quality = url.searchParams.get('q') || '85';
		const format = url.searchParams.get('f');

		try {
			// Get the object from R2
			const object = await env.IMAGES_BUCKET.get(r2Key);

			if (!object) {
				console.log('Image not found at key:', r2Key);
				return new Response('Image not found', { status: 404 });
			}

			// Get the content type from metadata or default to JPEG
			const contentType = object.httpMetadata?.contentType || 'image/jpeg';

			// Note: In SvelteKit environment, Cloudflare Workers image transformations
			// are not available. For thumbnails, we rely on the Cloudflare Functions
			// endpoint which has full Workers API access, or return the original image.

			// Check if this is a thumbnail request
			const isTransformation = width || height || format;

			if (isTransformation) {
				// Log transformation request for debugging
				console.log(`Transformation requested: w=${width}, h=${height}, format=${format}`);
				console.log(
					'Note: SvelteKit endpoint returns original image. Use Cloudflare Functions for transformations.'
				);
			}

			// Return the original image
			// For actual transformations, the app should use the Cloudflare Functions endpoint
			return new Response(object.body as BodyInit, {
				headers: {
					'Content-Type': contentType,
					'Cache-Control': 'public, max-age=31536000', // 1 year cache
					'Access-Control-Allow-Origin': '*'
				}
			});
		} catch (storageError) {
			console.error('Error retrieving image from R2:', storageError);
			return new Response('Failed to retrieve image', { status: 500 });
		}
	} catch (error) {
		console.error('Server error:', error);
		return new Response('Internal server error', { status: 500 });
	}
};

// Handle CORS preflight requests
export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};
