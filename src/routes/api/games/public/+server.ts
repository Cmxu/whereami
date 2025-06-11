import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { CustomGame } from '$lib/types';
import { D1Utils } from '$lib/db/d1-utils';

// Get game metadata from GAME_DATA namespace
async function getGameMetadata(gameId: string, env: any): Promise<CustomGame | null> {
	try {
		const gameData = await env.GAME_DATA.get(`game:${gameId}`);
		return gameData ? JSON.parse(gameData) : null;
	} catch (error) {
		console.error('Error getting game metadata:', error);
		return null;
	}
}

// Helper function to get user profile data including display name and profile picture
async function getUserProfile(
	userId: string,
	env: any
): Promise<{
	displayName: string;
	profilePicture: string | null;
	createdAt: string | null;
}> {
	try {
		const userData = await env.USER_DATA.get(`user:${userId}`);
		if (userData) {
			const profile = JSON.parse(userData);
			return {
				displayName: profile.displayName || profile.username || profile.email || 'Anonymous',
				profilePicture: profile.profilePicture || null,
				createdAt: profile.createdAt || null
			};
		}
		return {
			displayName: 'Anonymous',
			profilePicture: null,
			createdAt: null
		};
	} catch (error) {
		console.error('Error getting user profile:', error);
		return {
			displayName: 'Anonymous',
			profilePicture: null,
			createdAt: null
		};
	}
}

export const GET = async ({ url, platform }: RequestEvent) => {
	try {
		const env = platform?.env;
		if (!env?.DB) {
			return json(
				{ error: 'Server configuration error: D1 database not configured' },
				{
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		// Parse query parameters
		const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20')));
		const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));
		const search = url.searchParams.get('search')?.trim();
		const sortBy = (url.searchParams.get('sortBy') as 'newest' | 'popular' | 'rating') || 'newest';
		const difficulty = url.searchParams.get('difficulty')?.trim();
		const minRating = parseFloat(url.searchParams.get('minRating') || '0');
		const tags =
			url.searchParams
				.get('tags')
				?.split(',')
				.filter((tag) => tag.trim()) || [];

		// Initialize D1Utils
		const db = new D1Utils(env.DB);

		// For now, we'll fetch a reasonable amount to allow for filtering
		// In a production system, you'd want to implement search/filter at the SQL level
		const fetchLimit = Math.max(limit * 2, 100); // Get 2x requested for filtering
		let validGames = await db.games.getPublicGames(fetchLimit, 0);

		// Apply search filter if provided
		if (search) {
			const searchLower = search.toLowerCase();
			validGames = validGames.filter(
				(game) =>
					game.name.toLowerCase().includes(searchLower) ||
					game.description?.toLowerCase().includes(searchLower)
			);
		}

		// Apply difficulty filter if provided
		if (difficulty && difficulty !== 'all') {
			validGames = validGames.filter((game) => game.difficulty === difficulty);
		}

		// Apply minimum rating filter
		if (minRating > 0) {
			validGames = validGames.filter((game) => {
				const avgRating =
					(game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0;
				return avgRating >= minRating;
			});
		}

		// Apply tags filter
		if (tags.length > 0) {
			validGames = validGames.filter(
				(game) => game.tags && game.tags.some((tag) => tags.includes(tag))
			);
		}

		// Sort games
		switch (sortBy) {
			case 'popular':
				validGames.sort((a, b) => b.playCount - a.playCount);
				break;
			case 'rating':
				validGames.sort((a, b) => {
					const ratingA = (a.ratingCount || 0) > 0 ? (a.rating || 0) / (a.ratingCount || 1) : 0;
					const ratingB = (b.ratingCount || 0) > 0 ? (b.rating || 0) / (b.ratingCount || 1) : 0;
					return ratingB - ratingA;
				});
				break;
			case 'newest':
			default:
				validGames.sort(
					(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);
				break;
		}

		// Apply pagination
		const paginatedGames = validGames.slice(offset, offset + limit);

		// Get profile data for all creators
		const creatorIds = [...new Set(paginatedGames.map((game) => game.createdBy))];
		const profilePromises = creatorIds.map((id) => db.users.getUserById(id));
		const profiles = await Promise.all(profilePromises);
		const creatorProfiles = Object.fromEntries(
			creatorIds.map((id, index) => [id, profiles[index]])
		);

		// Add computed fields and creator profile data
		const enrichedGames = paginatedGames.map((game) => ({
			...game,
			createdBy: creatorProfiles[game.createdBy]?.username || creatorProfiles[game.createdBy]?.email || 'Anonymous',
			creatorProfilePicture: creatorProfiles[game.createdBy]?.avatar || null,
			creatorJoinedAt: creatorProfiles[game.createdBy]?.joinedAt || null,
			averageRating: (game.ratingCount || 0) > 0 ? (game.rating || 0) / (game.ratingCount || 1) : 0,
			imageCount: game.imageIds.length
		}));

		return json(
			{
				games: enrichedGames,
				total: validGames.length,
				limit,
				offset,
				hasMore: offset + limit < validGames.length
			},
			{
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	} catch (error) {
		console.error('Error getting public games:', error);
		return json(
			{ error: 'Internal server error' },
			{
				status: 500,
				headers: { 'Access-Control-Allow-Origin': '*' }
			}
		);
	}
};

export const OPTIONS = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
};
