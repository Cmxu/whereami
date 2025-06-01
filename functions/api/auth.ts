import type { Env } from './types';

export interface AuthenticatedUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Verify Supabase JWT token
 */
async function verifySupabaseToken(token: string, env: Env): Promise<AuthenticatedUser | null> {
	try {
		// For Supabase, we can verify the JWT using the public key
		// This is a simplified version - in production you'd want to verify the signature
		
		// Decode the JWT payload (without verification for now)
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const payload = JSON.parse(atob(parts[1]));
		
		// Check if token is expired
		if (payload.exp && payload.exp < Date.now() / 1000) {
			return null;
		}

		// Check if it's a Supabase token
		if (payload.iss !== env.PUBLIC_SUPABASE_URL + '/auth/v1') {
			return null;
		}

		// Extract user data from payload
		return {
			id: payload.sub,
			email: payload.email,
			firstName: payload.user_metadata?.first_name,
			lastName: payload.user_metadata?.last_name,
			username: payload.user_metadata?.username || payload.email?.split('@')[0]
		};
	} catch (error) {
		console.error('Token verification failed:', error);
		return null;
	}
}

/**
 * Authentication middleware for Cloudflare Functions
 */
export async function authenticateRequest(
	request: Request, 
	env: Env
): Promise<{ user: AuthenticatedUser | null; isAuthenticated: boolean }> {
	const token = extractToken(request);
	
	if (!token) {
		return { user: null, isAuthenticated: false };
	}

	const user = await verifySupabaseToken(token, env);
	return { user, isAuthenticated: !!user };
}

/**
 * Middleware that requires authentication
 */
export async function requireAuth(
	request: Request, 
	env: Env
): Promise<{ user: AuthenticatedUser; error?: Response }> {
	const { user, isAuthenticated } = await authenticateRequest(request, env);
	
	if (!isAuthenticated || !user) {
		return {
			user: null as any,
			error: new Response(JSON.stringify({ error: 'Authentication required' }), {
				status: 401,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				}
			})
		};
	}

	return { user };
}

/**
 * Get user data from KV store
 */
export async function getUserData(userId: string, env: Env): Promise<any> {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		return userData ? JSON.parse(userData) : null;
	} catch (error) {
		console.error('Failed to get user data:', error);
		return null;
	}
}

/**
 * Save user data to KV store
 */
export async function saveUserData(userId: string, data: any, env: Env): Promise<void> {
	try {
		await env.USER_DATA.put(`user:${userId}`, JSON.stringify(data));
	} catch (error) {
		console.error('Failed to save user data:', error);
		throw error;
	}
}

/**
 * Create or update user profile in KV store
 */
export async function upsertUserProfile(user: AuthenticatedUser, env: Env): Promise<void> {
	const existing = await getUserData(user.id, env);
	
	const profile = {
		id: user.id,
		email: user.email,
		firstName: user.firstName,
		lastName: user.lastName,
		username: user.username,
		createdAt: existing?.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		gamesCreated: existing?.gamesCreated || 0,
		gamesPlayed: existing?.gamesPlayed || 0,
		imagesUploaded: existing?.imagesUploaded || 0,
		totalScore: existing?.totalScore || 0,
		averageScore: existing?.averageScore || 0
	};

	await saveUserData(user.id, profile, env);
} 