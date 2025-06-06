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

	// Delete confirmation modal
	let showDeleteModal = false;
	let gameToDelete: CustomGame | null = null;
	let deletingGame = false;

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

	// Image thumbnails for games
	let gameThumbnails: { [gameId: string]: string[] } = {};

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

			const response = await api.getPublicGames(
				itemsPerPage,
				(currentPage - 1) * itemsPerPage,
				filters
			);

			// Handle the paginated response format
			publicGames = response.games || [];
			totalGames = response.total || 0;

			// Load thumbnails for each game
			await loadGameThumbnails(publicGames);
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

			// Load thumbnails for each game
			await loadGameThumbnails(userGames);
		} catch (err) {
			gamesError = err instanceof Error ? err.message : 'Failed to load your games';
		} finally {
			loadingGames = false;
		}
	}

	async function loadGameThumbnails(games: CustomGame[]) {
		// Load thumbnails for the first 3 images of each game
		const thumbnailPromises = games.map(async (game) => {
			try {
				const response = await fetch(`/api/games/${game.id}/images`);
				if (response.ok) {
					const images = await response.json();
					const thumbnails = images
						.slice(0, 3)
						.map((img: any) => `/api/images/${img.id}/${img.filename}?w=150&h=100&fit=cover&q=80`);
					gameThumbnails[game.id] = thumbnails;
				}
			} catch (error) {
				console.error(`Failed to load thumbnails for game ${game.id}:`, error);
				gameThumbnails[game.id] = [];
			}
		});

		await Promise.all(thumbnailPromises);
		gameThumbnails = { ...gameThumbnails };
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

	function confirmDeleteGame(game: CustomGame) {
		gameToDelete = game;
		showDeleteModal = true;
	}

	async function deleteGame() {
		if (!gameToDelete) return;

		try {
			deletingGame = true;
			await api.deleteGame(gameToDelete.id);

			// Remove from local state
			userGames = userGames.filter((game) => game.id !== gameToDelete!.id);

			// Close modal and reset state
			showDeleteModal = false;
			gameToDelete = null;

			// Success - no popup needed, user can see the game disappeared from the list
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to delete game');
		} finally {
			deletingGame = false;
		}
	}

	function cancelDeleteGame() {
		showDeleteModal = false;
		gameToDelete = null;
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
	<div
		class="page-header border-b"
		style="background-color: var(--bg-primary); border-color: var(--border-color);"
	>
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="header-content py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
				<!-- Page title and toggle button -->
				<div class="flex items-center justify-between w-full">
					<div class="header-text">
						<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Browse Games</h1>
						<p class="text-md mt-2" style="color: var(--text-secondary);">
							Discover and play community-created geography games
						</p>
					</div>

					<!-- Toggle Button -->
					<div
						class="flex bg-gray-100 rounded-lg p-1"
						style="background-color: var(--bg-tertiary);"
					>
						<button
							class="tab-button {gameFilter === 'public' ? 'active' : ''}"
							on:click={() => switchGameFilter('public')}
						>
							🌍 Public Games
						</button>
						<button
							class="tab-button {gameFilter === 'my-games' ? 'active' : ''}"
							on:click={() => switchGameFilter('my-games')}
							disabled={!$isAuthenticated}
						>
							🎮 My Games
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Filters -->
		<div
			class="filters-section rounded-lg border p-6 mb-8"
			style="background-color: var(--bg-primary); border-color: var(--border-color);"
		>
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
				<!-- Search -->
				<div class="search-field">
					<input
						type="text"
						placeholder="Search games..."
						bind:value={searchQuery}
						on:input={handleSearch}
						class="input-field h-11 w-full"
					/>
				</div>

				<!-- Difficulty Filter -->
				<div class="filter-field">
					<select
						bind:value={difficultyFilter}
						on:change={handleFilterChange}
						class="input-field h-11 w-full"
					>
						<option value="all">All Difficulties</option>
						<option value="easy">Easy</option>
						<option value="medium">Medium</option>
						<option value="hard">Hard</option>
					</select>
				</div>

				<!-- Sort -->
				<div class="sort-field">
					<select
						bind:value={sortBy}
						on:change={handleFilterChange}
						class="input-field h-11 w-full"
					>
						<option value="newest">Newest</option>
						<option value="popular">Most Played</option>
						<option value="rating">Highest Rated</option>
					</select>
				</div>

				<!-- Create Game Button -->
				<div class="action-field">
					{#if $isAuthenticated}
						<button
							class="btn-primary w-full h-11 flex items-center justify-center gap-2"
							on:click={handleCreateGame}
						>
							<span>🎯</span>
							Create Game
						</button>
					{:else}
						<div class="h-11"></div>
					{/if}
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
					<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
						Error Loading Games
					</h3>
					<p class="mb-4" style="color: var(--text-secondary);">{gamesError}</p>
					<button class="btn-primary" on:click={loadPublicGames}>Try Again</button>
				</div>
			{:else if publicGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎯</div>
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">
						No Games Found
					</h3>
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
							<!-- Game Thumbnails -->
							{#if gameThumbnails[game.id] && gameThumbnails[game.id].length > 0}
								<div class="game-thumbnails flex h-24 overflow-hidden">
									{#each gameThumbnails[game.id] as thumbnail, index}
										<div class="flex-1 relative">
											<img
												src={thumbnail}
												alt="Game preview {index + 1}"
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										</div>
									{/each}
									{#if gameThumbnails[game.id].length < 3}
										{#each Array(3 - gameThumbnails[game.id].length) as _, index}
											<div
												class="flex-1 bg-gray-200 flex items-center justify-center"
												style="background-color: var(--bg-tertiary);"
											>
												<span class="text-xs text-gray-400">📷</span>
											</div>
										{/each}
									{/if}
								</div>
							{:else}
								<div
									class="game-thumbnails flex h-24 overflow-hidden bg-gray-200"
									style="background-color: var(--bg-tertiary);"
								>
									<div class="w-full flex items-center justify-center">
										<span class="text-gray-400">📷 {game.imageIds.length} photos</span>
									</div>
								</div>
							{/if}

							<div class="game-header p-4 border-b" style="border-color: var(--border-color);">
								<h3 class="font-semibold mb-1" style="color: var(--text-primary);">{game.name}</h3>
								{#if game.description}
									<p class="text-sm line-clamp-2" style="color: var(--text-secondary);">
										{game.description}
									</p>
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
											<span
												class="tag bg-blue-100-theme text-blue-800-theme px-2 py-1 rounded text-xs"
											>
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
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">
						Sign In Required
					</h3>
					<p class="mb-6" style="color: var(--text-secondary);">
						Sign in to view and manage your custom games
					</p>
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
					<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
						Error Loading Your Games
					</h3>
					<p class="mb-4" style="color: var(--text-secondary);">{gamesError}</p>
					<button class="btn-primary" on:click={loadUserGames}>Try Again</button>
				</div>
			{:else if userGames.length === 0}
				<div class="empty-state text-center py-12">
					<div class="text-gray-400 text-6xl mb-6">🎮</div>
					<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">
						No Games Yet
					</h3>
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
						<div
							class="game-card rounded-lg border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
							style="background-color: var(--bg-primary); border-color: var(--border-color);"
						>
							<!-- Game Thumbnails -->
							{#if gameThumbnails[game.id] && gameThumbnails[game.id].length > 0}
								<div class="game-thumbnails flex h-24 overflow-hidden">
									{#each gameThumbnails[game.id] as thumbnail, index}
										<div class="flex-1 relative">
											<img
												src={thumbnail}
												alt="Game preview {index + 1}"
												class="w-full h-full object-cover"
												loading="lazy"
											/>
										</div>
									{/each}
									{#if gameThumbnails[game.id].length < 3}
										{#each Array(3 - gameThumbnails[game.id].length) as _, index}
											<div
												class="flex-1 bg-gray-200 flex items-center justify-center"
												style="background-color: var(--bg-tertiary);"
											>
												<span class="text-xs text-gray-400">📷</span>
											</div>
										{/each}
									{/if}
								</div>
							{:else}
								<div
									class="game-thumbnails flex h-24 overflow-hidden bg-gray-200"
									style="background-color: var(--bg-tertiary);"
								>
									<div class="w-full flex items-center justify-center">
										<span class="text-gray-400">📷 {game.imageIds.length} photos</span>
									</div>
								</div>
							{/if}

							<a href="/games/{game.id}" class="game-link block">
								<div class="game-header p-4 border-b" style="border-color: var(--border-color);">
									<h3 class="font-semibold mb-1" style="color: var(--text-primary);">
										{game.name}
									</h3>
									{#if game.description}
										<p class="text-sm line-clamp-2" style="color: var(--text-secondary);">
											{game.description}
										</p>
									{/if}
								</div>

								<div class="game-info p-4 space-y-3">
									<div class="game-stats flex justify-between text-sm">
										<span style="color: var(--text-secondary);">{game.imageIds.length} photos</span>
										<span style="color: var(--text-secondary);"
											>Created {formatDate(game.createdAt)}</span
										>
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
								</div>
							</a>

							<div class="game-actions p-4 pt-0 flex gap-2">
								<button
									class="btn-primary flex-1"
									on:click={(e) => {
										e.stopPropagation();
										playUserGame(game);
									}}
								>
									🎮 Play
								</button>
								<button
									class="btn-secondary"
									on:click={(e) => {
										e.stopPropagation();
										shareGame(game);
									}}
									title="Share"
								>
									📤
								</button>
								<button
									class="btn-danger px-3"
									on:click={(e) => {
										e.stopPropagation();
										confirmDeleteGame(game);
									}}
									title="Delete game"
								>
									🗑️
								</button>
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

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && gameToDelete}
	<div
		class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background-color: rgba(0, 0, 0, 0.5);"
	>
		<div
			class="modal bg-white rounded-lg shadow-xl max-w-md w-full p-6"
			style="background-color: var(--bg-primary); border: 1px solid var(--border-color);"
		>
			<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">Delete Game</h2>
			<p class="mb-2" style="color: var(--text-secondary);">
				Are you sure you want to delete "<strong>{gameToDelete.name}</strong>"?
			</p>
			<p class="text-sm mb-6" style="color: var(--text-tertiary);">
				This action cannot be undone. The game will be permanently removed.
			</p>
			<div class="flex gap-3 justify-end">
				<button class="btn-secondary" on:click={cancelDeleteGame} disabled={deletingGame}>
					Cancel
				</button>
				<button class="btn-danger" on:click={deleteGame} disabled={deletingGame}>
					{deletingGame ? 'Deleting...' : 'Delete Game'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tab-button {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.375rem;
		transition: all 0.2s;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		position: relative;
	}

	.tab-button:hover:not(:disabled) {
		color: var(--text-primary);
		background: var(--bg-secondary);
	}

	.tab-button.active {
		color: var(--text-primary);
		background: var(--bg-primary);
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.tab-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.game-card:hover {
		transform: translateY(-2px);
	}

	.game-thumbnails img {
		transition: transform 0.2s ease;
	}

	.game-card:hover .game-thumbnails img {
		transform: scale(1.05);
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
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
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		.games-grid {
			grid-template-columns: 1fr;
		}

		.filters-section .grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.header-content {
			flex-direction: column;
			align-items: stretch;
		}

		.header-content > div {
			flex-direction: column;
			align-items: center;
			gap: 1rem;
		}

		.tab-button {
			flex: 1;
			text-align: center;
		}
	}
</style>
