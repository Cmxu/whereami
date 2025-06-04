import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SavedGame, GameShareData } from '$lib/types';

export const GET = async ({ params, url, platform }: RequestEvent) => {
	try {
		if (!platform?.env?.GAME_DATA) {
			return json(
				{ error: 'Game data storage not configured' },
				{ 
					status: 500,
					headers: { 'Access-Control-Allow-Origin': '*' }
				}
			);
		}

		const { gameId } = params;
		const isShareToken = url.searchParams.get('shareToken');
		
		let savedGame: SavedGame | null = null;
		let shareData: GameShareData | null = null;

		if (isShareToken === 'true') {
			// Lookup by share token
			const shareDataStr = await platform.env.GAME_DATA.get(`share_${gameId}`);
			if (!shareDataStr) {
				return json(
					{ error: 'Game not found' },
					{ 
						status: 404,
						headers: { 'Access-Control-Allow-Origin': '*' }
					}
				);
			}

			shareData = JSON.parse(shareDataStr);
			
			// Increment access count
			if (shareData) {
				shareData.accessCount++;
				shareData.lastAccessedAt = new Date().toISOString();
				await platform.env.GAME_DATA.put(`share_${gameId}`, JSON.stringify(shareData));

				// Get the actual game data
				const gameDataStr = await platform.env.GAME_DATA.get(shareData.gameId);
				if (!gameDataStr) {
					return json(
						{ error: 'Game data not found' },
						{ 
							status: 404,
							headers: { 'Access-Control-Allow-Origin': '*' }
						}
					);
				}

				savedGame = JSON.parse(gameDataStr);
			}
		} else {
			// Lookup by game ID directly
			const gameDataStr = await platform.env.GAME_DATA.get(gameId);
			if (!gameDataStr) {
				return json(
					{ error: 'Game not found' },
					{ 
						status: 404,
						headers: { 'Access-Control-Allow-Origin': '*' }
					}
				);
			}

			savedGame = JSON.parse(gameDataStr);
		}

		return json({
			game: savedGame,
			shareData: shareData
		}, {
			headers: { 'Access-Control-Allow-Origin': '*' }
		});

	} catch (error) {
		console.error('Error retrieving game:', error);
		return json(
			{ error: 'Failed to retrieve game' },
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