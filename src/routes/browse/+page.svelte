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

<div class="browse-page min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="page-header bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 class="text-2xl font-bold text-gray-900">Browse Games</h1>
					<p class="text-gray-600">Discover geography games created by the community</p>
				</div>

				<!-- Filter tabs -->
				<div class="flex bg-gray-100 rounded-lg p-1">
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
			</div>
		</div>
	</div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if gameFilter === 'public'}
			<!-- Public Games Section -->
			<!-- Search and Filter Controls -->
			<div class="filters-section bg-white rounded-lg border border-gray-200 p-6 mb-8">
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					<!-- Search -->
					<div class="filter-group">
						<label for="search-games" class="filter-label">Search Games</label>
						<input
							id="search-games"
							type="text"
							placeholder="Search by name or description..."
							class="input-field"
							bind:value={searchQuery}
							on:input={handleSearch}
						/>
					</div>

					<!-- Sort -->
					<div class="filter-group">
						<label for="sort-by" class="filter-label">Sort By</label>
						<select
							id="sort-by"
							class="input-field"
							bind:value={sortBy}
							on:change={handleFilterChange}
						>
							<option value="newest">Newest First</option>
							<option value="oldest">Oldest First</option>
							<option value="popular">Most Popular</option>
							<option value="rating">Highest Rated</option>
						</select>
					</div>

					<!-- Difficulty -->
					<div class="filter-group">
						<label for="difficulty-filter" class="filter-label">Difficulty</label>
						<select
							id="difficulty-filter"
							class="input-field"
							bind:value={difficultyFilter}
							on:change={handleFilterChange}
						>
							<option value="all">All Levels</option>
							<option value="easy">Easy</option>
							<option value="medium">Medium</option>
							<option value="hard">Hard</option>
						</select>
					</div>

					<!-- Tags -->
					<div class="filter-group">
						<label for="tag-filter" class="filter-label">Tags</label>
						<input
							id="tag-filter"
							type="text"
							placeholder="Filter by tag..."
							class="input-field"
							bind:value={tagFilter}
							on:input={handleFilterChange}
						/>
					</div>
				</div>
			</div>

			<!-- Public Games Grid -->
			{#if loadingGames}
				<div class="loading-state text-center py-12">
					<div class="loading-spinner mx-auto mb-4"></div>
					<p class="text-gray-600">Loading games...</p>
				</div>
			{:else if gamesError}
				<div class="error-state text-center py-12">
					<div class="text-red-500 text-4xl mb-4">⚠️</div>
					<h3 class="text-lg font-semibold text-gray-800 mb-2">Error Loading Games</h3>
					<p class="text-gray-600 mb-4">{gamesError}</p>
					<button class="btn-primary" on:click={loadPublicGames}>Try Again</button>
				</div>
			{:else if publicGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎯</div>
					<h3 class="text-xl font-semibold text-gray-800 mb-3">No Games Found</h3>
					<p class="text-gray-600 mb-6">
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
						<div
							class="game-card bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
						>
							<div class="game-header p-4 border-b border-gray-100">
								<h3 class="font-semibold text-gray-900 mb-1">{game.name}</h3>
								{#if game.description}
									<p class="text-sm text-gray-600">{game.description}</p>
								{/if}
							</div>

							<div class="game-info p-4 space-y-3">
								<div class="game-stats flex justify-between text-sm">
									<span class="text-gray-600">{game.imageIds.length} photos</span>
									<span class="text-gray-600">By {game.createdBy}</span>
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
											<span class="tag bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
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
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalGames > itemsPerPage}
					<div class="pagination flex justify-center items-center gap-4">
						<button class="btn-secondary" disabled={currentPage === 1} on:click={prevPage}>
							← Previous
						</button>
						<span class="text-sm text-gray-600">
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
					<h3 class="text-xl font-semibold text-gray-800 mb-3">Sign In Required</h3>
					<p class="text-gray-600 mb-6">Sign in to view and manage your custom games</p>
					<button class="btn-primary" on:click={() => goto('/gallery')}> Sign In </button>
				</div>
			{:else if loadingGames}
				<div class="loading-state text-center py-12">
					<div class="loading-spinner mx-auto mb-4"></div>
					<p class="text-gray-600">Loading your games...</p>
				</div>
			{:else if gamesError}
				<div class="error-state text-center py-12">
					<div class="text-red-500 text-4xl mb-4">⚠️</div>
					<h3 class="text-lg font-semibold text-gray-800 mb-2">Error Loading Your Games</h3>
					<p class="text-gray-600 mb-4">{gamesError}</p>
					<button class="btn-primary" on:click={loadUserGames}>Try Again</button>
				</div>
			{:else if userGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎮</div>
					<h3 class="text-xl font-semibold text-gray-800 mb-3">No Games Yet</h3>
					<p class="text-gray-600 mb-6">
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
						<div
							class="game-card bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
						>
							<div class="game-header p-4 border-b border-gray-100">
								<h3 class="font-semibold text-gray-900 mb-1">{game.name}</h3>
								{#if game.description}
									<p class="text-sm text-gray-600">{game.description}</p>
								{/if}
							</div>

							<div class="game-info p-4 space-y-3">
								<div class="game-stats flex justify-between text-sm">
									<span class="text-gray-600">{game.imageIds.length} photos</span>
									<span class="text-gray-600">Created {formatDate(game.createdAt)}</span>
								</div>

								<div
									class="visibility-badge inline-block px-2 py-1 rounded text-xs font-medium
									{game.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}"
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
						</div>
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
	.game-card:hover {
		transform: translateY(-2px);
	}

	@media (max-width: 768px) {
		.games-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
