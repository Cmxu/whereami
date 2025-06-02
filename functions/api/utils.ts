import type { Env, APIResponse, ImageMetadata, CustomGame } from './types';

export function corsHeaders(origin: string = '*') {
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Access-Control-Max-Age': '86400'
	};
}

export function createResponse<T>(
	data: T | null = null,
	status: number = 200,
	message?: string,
	error?: string
): Response {
	const response: APIResponse<T> = {
		success: status >= 200 && status < 300,
		...(data && { data }),
		...(message && { message }),
		...(error && { error })
	};

	return new Response(JSON.stringify(response), {
		status,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders()
		}
	});
}

export function createErrorResponse(message: string, status: number = 400): Response {
	return createResponse(null, status, undefined, message);
}

export function generateId(prefix: string = ''): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${prefix}${prefix ? '_' : ''}${timestamp}_${random}`;
}

export function validateLocation(lat: number, lng: number): boolean {
	return (
		typeof lat === 'number' &&
		typeof lng === 'number' &&
		lat >= -90 &&
		lat <= 90 &&
		lng >= -180 &&
		lng <= 180 &&
		!isNaN(lat) &&
		!isNaN(lng)
	);
}

export function validateImageFile(file: File, env: Env): { valid: boolean; error?: string } {
	const maxSize = parseInt(env.MAX_FILE_SIZE);
	const allowedTypes = env.ALLOWED_FILE_TYPES.split(',').map((type) => type.trim());

	if (file.size > maxSize) {
		return {
			valid: false,
			error: `File size too large. Maximum allowed size is ${Math.round(maxSize / 1024 / 1024)}MB`
		};
	}

	if (!allowedTypes.includes(file.type)) {
		return {
			valid: false,
			error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
		};
	}

	return { valid: true };
}

export async function getImageMetadata(imageId: string, env: Env): Promise<ImageMetadata | null> {
	try {
		const metadata = await env.GAME_METADATA.get(`image:${imageId}`);
		return metadata ? JSON.parse(metadata) : null;
	} catch (error) {
		console.error('Error getting image metadata:', error);
		return null;
	}
}

export async function saveImageMetadata(metadata: ImageMetadata, env: Env): Promise<boolean> {
	try {
		await env.GAME_METADATA.put(`image:${metadata.id}`, JSON.stringify(metadata));

		// Also store in public index if public
		if (metadata.isPublic) {
			const publicImages = await getPublicImages(env);
			publicImages.unshift(metadata.id);
			// Keep only latest 1000 public images
			if (publicImages.length > 1000) {
				publicImages.splice(1000);
			}
			await env.GAME_METADATA.put('public_images', JSON.stringify(publicImages));
		}

		return true;
	} catch (error) {
		console.error('Error saving image metadata:', error);
		return false;
	}
}

export async function getPublicImages(env: Env): Promise<string[]> {
	try {
		const images = await env.GAME_METADATA.get('public_images');
		return images ? JSON.parse(images) : [];
	} catch (error) {
		console.error('Error getting public images:', error);
		return [];
	}
}

export async function getGameMetadata(gameId: string, env: Env): Promise<CustomGame | null> {
	try {
		const metadata = await env.GAME_METADATA.get(`game:${gameId}`);
		return metadata ? JSON.parse(metadata) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

export async function saveGameMetadata(metadata: CustomGame, env: Env): Promise<boolean> {
	try {
		await env.GAME_METADATA.put(`game:${metadata.id}`, JSON.stringify(metadata));

		// Also store in public index if public
		if (metadata.isPublic) {
			const publicGames = await getPublicGames(env);
			publicGames.unshift(metadata.id);
			// Keep only latest 1000 public games
			if (publicGames.length > 1000) {
				publicGames.splice(1000);
			}
			await env.GAME_METADATA.put('public_games', JSON.stringify(publicGames));
		}

		return true;
	} catch (error) {
		console.error('Error saving game metadata:', error);
		return false;
	}
}

export async function getPublicGames(env: Env): Promise<string[]> {
	try {
		const games = await env.GAME_METADATA.get('public_games');
		return games ? JSON.parse(games) : [];
	} catch (error) {
		console.error('Error getting public games:', error);
		return [];
	}
}

export async function incrementGamePlayCount(gameId: string, env: Env): Promise<void> {
	try {
		const game = await getGameMetadata(gameId, env);
		if (game) {
			game.playCount += 1;
			await saveGameMetadata(game, env);
		}
	} catch (error) {
		console.error('Error incrementing play count:', error);
	}
}

export function sanitizeFilename(filename: string): string {
	return filename
		.replace(/[^a-zA-Z0-9.-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}

export async function createThumbnail(
	imageBuffer: ArrayBuffer,
	maxWidth: number = 300
): Promise<ArrayBuffer> {
	// Note: This is a simplified version. In production, you'd want to use a proper image processing library
	// For now, we'll return the original image and let the frontend handle thumbnails
	return imageBuffer;
}

export function logAnalytics(event: any, env: Env): void {
	// Log analytics event
	// In production, you might want to send this to an analytics service
	if (env.ENVIRONMENT === 'development') {
		console.log('Analytics event:', event);
	}
}
