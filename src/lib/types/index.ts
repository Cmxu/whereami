export interface Location {
	lat: number;
	lng: number;
}

export interface Image {
	id: string;
	src: string;
	location: Location;
}

export interface Round {
	id: number;
	image: Image;
	userGuess?: Location;
	score: number;
	distance?: number;
	formattedDistance?: number;
	formattedDistanceUnit?: string;
}

export interface GameState {
	rounds: Round[];
	currentRound: number;
	totalScore: number;
	gameComplete: boolean;
}

// New types for the enhanced features
export interface ImageMetadata {
	id: string;
	filename: string;
	r2Key: string;
	location: Location;
	uploadedBy: string;
	uploadedAt: string;
	isPublic: boolean;
	tags?: string[];
	thumbnailUrl?: string;
}

export interface CustomGame {
	id: string;
	name: string;
	description?: string;
	imageIds: string[];
	createdBy: string;
	createdByUserId?: string; // Original user ID (populated by API)
	createdAt: string;
	isPublic: boolean;
	playCount: number;
	rating?: number;
	ratingCount?: number;
	tags?: string[];
	difficulty?: 'easy' | 'medium' | 'hard';
	shareUrl?: string;
	// Creator profile data (populated by API)
	creatorProfilePicture?: string | null;
	creatorJoinedAt?: string | null;
}

export interface GameRating {
	gameId: string;
	userId: string;
	rating: number; // 1-5 stars
	createdAt: string;
}

export interface GameComment {
	id: string;
	gameId: string;
	userId: string;
	username: string;
	comment: string;
	createdAt: string;
}

export interface ShareableGame {
	gameId: string;
	shareToken: string;
	shareUrl: string;
	createdAt: string;
	accessCount: number;
	expiresAt?: string;
}

export interface UserProfile {
	id: string;
	username: string;
	email?: string;
	avatar?: string;
	gamesCreated: number;
	gamesPlayed: number;
	totalScore: number;
	averageScore: number;
	joinedAt: string;
}

export interface GameSession {
	id: string;
	gameId?: string;
	imageIds: string[];
	rounds: Round[];
	createdAt: string;
	completedAt?: string;
}

export interface GameSettings {
	numRounds: number;
	gameMode: 'random' | 'custom';
	gameId?: string;
}

export interface UploadProgress {
	isUploading: boolean;
	progress: number;
	message: string;
}

export interface GuessResult {
	userGuess: Location;
	score: number;
	distance: number;
	formattedDistance: number;
	formattedDistanceUnit: string;
	isLastRound: boolean;
}

export interface GameSearchFilters {
	difficulty?: 'easy' | 'medium' | 'hard';
	minRating?: number;
	tags?: string[];
	sortBy?: 'newest' | 'oldest' | 'popular' | 'rating';
	searchQuery?: string;
}

export interface SocialShare {
	platform: 'twitter' | 'facebook' | 'reddit' | 'copy';
	gameId: string;
	score?: number;
}

// New types for game data storage in KV
export interface SavedGame {
	id: string;
	gameType: 'random' | 'custom';
	customGameId?: string; // If it's a custom game
	imageIds: string[];
	rounds: CompletedRound[];
	playerScore: number;
	maxPossibleScore: number;
	completedAt: string;
	playedBy?: string; // User ID if logged in
	shareToken?: string; // For sharing games
	isShared: boolean;
	gameSettings: {
		numRounds: number;
		gameMode: 'random' | 'custom';
	};
}

export interface CompletedRound {
	id: number;
	imageId: string;
	imageLocation: Location;
	userGuess: Location;
	score: number;
	distance: number;
	formattedDistance: number;
	formattedDistanceUnit: string;
	timeTaken?: number; // Time in seconds to make the guess
}

export interface GameShareData {
	gameId: string;
	shareToken: string;
	createdAt: string;
	accessCount: number;
	lastAccessedAt?: string;
	createdBy?: string; // User ID if logged in
	expiresAt?: string; // Optional expiration
}

export interface PaginatedResponse<T> {
	games: T[];
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}
