import type { Env, CustomGame, CreateGameRequest } from '../types';
import {
	corsHeaders,
	createResponse,
	createErrorResponse,
	generateId,
	getImageMetadata,
	saveGameMetadata,
	logAnalytics,
} from '../utils';
import { requireAuth, getUserData, saveUserData } from '../auth';

// Handle CORS preflight requests
export async function onRequestOptions(): Promise<Response> {
	return new Response(null, { 
		status: 200,
		headers: corsHeaders() 
	});
}

export async function onRequestPost(context: any): Promise<Response> {
	const { request, env } = context as { request: Request; env: Env };

	try {
		// Require authentication
		const { user, error } = await requireAuth(request, env);
		if (error) {
			return error;
		}

		// Parse request body
		const gameData: CreateGameRequest = await request.json() as CreateGameRequest;

		// Validate required fields
		if (!gameData.name || !gameData.imageIds || !Array.isArray(gameData.imageIds)) {
			return createErrorResponse('Name and imageIds are required', 400);
		}

		if (gameData.imageIds.length < 3) {
			return createErrorResponse('At least 3 images are required for a game', 400);
		}

		if (gameData.imageIds.length > 50) {
			return createErrorResponse('Maximum 50 images allowed per game', 400);
		}

		// Validate that all images exist and belong to the user
		const imagePromises = gameData.imageIds.map(id => getImageMetadata(id, env));
		const imageResults = await Promise.all(imagePromises);
		const validImages = imageResults.filter(img => img !== null);

		if (validImages.length !== gameData.imageIds.length) {
			return createErrorResponse('One or more images not found', 400);
		}

		// Check if all images belong to the user
		const unauthorizedImages = validImages.filter(img => img!.uploadedBy !== user.id);
		if (unauthorizedImages.length > 0) {
			return createErrorResponse('You can only create games with your own photos', 403);
		}

		// Generate game ID
		const gameId = generateId('game');

		// Create game metadata
		const game: CustomGame = {
			id: gameId,
			name: gameData.name.trim(),
			description: gameData.description?.trim(),
			imageIds: gameData.imageIds,
			createdBy: user.id,
			createdAt: new Date().toISOString(),
			isPublic: gameData.isPublic || false,
			playCount: 0,
			rating: 0,
			ratingCount: 0,
		};

		// Save game metadata
		const saved = await saveGameMetadata(game, env);
		if (!saved) {
			return createErrorResponse('Failed to save game metadata', 500);
		}

		// Update user's game count and add to user's games list
		const userData = await getUserData(user.id, env);
		if (userData) {
			userData.gamesCreated = (userData.gamesCreated || 0) + 1;
			userData.updatedAt = new Date().toISOString();
			await saveUserData(user.id, userData, env);
		}

		// Add to user's games list
		const userGamesKey = `user:${user.id}:games`;
		const userGames = await env.USER_DATA.get(userGamesKey);
		const gamesList = userGames ? JSON.parse(userGames) : [];
		gamesList.unshift(gameId); // Add to beginning of list
		
		// Keep only the last 1000 games per user
		if (gamesList.length > 1000) {
			gamesList.splice(1000);
		}
		
		await env.USER_DATA.put(userGamesKey, JSON.stringify(gamesList));

		// Log analytics
		logAnalytics(
			{
				type: 'game_create',
				gameId: gameId,
				userId: user.id,
				imageCount: gameData.imageIds.length,
				isPublic: game.isPublic,
				timestamp: new Date().toISOString(),
			},
			env
		);

		return createResponse(
			{ gameId: gameId, url: `/api/games/${gameId}` },
			201,
			'Game created successfully'
		);
	} catch (error) {
		console.error('Error creating game:', error);
		return createErrorResponse('Internal server error', 500);
	}
} 