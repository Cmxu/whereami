import { json } from '@sveltejs/kit';

const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function createApiResponse<T>(data: T, status: number = 200) {
	return json(data, {
		status,
		headers: CORS_HEADERS
	});
}

export function createApiErrorResponse(message: string, status: number = 400) {
	return json(
		{ error: message },
		{
			status,
			headers: CORS_HEADERS
		}
	);
}

export function handleApiError(error: unknown, context: string) {
	console.error(`${context}:`, error);
	const message = error instanceof Error ? error.message : 'Internal server error';
	return createApiErrorResponse(message, 500);
}

export function createCorsResponse() {
	return new Response(null, {
		status: 200,
		headers: CORS_HEADERS
	});
}
