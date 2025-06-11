import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

// Extract token from Authorization header
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) return null;

	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

	return parts[1];
}

export const GET = async ({ request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		
		// Get the token
		const token = extractToken(request);
		if (!token) {
			return json({ error: 'No token provided' }, { status: 401 });
		}

		// Decode the JWT payload (without verification)
		try {
			const parts = token.split('.');
			if (parts.length !== 3) {
				return json({ error: 'Invalid JWT format' }, { status: 400 });
			}

			const payload = JSON.parse(atob(parts[1]));
			
			return json({
				tokenExists: true,
				tokenParts: parts.length,
				payload: {
					iss: payload.iss,
					sub: payload.sub,
					exp: payload.exp,
					currentTime: Date.now() / 1000,
					isExpired: payload.exp < Date.now() / 1000
				},
				environment: {
					PUBLIC_SUPABASE_URL: env?.PUBLIC_SUPABASE_URL,
					expectedIssuer: env?.PUBLIC_SUPABASE_URL + '/auth/v1'
				},
				issuerMatch: payload.iss === (env?.PUBLIC_SUPABASE_URL + '/auth/v1')
			});
		} catch (error) {
			return json({ 
				error: 'Failed to decode token', 
				details: error instanceof Error ? error.message : 'Unknown error'
			}, { status: 400 });
		}

	} catch (error) {
		return json({ 
			error: 'Debug endpoint error', 
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
}; 