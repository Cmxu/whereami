import type { Env, ImageMetadata, UploadImageRequest } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	generateId,
	validateLocation,
	validateImageFile,
	saveImageMetadata,
	sanitizeFilename,
	createThumbnail,
	logAnalytics,
} from '../utils';

// Handle CORS preflight requests
export async function onRequestOptions(): Promise<Response> {
	return new Response(null, { 
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
	});
}

export async function onRequestPost(context: any): Promise<Response> {
	try {
		const { request, env } = context;

		// Check if R2 bucket is available
		if (!env.IMAGES_BUCKET) {
			console.error('IMAGES_BUCKET R2 binding not found');
			return new Response(JSON.stringify({ 
				error: 'Server configuration error: R2 bucket not configured' 
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});
		}

		// Parse form data
		const formData = await request.formData();
		const imageFile = formData.get('image') as File;
		const metadataStr = formData.get('metadata') as string;
		
		if (!imageFile) {
			return new Response(JSON.stringify({ 
				error: 'No image file provided' 
			}), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});
		}

		// Parse metadata (optional)
		let metadata = {};
		if (metadataStr) {
			try {
				metadata = JSON.parse(metadataStr);
			} catch {
				return new Response(JSON.stringify({ 
					error: 'Invalid metadata format' 
				}), {
					status: 400,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					}
				});
			}
		}

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
		if (!allowedTypes.includes(imageFile.type)) {
			return new Response(JSON.stringify({ 
				error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` 
			}), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});
		}

		// Check file size (10MB limit)
		const maxSizeBytes = 10 * 1024 * 1024; // 10MB
		if (imageFile.size > maxSizeBytes) {
			return new Response(JSON.stringify({ 
				error: `File too large. Maximum size: ${maxSizeBytes / 1024 / 1024}MB` 
			}), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});
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
					cacheControl: 'public, max-age=31536000', // 1 year cache
				},
				customMetadata: {
					originalFilename: imageFile.name,
					uploadedAt: new Date().toISOString(),
					...metadata,
				},
			});

			// Construct the image URL
			const imageUrl = `/api/images/${uniqueId}/${sanitizedName}`;

			// Prepare response metadata
			const responseMetadata = {
				id: uniqueId,
				filename: sanitizedName,
				r2Key: r2Key,
				uploadedAt: new Date().toISOString(),
				fileSize: imageFile.size,
				mimeType: imageFile.type,
				url: imageUrl,
				...metadata
			};

			return new Response(JSON.stringify({
				success: true,
				message: 'Image uploaded successfully',
				imageUrl: imageUrl,
				metadata: responseMetadata
			}), {
				status: 201,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});

		} catch (uploadError) {
			console.error('Upload error:', uploadError);
			return new Response(JSON.stringify({ 
				error: 'Failed to upload image to storage',
				details: uploadError.message 
			}), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			});
		}

	} catch (error) {
		console.error('Server error:', error);
		return new Response(JSON.stringify({ 
			error: 'Internal server error',
			details: error.message 
		}), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
			}
		});
	}
} 