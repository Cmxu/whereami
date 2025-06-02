<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/authStore';
	import GameRating from '$lib/components/GameRating.svelte';
	import ShareGame from '$lib/components/ShareGame.svelte';
	import type { CustomGame, GameSearchFilters } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';

	type GameFilter = 'public' | 'my-games';

	let gameFilter: GameFilter = 'public';
	let publicGames: CustomGame[] = [];
	let userGames: CustomGame[] = [];
	let loadingGames = false;
	let gamesError: string | null = null;
	let showShareModal = false;
	let gameToShare: CustomGame | null = null;

	// Enhanced search and filtering
	let searchQuery = '';
	let sortBy: 'newest' | 'oldest' | 'popular' | 'rating' = 'newest';
	let difficultyFilter: 'all' | 'easy' | 'medium' | 'hard' = 'all';
	let minRating = 0;
	let tagFilter = '';

	// Public games pagination
	let currentPage = 1;
	let itemsPerPage = 12;
	let totalGames = 0;

	// Handle URL parameters
	onMount(() => {
		const urlParams = new URLSearchParams($page.url.search);
		const filterParam = urlParams.get('filter');

		if (filterParam === 'my-games') {
			gameFilter = 'my-games';
		}

		loadGames();
	});

	async function loadGames() {
		if (gameFilter === 'my-games') {
			await loadUserGames();
		} else {
			await loadPublicGames();
		}
	}

	async function loadPublicGames() {
		try {
			loadingGames = true;
			gamesError = null;

			const filters: GameSearchFilters = {
				searchQuery: searchQuery.trim() || undefined,
				sortBy,
				difficulty: difficultyFilter !== 'all' ? difficultyFilter : undefined,
				minRating: minRating > 0 ? minRating : undefined,
				tags: tagFilter.trim() ? [tagFilter.trim()] : undefined
			};

			publicGames = await api.getPublicGames(
				itemsPerPage,
				(currentPage - 1) * itemsPerPage,
				filters
			);
		} catch (err) {
			gamesError = err instanceof Error ? err.message : 'Failed to load public games';
		} finally {
			loadingGames = false;
		}
	}

	async function loadUserGames() {
		if (!$isAuthenticated) {
			gamesError = 'Please sign in to view your games';
			return;
		}

		try {
			loadingGames = true;
			gamesError = null;
			userGames = await api.getUserGames();
		} catch (err) {
			gamesError = err instanceof Error ? err.message : 'Failed to load your games';
		} finally {
			loadingGames = false;
		}
	}

	function switchGameFilter(filter: GameFilter) {
		gameFilter = filter;
		currentPage = 1;
		loadGames();
		updateURL();
	}

	function updateURL() {
		const params = new URLSearchParams();
		if (gameFilter === 'my-games') {
			params.set('filter', 'my-games');
		}

		const newUrl = params.toString() ? `?${params.toString()}` : '/browse';
		window.history.replaceState({}, '', newUrl);
	}

	async function playPublicGame(game: CustomGame) {
		try {
			await initializeGame({
				numRounds: game.imageIds.length,
				gameMode: 'custom',
				gameId: game.id
			});
			goto('/');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to start game');
		}
	}

	async function playUserGame(game: CustomGame) {
		try {
			await initializeGame({
				numRounds: game.imageIds.length,
				gameMode: 'custom',
				gameId: game.id
			});
			goto('/');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to start game');
		}
	}

	function shareGame(game: CustomGame) {
		gameToShare = game;
		showShareModal = true;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}

	// Search and filter handlers
	function handleSearch() {
		currentPage = 1;
		if (gameFilter === 'public') {
			loadPublicGames();
		}
	}

	function handleFilterChange() {
		currentPage = 1;
		if (gameFilter === 'public') {
			loadPublicGames();
		}
	}

	function nextPage() {
		if (currentPage * itemsPerPage < totalGames) {
			currentPage++;
			loadPublicGames();
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
			loadPublicGames();
		}
	}

	function handleCreateGame() {
		goto('/create');
	}
</script>

<svelte:head>
	<title>Browse Games - WhereAmI</title>
	<meta
		name="description"
		content="Discover and play custom geography games created by the community."
	/>
</svelte:head>

<div class="browse-page min-h-screen" style="background-color: var(--bg-secondary);">
	<!-- Header -->
	<div class="page-header border-b" style="background-color: var(--bg-primary); border-color: var(--border-color);">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Browse Games</h1>
					<p style="color: var(--text-secondary);">Discover and play community-created geography games</p>
				</div>
				{#if $isAuthenticated}
					<a
						href="/create"
						class="btn-primary flex items-center gap-2"
					>
						<span>🎯</span>
						Create Game
					</a>
				{/if}
			</div>
		</div>
	</div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Filters -->
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="filters-section rounded-lg border p-6 mb-8" style="background-color: var(--bg-primary); border-color: var(--border-color);">
				<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
					<!-- Filter tabs -->
					<div class="flex rounded-lg p-1" style="background-color: var(--bg-tertiary);">
						<button
							class="filter-tab {gameFilter === 'public' ? 'active' : ''}"
							on:click={() => switchGameFilter('public')}
						>
							🌍 Public Games
						</button>
						<button
							class="filter-tab {gameFilter === 'my-games' ? 'active' : ''}"
							on:click={() => switchGameFilter('my-games')}
							disabled={!$isAuthenticated}
						>
							🎮 My Games
						</button>
					</div>

					<!-- Search and filters -->
					<div class="flex flex-col sm:flex-row gap-4 flex-1 lg:max-w-xl">
						<div class="flex-1">
							<input
								type="text"
								placeholder="Search games..."
								bind:value={searchQuery}
								on:input={handleSearch}
								class="input-field text-sm"
							/>
						</div>

						<select
							bind:value={difficultyFilter}
							on:change={handleFilterChange}
							class="input-field text-sm"
						>
							<option value="">All Difficulties</option>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</select>

						<select bind:value={sortBy} on:change={handleFilterChange} class="input-field text-sm">
							<option value="created_at">Newest</option>
							<option value="play_count">Most Played</option>
							<option value="average_rating">Highest Rated</option>
						</select>
					</div>
				</div>
			</div>
		</div>

		{#if gameFilter === 'public'}
			<!-- Public Games Section -->
			<!-- Search and Filter Controls -->
			{#if loadingGames}
				<div class="loading-state text-center py-12">
					<div class="loading-spinner mx-auto mb-4"></div>
					<p style="color: var(--text-secondary);">Loading games...</p>
				</div>
			{:else if gamesError}
				<div class="error-state text-center py-12">
					<div class="text-red-500 text-4xl mb-4">⚠️</div>
					<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Error Loading Games</h3>
					<p class="mb-4" style="color: var(--text-secondary);">{gamesError}</p>
					<button class="btn-primary" on:click={loadPublicGames}>Try Again</button>
				</div>
			{:else if publicGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎯</div>
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">No Games Found</h3>
					<p class="mb-6" style="color: var(--text-secondary);">
						{searchQuery
							? 'Try adjusting your search filters'
							: 'Be the first to create a public game!'}
					</p>
					<button class="btn-primary" on:click={handleCreateGame}> Create Your First Game </button>
				</div>
			{:else}
				<!-- Games Grid -->
				<div class="games-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
					{#each publicGames as game (game.id)}
						<a
							href="/games/{game.id}"
							class="game-card rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
							style="background-color: var(--bg-primary); border-color: var(--border-color);"
						>
							<div class="game-header p-4 border-b" style="border-color: var(--border-color);">
								<h3 class="font-semibold mb-1" style="color: var(--text-primary);">{game.name}</h3>
								{#if game.description}
									<p class="text-sm" style="color: var(--text-secondary);">{game.description}</p>
								{/if}
							</div>

							<div class="game-info p-4 space-y-3">
								<div class="game-stats flex justify-between text-sm">
									<span style="color: var(--text-secondary);">{game.imageIds.length} photos</span>
									<span style="color: var(--text-secondary);">By {game.createdBy}</span>
								</div>

								{#if game.difficulty}
									<div
										class="difficulty-badge inline-block px-2 py-1 rounded text-xs font-medium
										{game.difficulty === 'easy'
											? 'bg-green-100 text-green-800'
											: game.difficulty === 'medium'
												? 'bg-yellow-100 text-yellow-800'
												: 'bg-red-100 text-red-800'}"
									>
										{game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}
									</div>
								{/if}

								{#if game.tags && game.tags.length > 0}
									<div class="tags flex flex-wrap gap-1">
										{#each game.tags.slice(0, 3) as tag}
											<span class="tag bg-blue-100-theme text-blue-800-theme px-2 py-1 rounded text-xs">
												{tag}
											</span>
										{/each}
									</div>
								{/if}

								<div class="game-rating">
									<GameRating {game} readonly={true} size="sm" />
								</div>

								<div class="game-actions flex gap-2 pt-2">
									<button class="btn-primary flex-1" on:click={() => playPublicGame(game)}>
										🎮 Play
									</button>
									<button class="btn-secondary" on:click={() => shareGame(game)}> 📤 </button>
								</div>
							</div>
						</a>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalGames > itemsPerPage}
					<div class="pagination flex justify-center items-center gap-4">
						<button class="btn-secondary" disabled={currentPage === 1} on:click={prevPage}>
							← Previous
						</button>
						<span class="text-sm" style="color: var(--text-secondary);">
							Page {currentPage} of {Math.ceil(totalGames / itemsPerPage)}
						</span>
						<button
							class="btn-secondary"
							disabled={currentPage * itemsPerPage >= totalGames}
							on:click={nextPage}
						>
							Next →
						</button>
					</div>
				{/if}
			{/if}
		{:else if gameFilter === 'my-games'}
			<!-- My Games Section -->
			{#if !$isAuthenticated}
				<div class="auth-notice text-center py-12">
					<div class="text-blue-500 text-6xl mb-6">🔐</div>
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">Sign In Required</h3>
					<p class="mb-6" style="color: var(--text-secondary);">Sign in to view and manage your custom games</p>
					<button class="btn-primary" on:click={() => goto('/gallery')}> Sign In </button>
				</div>
			{:else if loadingGames}
				<div class="loading-state text-center py-12">
					<div class="loading-spinner mx-auto mb-4"></div>
					<p style="color: var(--text-secondary);">Loading your games...</p>
				</div>
			{:else if gamesError}
				<div class="error-state text-center py-12">
					<div class="text-red-500 text-4xl mb-4">⚠️</div>
					<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Error Loading Your Games</h3>
					<p class="mb-4" style="color: var(--text-secondary);">{gamesError}</p>
					<button class="btn-primary" on:click={loadUserGames}>Try Again</button>
				</div>
			{:else if userGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎮</div>
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">No Games Yet</h3>
					<p class="mb-6" style="color: var(--text-secondary);">
						You haven't created any custom games. Start by uploading some photos!
					</p>
					<div class="space-y-3">
						<button class="btn-primary" on:click={() => goto('/gallery')}>
							📸 View Your Photos
						</button>
						<button class="btn-secondary" on:click={handleCreateGame}> 🎯 Create Game </button>
					</div>
				</div>
			{:else}
				<!-- User Games Grid -->
				<div class="games-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each userGames as game (game.id)}
						<a
							href="/games/{game.id}"
							class="game-card rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
							style="background-color: var(--bg-primary); border-color: var(--border-color);"
						>
							<div class="game-header p-4 border-b" style="border-color: var(--border-color);">
								<h3 class="font-semibold mb-1" style="color: var(--text-primary);">{game.name}</h3>
								{#if game.description}
									<p class="text-sm" style="color: var(--text-secondary);">{game.description}</p>
								{/if}
							</div>

							<div class="game-info p-4 space-y-3">
								<div class="game-stats flex justify-between text-sm">
									<span style="color: var(--text-secondary);">{game.imageIds.length} photos</span>
									<span style="color: var(--text-secondary);">Created {formatDate(game.createdAt)}</span>
								</div>

								<div
									class="visibility-badge inline-block px-2 py-1 rounded text-xs font-medium
									{game.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100-theme text-gray-800-theme'}"
								>
									{game.isPublic ? '🌍 Public' : '🔒 Private'}
								</div>

								{#if game.difficulty}
									<div
										class="difficulty-badge inline-block px-2 py-1 rounded text-xs font-medium
										{game.difficulty === 'easy'
											? 'bg-green-100 text-green-800'
											: game.difficulty === 'medium'
												? 'bg-yellow-100 text-yellow-800'
												: 'bg-red-100 text-red-800'}"
									>
										{game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}
									</div>
								{/if}

								<div class="game-actions flex gap-2 pt-2">
									<button class="btn-primary flex-1" on:click={() => playUserGame(game)}>
										🎮 Play
									</button>
									<button class="btn-secondary" on:click={() => shareGame(game)}> 📤 </button>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- Share Modal -->
{#if showShareModal && gameToShare}
	<ShareGame game={gameToShare} on:close={() => (showShareModal = false)} />
{/if}

<style>
	.filter-tab {
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		font-weight: 500;
		transition: all 0.2s;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.filter-tab:hover:not(:disabled) {
		color: var(--text-primary);
		background-color: var(--bg-secondary);
	}

	.filter-tab.active {
		color: var(--btn-primary-bg);
		background-color: var(--bg-primary);
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.filter-tab:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.game-card:hover {
		transform: translateY(-2px);
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--border-color);
		border-top: 3px solid var(--btn-primary-bg);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	@media (max-width: 768px) {
		.games-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
