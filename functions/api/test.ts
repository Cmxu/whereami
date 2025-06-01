// Simple test endpoint to verify API routing
export async function onRequestGet(): Promise<Response> {
	return new Response(JSON.stringify({
		message: "API is working!",
		timestamp: new Date().toISOString(),
		method: "GET"
	}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		}
	});
}

export async function onRequestOptions(): Promise<Response> {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		}
	});
} 