import { writable, derived, get } from 'svelte/store';
import type {
	GameState,
	GameSettings,
	Round,
	Location,
	Image,
	GuessResult,
	GameSession
} from '$lib/types';
import { processGuess, calculateTotalScore, generateSessionId } from '$lib/utils/gameLogic';
import { api } from '$lib/utils/api';
import {
	saveCurrentGame,
	loadCurrentGame,
	clearCurrentGame,
	addGameToHistory,
	hasSavedGame
} from '$lib/utils/localStorage';

// Default game settings
const DEFAULT_GAME_SETTINGS: GameSettings = {
	numRounds: 3,
	gameMode: 'random'
};

// Game state store
export const gameState = writable<GameState>({
	rounds: [],
	currentRound: 0,
	totalScore: 0,
	gameComplete: false
});

// Game settings store
export const gameSettings = writable<GameSettings>(DEFAULT_GAME_SETTINGS);

// Loading and error states
export const isLoading = writable<boolean>(false);
export const error = writable<string | null>(null);

// Current session ID
export const sessionId = writable<string>(generateSessionId());

// Auto-save state
export const autoSaveEnabled = writable<boolean>(true);

// Derived stores
export const currentRound = derived(
	gameState,
	($gameState) => $gameState.rounds[$gameState.currentRound] || null
);

export const isGameActive = derived(
	gameState,
	($gameState) => $gameState.rounds.length > 0 && !$gameState.gameComplete
);

export const progress = derived(gameState, ($gameState) => {
	if ($gameState.rounds.length === 0) return 0;
	return (($gameState.currentRound + 1) / $gameState.rounds.length) * 100;
});

export const maxPossibleScore = derived(
	gameState,
	($gameState) => $gameState.rounds.length * 10000
);

export const hasSavedGameInProgress = writable<boolean>(hasSavedGame());

// Auto-save functionality
let autoSaveTimeout: ReturnType<typeof setTimeout>;

function scheduleAutoSave() {
	if (autoSaveTimeout) {
		clearTimeout(autoSaveTimeout);
	}

	autoSaveTimeout = setTimeout(() => {
		const currentGameState = get(gameState);
		const currentGameSettings = get(gameSettings);
		const currentSessionId = get(sessionId);
		const autoSave = get(autoSaveEnabled);

		if (autoSave && currentGameState.rounds.length > 0 && !currentGameState.gameComplete) {
			saveCurrentGame(currentGameState, currentGameSettings, currentSessionId);
		}
	}, 1000); // Save after 1 second of inactivity
}

// Subscribe to game state changes for auto-save
gameState.subscribe(() => {
	scheduleAutoSave();
});

/**
 * Initialize a new game
 */
export async function initializeGame(settings: Partial<GameSettings> = {}) {
	try {
		isLoading.set(true);
		error.set(null);

		const finalSettings = { ...DEFAULT_GAME_SETTINGS, ...settings };
		gameSettings.set(finalSettings);

		let images: Image[] = [];

		if (finalSettings.gameMode === 'custom' && finalSettings.gameId) {
			// Load custom game images
			const gameImages = await api.getCustomGameImages(finalSettings.gameId);
			images = gameImages.map((img) => ({
				id: img.id,
				src: img.thumbnailUrl || `/api/images/${img.id}`,
				location: img.location
			}));

			// Increment play count
			await api.incrementPlayCount(finalSettings.gameId);
		} else {
			// Load random images
			const randomImages = await api.getRandomImages(finalSettings.numRounds);
			images = randomImages.map((img) => ({
				id: img.id,
				src: img.thumbnailUrl || `/api/images/${img.id}`,
				location: img.location
			}));
		}

		// Create rounds
		const rounds: Round[] = images.map((image, index) => ({
			id: index + 1,
			image,
			score: 0,
			distance: undefined,
			userGuess: undefined
		}));

		// Update game state
		gameState.set({
			rounds,
			currentRound: 0,
			totalScore: 0,
			gameComplete: false
		});

		// Generate new session ID
		sessionId.set(generateSessionId());

		// Clear any existing saved game
		clearCurrentGame();
		hasSavedGameInProgress.set(false);
	} catch (err) {
		console.error('Error initializing game:', err);
		error.set(err instanceof Error ? err.message : 'Failed to initialize game');
	} finally {
		isLoading.set(false);
	}
}

/**
 * Resume a saved game
 */
export function resumeSavedGame(): boolean {
	try {
		const saved = loadCurrentGame();

		if (!saved) {
			return false;
		}

		gameState.set(saved.gameState);
		gameSettings.set(saved.gameSettings);
		sessionId.set(saved.sessionId);

		hasSavedGameInProgress.set(false);
		error.set(null);

		return true;
	} catch (err) {
		console.error('Error resuming saved game:', err);
		error.set('Failed to resume saved game');
		return false;
	}
}

/**
 * Submit a guess for the current round
 */
export function submitGuess(location: Location): GuessResult | null {
	const currentGameState = get(gameState);

	if (
		currentGameState.gameComplete ||
		currentGameState.currentRound >= currentGameState.rounds.length
	) {
		return null;
	}

	const currentRoundData = currentGameState.rounds[currentGameState.currentRound];
	const isLastRound = currentGameState.currentRound === currentGameState.rounds.length - 1;

	// Process the guess
	const result = processGuess(location, currentRoundData.image.location, isLastRound);

	// Update the current round with the guess
	const updatedRounds = currentGameState.rounds.map((round, index) => {
		if (index === currentGameState.currentRound) {
			return {
				...round,
				userGuess: result.userGuess,
				score: result.score,
				distance: result.distance,
				formattedDistance: result.formattedDistance,
				formattedDistanceUnit: result.formattedDistanceUnit
			};
		}
		return round;
	});

	// Calculate new total score
	const totalScore = calculateTotalScore(updatedRounds);

	// Update game state
	gameState.set({
		...currentGameState,
		rounds: updatedRounds,
		totalScore
	});

	return result;
}

/**
 * Proceed to the next round
 */
export function proceedToNextRound() {
	gameState.update((state) => {
		const nextRound = state.currentRound + 1;
		const isGameComplete = nextRound >= state.rounds.length;

		const updatedState = {
			...state,
			currentRound: nextRound,
			gameComplete: isGameComplete
		};

		// If game is complete, save to history and clear current save
		if (isGameComplete) {
			const currentGameSettings = get(gameSettings);
			const currentSessionId = get(sessionId);

			const gameSession: GameSession = {
				id: currentSessionId,
				gameId: currentGameSettings.gameId,
				imageIds: state.rounds.map((round) => round.image.id),
				rounds: state.rounds,
				createdAt: new Date().toISOString(),
				completedAt: new Date().toISOString()
			};

			addGameToHistory(gameSession);
			clearCurrentGame();
			hasSavedGameInProgress.set(false);

			// Submit score to leaderboard if it's a custom game and user is authenticated
			if (currentGameSettings.gameMode === 'custom' && currentGameSettings.gameId && api.isAuthenticated) {
				const maxPossible = state.rounds.length * 10000;
				api.submitScore(
					currentGameSettings.gameId,
					state.totalScore,
					maxPossible,
					state.rounds.length
				).catch((error) => {
					console.warn('Failed to submit score to leaderboard:', error);
					// Don't block the game completion flow if score submission fails
				});
			}
		}

		return updatedState;
	});
}

/**
 * Reset the game
 */
export function resetGame(newSettings?: Partial<GameSettings>) {
	gameState.set({
		rounds: [],
		currentRound: 0,
		totalScore: 0,
		gameComplete: false
	});

	error.set(null);
	clearCurrentGame();
	hasSavedGameInProgress.set(hasSavedGame());

	if (newSettings) {
		initializeGame(newSettings);
	}
}

/**
 * Get game summary for sharing
 */
export function getGameSummary() {
	const state = get(gameState);
	const settings = get(gameSettings);

	return {
		sessionId: get(sessionId),
		gameMode: settings.gameMode,
		gameId: settings.gameId,
		totalScore: state.totalScore,
		maxPossible: state.rounds.length * 10000,
		rounds: state.rounds.map((round) => ({
			id: round.id,
			score: round.score,
			distance: round.distance,
			formattedDistance: round.formattedDistance,
			formattedDistanceUnit: round.formattedDistanceUnit
		})),
		completedAt: new Date().toISOString()
	};
}

/**
 * Manually save current game
 */
export function saveGame(): boolean {
	const currentGameState = get(gameState);
	const currentGameSettings = get(gameSettings);
	const currentSessionId = get(sessionId);

	if (currentGameState.rounds.length === 0 || currentGameState.gameComplete) {
		return false;
	}

	return saveCurrentGame(currentGameState, currentGameSettings, currentSessionId);
}

/**
 * Enable/disable auto-save
 */
export function setAutoSave(enabled: boolean) {
	autoSaveEnabled.set(enabled);

	if (!enabled && autoSaveTimeout) {
		clearTimeout(autoSaveTimeout);
	}
}

/**
 * Check for and load any saved game on app start
 */
export function checkForSavedGame() {
	hasSavedGameInProgress.set(hasSavedGame());
}
