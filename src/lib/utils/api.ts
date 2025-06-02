import type {
	ImageMetadata,
	CustomGame,
	Location,
	GameRating,
	GameComment,
	ShareableGame,
	UserProfile,
	GameSearchFilters,
	SocialShare
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
	async uploadImage(file: File, location: Location): Promise<string> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to upload images');
		}

		const formData = new FormData();
		formData.append('image', file);
		formData.append('location', JSON.stringify(location));

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

		if (!response.ok) {
			throw new Error('Failed to fetch random images');
		}

		return response.json();
	}

	/**
	 * Get image metadata by ID
	 */
	async getImageMetadata(imageId: string): Promise<ImageMetadata> {
		const response = await fetch(`${this.baseUrl}/images/${imageId}`);

		if (!response.ok) {
			throw new Error('Image not found');
		}

		return response.json();
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

		if (!response.ok) {
			throw new Error('Game not found');
		}

		return response.json();
	}

	/**
	 * Get images for a custom game
	 */
	async getCustomGameImages(gameId: string): Promise<ImageMetadata[]> {
		const response = await fetch(`${this.baseUrl}/games/${gameId}/images`);

		if (!response.ok) {
			throw new Error('Failed to fetch game images');
		}

		return response.json();
	}

	/**
	 * Get public games for browsing with filters
	 */
	async getPublicGames(
		limit: number = 20,
		offset: number = 0,
		filters?: GameSearchFilters
	): Promise<CustomGame[]> {
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

		if (!response.ok) {
			throw new Error('Failed to fetch public games');
		}

		return response.json();
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
	 * Add a comment to a game (requires authentication)
	 */
	async addComment(gameId: string, comment: string): Promise<GameComment> {
		if (!this.isAuthenticated) {
			throw new Error('Authentication required to comment');
		}

		const response = await fetch(`${this.baseUrl}/games/${gameId}/comments`, {
			method: 'POST',
			headers: this.getHeaders(),
			body: JSON.stringify({ comment })
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to comment');
			}
			throw new Error('Failed to add comment');
		}

		return response.json();
	}

	/**
	 * Get comments for a game
	 */
	async getGameComments(
		gameId: string,
		limit: number = 20,
		offset: number = 0
	): Promise<GameComment[]> {
		const response = await fetch(
			`${this.baseUrl}/games/${gameId}/comments?limit=${limit}&offset=${offset}`
		);

		if (!response.ok) {
			throw new Error('Failed to fetch comments');
		}

		return response.json();
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
		if (!userId && !this.isAuthenticated) {
			throw new Error('Authentication required to view user games');
		}

		const endpoint = userId ? `/games/users/${userId}` : '/games/user';
		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			headers: this.getHeaders()
		});

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Please sign in to view games');
			}
			throw new Error('Failed to fetch user games');
		}

		const data = await response.json();
		return data.games || data; // Handle both old and new response formats
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
}

// Create a singleton instance
export const api = new WhereAmIAPI();
