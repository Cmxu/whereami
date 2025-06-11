import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { D1Utils } from '$lib/db/d1-utils';

interface AuthenticatedUser {
	id: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	username?: string;
}

// Extract token from Authorization header
function extractToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');
	if (!authHeader) return null;

	const parts = authHeader.split(' ');
	if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

	return parts[1];
}

// Verify Supabase JWT token
async function verifySupabaseToken(token: string, env: any): Promise<AuthenticatedUser | null> {
	try {
		const parts = token.split('.');
		if (parts.length !== 3) {
			return null;
		}

		const payload = JSON.parse(atob(parts[1]));

		if (payload.exp && payload.exp < Date.now() / 1000) {
			return null;
		}

		if (payload.iss !== env.PUBLIC_SUPABASE_URL + '/auth/v1') {
			return null;
		}

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



// Handle CORS preflight requests
export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};

// GET - Retrieve user profile
export const GET = async ({ request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: Database not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const token = extractToken(request);
		if (!token) {
			return json(
				{ error: 'Authentication required' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const user = await verifySupabaseToken(token, env);
		if (!user) {
			return json(
				{ error: 'Invalid authentication token' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

		// Get user profile from D1
		let userData = await db.users.getUserById(user.id);
		
		if (!userData) {
			// Create user if doesn't exist
			userData = await db.users.createUser({
				id: user.id,
				username: user.username || user.email?.split('@')[0],
				email: user.email
			});
		}

		// Get user's games and images counts from D1
		const userGames = await db.games.getUserGames(user.id, 1000);
		const userImages = await db.images.getUserImages(user.id, 1000);

		const profileWithStats = {
			id: userData.id,
			email: userData.email,
			username: userData.username,
			avatar: userData.avatar,
			joinedAt: userData.joinedAt,
			gamesCreated: userGames.length,
			gamesPlayed: userData.gamesPlayed || 0,
			imagesUploaded: userImages.length,
			totalScore: userData.totalScore || 0,
			averageScore: userData.averageScore || 0
		};

		return json(
			{
				success: true,
				profile: profileWithStats
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Profile GET error:', error);
		return json(
			{ error: 'Failed to retrieve profile' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};

// PUT - Update user profile
export const PUT = async ({ request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: Database not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const token = extractToken(request);
		if (!token) {
			return json(
				{ error: 'Authentication required' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const user = await verifySupabaseToken(token, env);
		if (!user) {
			return json(
				{ error: 'Invalid authentication token' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const { username } = await request.json();

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

		// Update user profile
		await db.users.updateUser(user.id, {
			username: username || user.username,
			email: user.email
		});

		// Get updated profile
		const updatedProfile = await db.users.getUserById(user.id);

		return json(
			{ success: true, profile: updatedProfile },
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Profile PUT error:', error);
		return json(
			{ error: 'Failed to update profile' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};

// POST - Upload profile picture
export const POST = async ({ request, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB || !env?.IMAGES_BUCKET) {
			return json(
				{ error: 'Server configuration error' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const token = extractToken(request);
		if (!token) {
			return json(
				{ error: 'Authentication required' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const user = await verifySupabaseToken(token, env);
		if (!user) {
			return json(
				{ error: 'Invalid authentication token' },
				{
					status: 401,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const formData = await request.formData();
		const imageFile = formData.get('profilePicture') as File;

		if (!imageFile) {
			return json(
				{ error: 'No profile picture provided' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Validate file type and size
		if (!imageFile.type.startsWith('image/')) {
			return json(
				{ error: 'File must be an image' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		if (imageFile.size > 5 * 1024 * 1024) {
			// 5MB limit
			return json(
				{ error: 'Image must be smaller than 5MB' },
				{
					status: 400,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Generate unique filename for profile picture
		const fileExtension = imageFile.name.split('.').pop() || 'jpg';
		const fileName = `profile-pictures/${user.id}.${fileExtension}`;

		// Upload to R2
		const imageBuffer = await imageFile.arrayBuffer();
		await env.IMAGES_BUCKET.put(fileName, imageBuffer, {
			httpMetadata: {
				contentType: imageFile.type
			}
		});

		// Initialize D1 utilities
		const db = new D1Utils(env.DB);

		// Update user profile with avatar URL
		await db.users.updateUser(user.id, {
			avatar: fileName
		});

		// Get updated profile
		const updatedProfile = await db.users.getUserById(user.id);

		return json(
			{
				success: true,
				profilePicture: fileName,
				profile: updatedProfile
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Profile picture upload error:', error);
		return json(
			{ error: 'Failed to upload profile picture' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};
