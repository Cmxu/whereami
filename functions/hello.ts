export async function onRequestGet(): Promise<Response> {
	return new Response(JSON.stringify({
		message: "Hello from Cloudflare Pages Functions!",
		timestamp: new Date().toISOString(),
		method: "GET"
	}), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
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
		}
	});
} 