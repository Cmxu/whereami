import type { R2Bucket, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
	IMAGES_BUCKET: R2Bucket;
	GAME_METADATA: KVNamespace;
	USER_DATA: KVNamespace;
	ENVIRONMENT: string;
	CORS_ORIGIN: string;
	MAX_FILE_SIZE: string;
	ALLOWED_FILE_TYPES: string;
	// Supabase environment variables
	PUBLIC_SUPABASE_URL: string;
	PUBLIC_SUPABASE_ANON_KEY: string;
}

export interface Location {
	lat: number;
	lng: number;
}

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
	fileSize?: number;
	mimeType?: string;
}

export interface CustomGame {
	id: string;
	name: string;
	description?: string;
	imageIds: string[];
	createdBy: string;
	createdAt: string;
	isPublic: boolean;
	playCount: number;
	rating?: number;
	ratingCount?: number;
}

export interface GameSession {
	id: string;
	gameId?: string;
	imageIds: string[];
	rounds: any[];
	createdAt: string;
	completedAt?: string;
}

export interface UserProfile {
	id: string;
	uploadedImages: string[];
	createdGames: string[];
	playedGames: string[];
	totalScore: number;
	gamesPlayed: number;
	averageScore: number;
	bestScore: number;
	createdAt: string;
	lastActive: string;
}

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface UploadImageRequest {
	location: Location;
	isPublic?: boolean;
	tags?: string[];
}

export interface CreateGameRequest {
	name: string;
	description?: string;
	imageIds: string[];
	isPublic?: boolean;
}

export interface GetPublicGamesQuery {
	limit?: string;
	offset?: string;
	search?: string;
	sortBy?: 'newest' | 'popular' | 'rating';
}

export interface AnalyticsEvent {
	type: 'game_start' | 'game_complete' | 'image_upload' | 'game_create' | 'image_view';
	gameId?: string;
	imageId?: string;
	userId?: string;
	score?: number;
	duration?: number;
	timestamp: string;
}
