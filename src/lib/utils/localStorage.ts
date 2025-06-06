import type { GameState, GameSettings, GameSession } from '$lib/types';

// Storage keys
const STORAGE_KEYS = {
	CURRENT_GAME: 'whereami_current_game',
	GAME_HISTORY: 'whereami_game_history',
	SETTINGS: 'whereami_settings',
	USER_PREFERENCES: 'whereami_preferences'
} as const;

// Maximum number of games to keep in history
const MAX_HISTORY_ITEMS = 50;

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
	try {
		const test = '__localStorage_test__';
		localStorage.setItem(test, test);
		localStorage.removeItem(test);
		return true;
	} catch {
		return false;
	}
}

/**
 * Safely get item from localStorage
 */
function safeGetItem(key: string): string | null {
	if (!isLocalStorageAvailable()) return null;

	try {
		return localStorage.getItem(key);
	} catch (error) {
		console.warn(`Failed to get item from localStorage: ${key}`, error);
		return null;
	}
}

/**
 * Safely set item in localStorage
 */
function safeSetItem(key: string, value: string): boolean {
	if (!isLocalStorageAvailable()) return false;

	try {
		localStorage.setItem(key, value);
		return true;
	} catch (error) {
		console.warn(`Failed to set item in localStorage: ${key}`, error);
		return false;
	}
}

/**
 * Safely remove item from localStorage
 */
function safeRemoveItem(key: string): boolean {
	if (!isLocalStorageAvailable()) return false;

	try {
		localStorage.removeItem(key);
		return true;
	} catch (error) {
		console.warn(`Failed to remove item from localStorage: ${key}`, error);
		return false;
	}
}

/**
 * Save current game state
 */
export function saveCurrentGame(
	gameState: GameState,
	gameSettings: GameSettings,
	sessionId: string
): boolean {
	const gameData = {
		gameState,
		gameSettings,
		sessionId,
		savedAt: new Date().toISOString()
	};

	return safeSetItem(STORAGE_KEYS.CURRENT_GAME, JSON.stringify(gameData));
}

/**
 * Load current game state
 */
export function loadCurrentGame(): {
	gameState: GameState;
	gameSettings: GameSettings;
	sessionId: string;
} | null {
	const saved = safeGetItem(STORAGE_KEYS.CURRENT_GAME);

	if (!saved) return null;

	try {
		const parsed = JSON.parse(saved);

		// Validate the structure
		if (parsed && parsed.gameState && parsed.gameSettings && parsed.sessionId) {
			return {
				gameState: parsed.gameState,
				gameSettings: parsed.gameSettings,
				sessionId: parsed.sessionId
			};
		}

		return null;
	} catch (error) {
		console.warn('Failed to parse saved game data:', error);
		return null;
	}
}

/**
 * Clear current game state
 */
export function clearCurrentGame(): boolean {
	return safeRemoveItem(STORAGE_KEYS.CURRENT_GAME);
}

/**
 * Add completed game to history
 */
export function addGameToHistory(gameSession: GameSession): boolean {
	const history = getGameHistory();

	// Add new game to the beginning
	history.unshift(gameSession);

	// Keep only the most recent games
	const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);

	return safeSetItem(STORAGE_KEYS.GAME_HISTORY, JSON.stringify(trimmedHistory));
}

/**
 * Get game history
 */
export function getGameHistory(): GameSession[] {
	const saved = safeGetItem(STORAGE_KEYS.GAME_HISTORY);

	if (!saved) return [];

	try {
		const parsed = JSON.parse(saved);
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		console.warn('Failed to parse game history:', error);
		return [];
	}
}

/**
 * Clear game history
 */
export function clearGameHistory(): boolean {
	return safeRemoveItem(STORAGE_KEYS.GAME_HISTORY);
}

/**
 * Get game statistics
 */
export function getGameStatistics() {
	const history = getGameHistory();

	if (history.length === 0) {
		return {
			totalGames: 0,
			averageScore: 0,
			bestScore: 0,
			totalScore: 0,
			averageAccuracy: 0
		};
	}

	const completed = history.filter((game) => game.completedAt);
	const totalScore = completed.reduce((sum, game) => {
		return sum + game.rounds.reduce((roundSum, round) => roundSum + round.score, 0);
	}, 0);

	const bestScore = Math.max(
		...completed.map((game) => game.rounds.reduce((sum, round) => sum + round.score, 0))
	);

	const averageScore = completed.length > 0 ? totalScore / completed.length : 0;

	// Calculate average accuracy (percentage of max possible score)
	const maxPossiblePerGame = 10000; // Assuming max score per round is 10000
	const totalPossible = completed.reduce(
		(sum, game) => sum + game.rounds.length * maxPossiblePerGame,
		0
	);
	const averageAccuracy = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

	return {
		totalGames: completed.length,
		averageScore: Math.round(averageScore),
		bestScore,
		totalScore,
		averageAccuracy: Math.round(averageAccuracy * 100) / 100
	};
}

/**
 * User preferences interface
 */
export interface UserPreferences {
	soundEnabled: boolean;
	animationsEnabled: boolean;
	theme: 'light' | 'dark' | 'auto';
	defaultGameMode: 'random' | 'custom';
	defaultRounds: number;
	showTutorial: boolean;
	showUploadTutorial: boolean;
}

/**
 * Default user preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
	soundEnabled: true,
	animationsEnabled: true,
	theme: 'auto',
	defaultGameMode: 'random',
	defaultRounds: 3,
	showTutorial: true,
	showUploadTutorial: true
};

/**
 * Save user preferences
 */
export function saveUserPreferences(preferences: Partial<UserPreferences>): boolean {
	const current = getUserPreferences();
	const updated = { ...current, ...preferences };

	return safeSetItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updated));
}

/**
 * Get user preferences
 */
export function getUserPreferences(): UserPreferences {
	const saved = safeGetItem(STORAGE_KEYS.USER_PREFERENCES);

	if (!saved) return DEFAULT_PREFERENCES;

	try {
		const parsed = JSON.parse(saved);
		return { ...DEFAULT_PREFERENCES, ...parsed };
	} catch (error) {
		console.warn('Failed to parse user preferences:', error);
		return DEFAULT_PREFERENCES;
	}
}

/**
 * Check if there's a saved game in progress
 */
export function hasSavedGame(): boolean {
	const saved = loadCurrentGame();
	return saved !== null && !saved.gameState.gameComplete;
}
