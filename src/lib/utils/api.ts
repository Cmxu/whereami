import type {
	ImageMetadata,
	CustomGame,
	Location,
	GameRating,
	ShareableGame,
	UserProfile,
	GameSearchFilters,
	SocialShare,
	PaginatedResponse
} from '$lib/types';

export class WhereAmIAPI {
	private baseUrl = '/api';
	private authToken: string | null = null;

	/**
	 * Set the authentication token for API requests
	 */
	setAuthToken(token: string | null) {
		this.authToken = token;
	}

	/**
	 * Get headers with authentication if available
	 */
	private getHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...additionalHeaders
		};

		if (this.authToken) {
			headers['Authorization'] = `Bearer ${this.authToken}`;
		}

		return headers;
	}

	/**
	 * Check if user is authenticated
	 */
	get isAuthenticated(): boolean {
		return !!this.authToken;
	}

	/**
	 * Upload an image with location data (requires authentication)
	 */
	async uploadImage(file: File, location: Location, customName?: string): Promise<string> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to upload images');
		}

		const formData = new FormData();
		formData.append('image', file);
		formData.append('location', JSON.stringify(location));

		// Add custom name if provided
		if (customName && customName.trim()) {
			formData.append('customName', customName.trim());
		}

		const headers: Record<string, string> = {};
		if (this.authToken) {
			headers['Authorization'] = `Bearer ${this.authToken}`;
		}

		// Use the production upload endpoint
		const response = await fetch(`${this.baseUrl}/images/upload-simple`, {
			method: 'POST',
			headers,
			body: formData
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to upload images');
			}
			const error = await response.json().catch(() => ({ error: 'Upload failed' }));
			throw new Error(error.error || 'Upload failed');
		}

		const result = await response.json();
		return result.metadata?.id || result.imageId;
	}

	/**
	 * Get random images for a game
	 */
	async getRandomImages(count: number): Promise<ImageMetadata[]> {
		const response = await fetch(`${this.baseUrl}/images/random?count=${count}`);
		return this.handleResponse<ImageMetadata[]>(response, 'Failed to fetch random images');
	}

	/**
	 * Get image metadata by ID
	 */
	async getImageMetadata(imageId: string): Promise<ImageMetadata> {
		const response = await fetch(`${this.baseUrl}/images/${imageId}`);
		return this.handleResponse<ImageMetadata>(response, 'Image not found');
	}

	/**
	 * Update image location
	 */
	async updateImageLocation(imageId: string, location: Location): Promise<void> {
		const response = await fetch(`${this.baseUrl}/images/${imageId}/location`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(location)
		});

		if (!response.ok) {
			throw new Error('Failed to update image location');
		}
	}

	/**
	 * Create a custom game
	 */
	async createCustomGame(
		imageIds: string[],
		name: string,
		description?: string,
		isPublic: boolean = false,
		tags?: string[],
		difficulty?: 'easy' | 'medium' | 'hard'
	): Promise<string> {
		const response = await fetch(`${this.baseUrl}/games/create`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({
				imageIds,
				name,
				description,
				isPublic,
				tags,
				difficulty
			})
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to create games');
			}
			const error = await response.json().catch(() => ({ error: 'Game creation failed' }));
			throw new Error(error.error || 'Game creation failed');
		}

		const result = await response.json();
		return result.gameId;
	}

	/**
	 * Get custom game data
	 */
	async getCustomGame(gameId: string): Promise<CustomGame> {
		const response = await fetch(`${this.baseUrl}/games/${gameId}`);
		return this.handleResponse<CustomGame>(response, 'Game not found');
	}

	/**
	 * Get images for a custom game
	 */
	async getCustomGameImages(gameId: string): Promise<ImageMetadata[]> {
		const response = await fetch(`${this.baseUrl}/games/${gameId}/images`);
		return this.handleResponse<ImageMetadata[]>(response, 'Failed to fetch game images');
	}

	/**
	 * Get public games for browsing with filters
	 */
	async getPublicGames(
		limit: number = 20,
		offset: number = 0,
		filters?: GameSearchFilters
	): Promise<PaginatedResponse<CustomGame>> {
		const params = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString()
		});

		if (filters) {
			if (filters.difficulty) params.append('difficulty', filters.difficulty);
			if (filters.minRating) params.append('minRating', filters.minRating.toString());
			if (filters.tags) params.append('tags', filters.tags.join(','));
			if (filters.sortBy) params.append('sortBy', filters.sortBy);
			if (filters.searchQuery) params.append('search', filters.searchQuery);
		}

		const response = await fetch(`${this.baseUrl}/games/public?${params}`);
		return this.handleResponse<PaginatedResponse<CustomGame>>(
			response,
			'Failed to fetch public games'
		);
	}

	/**
	 * Increment play count for a game
	 */
	async incrementPlayCount(gameId: string): Promise<void> {
		await fetch(`${this.baseUrl}/games/${gameId}/play`, {
			method: 'POST'
		});
		// Don't throw on failure, this is optional analytics
	}

	/**
	 * Get user's uploaded images (requires authentication)
	 */
	async getUserImages(): Promise<ImageMetadata[]> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to view user images');
		}

		const response = await fetch(`${this.baseUrl}/images/user`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to view your images');
			}
			throw new Error('Failed to fetch user images');
		}

		const data = await response.json();
		return data.images || data; // Handle both old and new response formats
	}

	/**
	 * Delete an image (requires authentication)
	 */
	async deleteImage(imageId: string): Promise<void> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to delete images');
		}

		const response = await fetch(`${this.baseUrl}/images/${imageId}`, {
			method: 'DELETE',
			headers: this.getHeaders()
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to delete images');
			}
			throw new Error('Failed to delete image');
		}
	}

	/**
	 * Update image metadata (requires authentication)
	 */
	async updateImage(
		imageId: string,
		updates: {
			filename?: string;
			isPublic?: boolean;
			tags?: string[];
		}
	): Promise<ImageMetadata> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to update images');
		}

		const response = await fetch(`${this.baseUrl}/images/${imageId}`, {
			method: 'PUT',
			headers: this.getHeaders(),
			body: JSON.stringify(updates)
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to update images');
			}
			const error = await response.json().catch(() => ({ error: 'Failed to update image' }));
			throw new Error(error.error || 'Failed to update image');
		}

		const result = await response.json();
		return result.metadata;
	}

	/**
	 * Create a shareable link for a game
	 */
	async createShareLink(gameId: string, expiresIn?: number): Promise<ShareableGame> {
		const response = await fetch(`${this.baseUrl}/games/${gameId}/share`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ expiresIn })
		});

		if (!response.ok) {
			throw new Error('Failed to create share link');
		}

		return response.json();
	}

	/**
	 * Get game by share token
	 */
	async getGameByShareToken(shareToken: string): Promise<CustomGame> {
		const response = await fetch(`${this.baseUrl}/games/shared/${shareToken}`);

		if (!response.ok) {
			throw new Error('Game not found or share link expired');
		}

		return response.json();
	}

	/**
	 * Rate a game (requires authentication)
	 */
	async rateGame(gameId: string, rating: number): Promise<void> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to rate games');
		}

		const response = await fetch(`${this.baseUrl}/games/${gameId}/rate`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({ rating })
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to rate games');
			}
			throw new Error('Failed to rate game');
		}
	}

	/**
	 * Get user's rating for a game (requires authentication)
	 */
	async getUserRating(gameId: string): Promise<GameRating | null> {
		if (!this.isAuthenticated) {
			return null;
		}

		try {
			const response = await fetch(`${this.baseUrl}/games/${gameId}/rating/user`, {
				headers: this.getHeaders()
			});

			if (response.status === 404) {
				return null;
			}

			if (!response.ok) {
				throw new Error('Failed to fetch user rating');
			}

			return response.json();
		} catch {
			return null;
		}
	}



	/**
	 * Get user profile (requires authentication)
	 */
	async getUserProfile(userId?: string): Promise<UserProfile> {
		if (!userId && !this.isAuthenticated) {
			throw new Error('Authentication required to view profile');
		}

		const endpoint = userId ? `/users/${userId}` : '/users/me';
		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to view profile');
			}
			throw new Error('Failed to fetch user profile');
		}

		return response.json();
	}

	/**
	 * Update user profile (requires authentication)
	 */
	async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to update profile');
		}

		const response = await fetch(`${this.baseUrl}/users/me`, {
			method: 'PUT',
			headers: this.getHeaders(),
			body: JSON.stringify(updates)
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to update profile');
			}
			throw new Error('Failed to update profile');
		}

		return response.json();
	}

	/**
	 * Get user's created games (requires authentication)
	 */
	async getUserGames(userId?: string): Promise<CustomGame[]> {
		if (!this.isAuthenticated && !userId) {
			throw new Error('Authentication required to view user games');
		}

		const endpoint = userId ? `/api/games/user/${userId}` : `${this.baseUrl}/games/user`;
		const response = await fetch(endpoint, {
			headers: this.isAuthenticated ? this.getHeaders() : {}
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to view your games');
			}
			throw new Error('Failed to fetch user games');
		}

		const data = await response.json();
		return data.games || data; // Handle both old and new response formats
	}

	/**
	 * Delete a game (requires authentication)
	 */
	async deleteGame(gameId: string): Promise<void> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to delete games');
		}

		const response = await fetch(`${this.baseUrl}/games/${gameId}`, {
			method: 'DELETE',
			headers: this.getHeaders()
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to delete games');
			}
			if (response.status === 403) {
				throw new Error('You can only delete your own games');
			}
			if (response.status === 404) {
				throw new Error('Game not found');
			}
			const error = await response.json().catch(() => ({ error: 'Failed to delete game' }));
			throw new Error(error.error || 'Failed to delete game');
		}
	}

	/**
	 * Submit a score after completing a game
	 */
	async submitScore(gameId: string, score: number, maxPossible: number, rounds: number): Promise<{
		success: boolean;
		isNewBest: boolean;
	}> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to submit scores');
		}

		const response = await fetch(`${this.baseUrl}/games/${gameId}/scores`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({
				score,
				maxPossible,
				rounds
			})
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to submit scores');
			}
			const error = await response.json().catch(() => ({ error: 'Failed to submit score' }));
			throw new Error(error.error || 'Failed to submit score');
		}

		const result = await response.json();
		return {
			success: result.success,
			isNewBest: result.isNewBest
		};
	}

	/**
	 * Get leaderboard and average score for a game
	 */
	async getGameLeaderboard(gameId: string): Promise<{
		averageScore: number;
		averagePercentage: number;
		totalPlays: number;
		uniquePlayers: number;
		leaderboard: Array<{
			userId: string;
			username: string;
			score: number;
			percentage: number;
			playedAt: string;
			rank: number;
		}>;
	}> {
		const response = await fetch(`${this.baseUrl}/games/${gameId}/leaderboard`);
		return this.handleResponse(response, 'Failed to fetch leaderboard data');
	}

	/**
	 * Generate social share content
	 */
	generateSocialShareContent(share: SocialShare): { url: string; text: string } {
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
		const gameUrl = `${baseUrl}/games/${share.gameId}`;

		let text = `Check out this geography game on WhereAmI! 🌍`;
		if (share.score !== undefined) {
			text += ` I scored ${share.score.toLocaleString()} points!`;
		}

		switch (share.platform) {
			case 'twitter':
				return {
					url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(gameUrl)}`,
					text
				};
			case 'facebook':
				return {
					url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gameUrl)}`,
					text
				};
			case 'reddit':
				return {
					url: `https://reddit.com/submit?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(text)}`,
					text
				};
			case 'copy':
				return {
					url: gameUrl,
					text: `${text}\n\n${gameUrl}`
				};
			default:
				return { url: gameUrl, text };
		}
	}

	/**
	 * Handle common API response patterns
	 */
	private async handleResponse<T>(response: Response, errorPrefix: string): Promise<T> {
		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to continue');
			}
			try {
				const error = await response.json();
				throw new Error(error.error || `${errorPrefix} failed`);
			} catch {
				throw new Error(`${errorPrefix} failed`);
			}
		}
		return response.json();
	}
}

// Create a singleton instance
export const api = new WhereAmIAPI();
