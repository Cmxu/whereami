// Generate a random ID for the game
function generateGameId() {
	return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a random share token
function generateShareToken() {
	return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function onRequestPost(context) {
	try {
		const { request, env } = context;

		if (!env.GAME_DATA) {
			return new Response(JSON.stringify({ error: 'Game data storage not configured' }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		const gameData = await request.json();
		
		// Validate required fields
		if (!gameData.rounds || !Array.isArray(gameData.rounds) || gameData.rounds.length === 0) {
			return new Response(JSON.stringify({ error: 'Invalid game data: rounds are required' }), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}

		// Generate unique IDs
		const gameId = generateGameId();
		const shareToken = generateShareToken();

		// Create the saved game object
		const savedGame = {
			id: gameId,
			gameType: gameData.gameType || 'random',
			customGameId: gameData.customGameId,
			imageIds: gameData.imageIds || gameData.rounds.map(r => r.imageId),
			rounds: gameData.rounds.map((round, index) => ({
				id: index + 1,
				imageId: round.imageId || round.image?.id,
				imageLocation: round.imageLocation || round.image?.location,
				userGuess: round.userGuess,
				score: round.score,
				distance: round.distance,
				formattedDistance: round.formattedDistance,
				timeTaken: round.timeTaken
			})),
			playerScore: gameData.totalScore || gameData.playerScore,
			maxPossibleScore: gameData.maxPossibleScore || (gameData.rounds.length * 5000),
			completedAt: new Date().toISOString(),
			playedBy: gameData.playedBy,
			shareToken: shareToken,
			isShared: gameData.isShared || false,
			gameSettings: {
				numRounds: gameData.rounds.length,
				gameMode: gameData.gameType || 'random'
			}
		};

		// Save the game to KV
		await env.GAME_DATA.put(gameId, JSON.stringify(savedGame));

		// Create share data
		const shareData = {
			gameId: gameId,
			shareToken: shareToken,
			createdAt: new Date().toISOString(),
			accessCount: 0,
			createdBy: gameData.playedBy
		};

		// Save share data separately for easy lookup
		await env.GAME_DATA.put(`share_${shareToken}`, JSON.stringify(shareData));

		// If user is logged in, add to their game history
		if (gameData.playedBy) {
			try {
				const userGamesKey = `user_games_${gameData.playedBy}`;
				const existingGamesStr = await env.GAME_DATA.get(userGamesKey);
				const existingGames = existingGamesStr ? JSON.parse(existingGamesStr) : [];
				
				existingGames.unshift(gameId); // Add to beginning of array
				
				// Keep only the last 100 games per user
				if (existingGames.length > 100) {
					existingGames.splice(100);
				}
				
				await env.GAME_DATA.put(userGamesKey, JSON.stringify(existingGames));
			} catch (error) {
				console.error('Error saving to user game history:', error);
				// Don't fail the whole request if this fails
			}
		}

		// Update public games index if it's a public game
		if (savedGame.isShared) {
			try {
				const publicGamesKey = 'public_games_index';
				const existingPublicGamesStr = await env.GAME_DATA.get(publicGamesKey);
				const existingPublicGames = existingPublicGamesStr ? JSON.parse(existingPublicGamesStr) : [];
				
				existingPublicGames.unshift({
					gameId: gameId,
					playerScore: savedGame.playerScore,
					maxPossibleScore: savedGame.maxPossibleScore,
					completedAt: savedGame.completedAt,
					gameType: savedGame.gameType,
					numRounds: savedGame.gameSettings.numRounds
				});
				
				// Keep only the last 1000 public games
				if (existingPublicGames.length > 1000) {
					existingPublicGames.splice(1000);
				}
				
				await env.GAME_DATA.put(publicGamesKey, JSON.stringify(existingPublicGames));
			} catch (error) {
				console.error('Error updating public games index:', error);
				// Don't fail the whole request if this fails
			}
		}

		const url = new URL(request.url);
		return new Response(JSON.stringify({
			success: true,
			gameId: gameId,
			shareToken: shareToken,
			shareUrl: `${url.origin}/shared/${shareToken}`
		}), {
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});

	} catch (error) {
		console.error('Error saving game:', error);
		return new Response(JSON.stringify({ error: 'Failed to save game' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*'
			}
		});
	}
}

export async function onRequestOptions() {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization'
		}
	});
} 