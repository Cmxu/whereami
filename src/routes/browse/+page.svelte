<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/authStore';
	import UserGallery from '$lib/components/UserGallery.svelte';
	import GameRating from '$lib/components/GameRating.svelte';
	import ShareGame from '$lib/components/ShareGame.svelte';
	import type { ImageMetadata, CustomGame, GameSearchFilters } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';

	type TabType = 'gallery' | 'games' | 'create';
	type GameFilter = 'public' | 'my-games';
	
	let activeTab: TabType = 'gallery';
	let gameFilter: GameFilter = 'public';
	let publicGames: CustomGame[] = [];
	let userGames: CustomGame[] = [];
	let loadingGames = false;
	let gamesError: string | null = null;
	let selectedImages: ImageMetadata[] = [];
	let showCreateGameModal = false;
	let newGameName = '';
	let newGameDescription = '';
	let newGameIsPublic = true;
	let newGameTags: string[] = [];
	let newGameDifficulty: 'easy' | 'medium' | 'hard' | undefined = undefined;
	let creating = false;
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
		const tabParam = urlParams.get('tab');
		const filterParam = urlParams.get('filter');
		
		if (tabParam === 'gallery' || tabParam === 'games' || tabParam === 'create') {
			activeTab = tabParam;
		}
		
		if (filterParam === 'my-games') {
			gameFilter = 'my-games';
			activeTab = 'games';
		}
		
		if (activeTab === 'games') {
			loadGames();
		}
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

			publicGames = await api.getPublicGames(itemsPerPage, (currentPage - 1) * itemsPerPage, filters);
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

	function switchTab(tab: TabType) {
		activeTab = tab;
		if (tab === 'games') {
			loadGames();
		}
		updateURL();
	}

	function switchGameFilter(filter: GameFilter) {
		gameFilter = filter;
		currentPage = 1;
		loadGames();
		updateURL();
	}

	function updateURL() {
		const params = new URLSearchParams();
		if (activeTab !== 'gallery') {
			params.set('tab', activeTab);
		}
		if (gameFilter === 'my-games') {
			params.set('filter', 'my-games');
		}
		
		const newUrl = params.toString() ? `?${params.toString()}` : '/browse';
		window.history.replaceState({}, '', newUrl);
	}

	function handleImageSelect(event: CustomEvent<ImageMetadata>) {
		// Single image selection - could be used for image preview
		console.log('Selected image:', event.detail);
	}

	function handleCreateGame(event: CustomEvent<ImageMetadata[]>) {
		selectedImages = event.detail;
		showCreateGameModal = true;
	}

	async function createCustomGame() {
		if (!newGameName.trim() || selectedImages.length < 3) return;

		try {
			creating = true;
			const imageIds = selectedImages.map(img => img.id);
			const gameId = await api.createCustomGame(
				imageIds,
				newGameName.trim(),
				newGameDescription.trim() || undefined,
				newGameIsPublic,
				newGameTags.length > 0 ? newGameTags : undefined,
				newGameDifficulty
			);

			// Reset form
			showCreateGameModal = false;
			newGameName = '';
			newGameDescription = '';
			newGameTags = [];
			newGameDifficulty = undefined;
			selectedImages = [];

			// Navigate to play the new game
			await initializeGame({
				numRounds: imageIds.length,
				gameMode: 'custom',
				gameId
			});
			goto('/');

		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to create game');
		} finally {
			creating = false;
		}
	}

	function cancelCreateGame() {
		showCreateGameModal = false;
		newGameName = '';
		newGameDescription = '';
		newGameTags = [];
		newGameDifficulty = undefined;
		selectedImages = [];
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

	function shareGame(game: CustomGame) {
		gameToShare = game;
		showShareModal = true;
	}

	function viewGameDetails(game: CustomGame) {
		goto(`/games/${game.id}`);
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString();
	}

	function formatPlayCount(count: number): string {
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}k`;
		}
		return count.toString();
	}

	function addTag(tagInput: HTMLInputElement) {
		const tag = tagInput.value.trim();
		if (tag && !newGameTags.includes(tag) && newGameTags.length < 5) {
			newGameTags = [...newGameTags, tag];
			tagInput.value = '';
		}
	}

	function removeTag(tagToRemove: string) {
		newGameTags = newGameTags.filter(tag => tag !== tagToRemove);
	}

	function handleTagInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			const input = event.target as HTMLInputElement;
			addTag(input);
		}
	}

	function applyFilters() {
		currentPage = 1;
		loadGames();
	}

	function clearFilters() {
		searchQuery = '';
		sortBy = 'newest';
		difficultyFilter = 'all';
		minRating = 0;
		tagFilter = '';
		applyFilters();
	}

	// Reactive filter updates
	$: if (activeTab === 'games' && (searchQuery || sortBy || difficultyFilter || minRating || tagFilter)) {
		// Simple debounced filter update
		applyFilters();
	}
</script>

<svelte:head>
	<title>Browse - WhereAmI</title>
	<meta name="description" content="Browse your uploaded photos and discover public geography games." />
</svelte:head>

<div class="browse-page min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="browse-header bg-white shadow-sm p-4">
		<div class="max-w-6xl mx-auto">
			<div class="flex justify-between items-center mb-4">
				<div>
					<h1 class="text-2xl font-bold text-gray-800">Browse & Create</h1>
					<p class="text-gray-600">Manage your photos and discover new games</p>
				</div>
				<button class="btn-secondary" on:click={() => goto('/')}>← Back to Home</button>
			</div>

			<!-- Tab Navigation -->
			<div class="tab-navigation">
				<div class="flex space-x-1 bg-gray-100 rounded-lg p-1">
					<button 
						class="tab-btn flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200"
						class:bg-white={activeTab === 'gallery'}
						class:text-blue-600={activeTab === 'gallery'}
						class:shadow-sm={activeTab === 'gallery'}
						class:text-gray-600={activeTab !== 'gallery'}
						on:click={() => switchTab('gallery')}
					>
						📸 Your Gallery
					</button>
					<button 
						class="tab-btn flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200"
						class:bg-white={activeTab === 'games'}
						class:text-blue-600={activeTab === 'games'}
						class:shadow-sm={activeTab === 'games'}
						class:text-gray-600={activeTab !== 'games'}
						on:click={() => switchTab('games')}
					>
						🌍 Public Games
					</button>
					<button 
						class="tab-btn flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200"
						class:bg-white={activeTab === 'create'}
						class:text-blue-600={activeTab === 'create'}
						class:shadow-sm={activeTab === 'create'}
						class:text-gray-600={activeTab !== 'create'}
						on:click={() => switchTab('create')}
					>
						🎯 Create Game
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="tab-content max-w-6xl mx-auto p-4">
		{#if activeTab === 'gallery'}
			<UserGallery 
				selectable={false}
				multiSelect={false}
				on:imageSelect={handleImageSelect}
			/>
		{:else if activeTab === 'games'}
			<div class="games-section">
				<div class="section-header mb-6">
					<h2 class="text-xl font-semibold text-gray-800 mb-2">Games</h2>
					<p class="text-gray-600">Play geography games created by the community or view your own</p>
				</div>

				<!-- Game Filter Tabs -->
				<div class="game-filter-tabs mb-6">
					<div class="flex space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
						<button 
							class="filter-tab px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200"
							class:bg-white={gameFilter === 'public'}
							class:text-blue-600={gameFilter === 'public'}
							class:shadow-sm={gameFilter === 'public'}
							class:text-gray-600={gameFilter !== 'public'}
							on:click={() => switchGameFilter('public')}
						>
							🌍 Public Games
						</button>
						{#if $isAuthenticated}
							<button 
								class="filter-tab px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200"
								class:bg-white={gameFilter === 'my-games'}
								class:text-blue-600={gameFilter === 'my-games'}
								class:shadow-sm={gameFilter === 'my-games'}
								class:text-gray-600={gameFilter !== 'my-games'}
								on:click={() => switchGameFilter('my-games')}
							>
								🎮 My Games
							</button>
						{/if}
					</div>
				</div>

				<!-- Search and Filters (only for public games) -->
				{#if gameFilter === 'public'}
					<div class="search-filters bg-white rounded-lg border p-4 mb-6">
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
							<!-- Search -->
							<div class="search-field lg:col-span-2">
								<input
									type="text"
									placeholder="Search games..."
									class="input-field"
									bind:value={searchQuery}
								/>
							</div>

							<!-- Sort -->
							<div class="sort-field">
								<select class="input-field" bind:value={sortBy}>
									<option value="newest">Newest First</option>
									<option value="oldest">Oldest First</option>
									<option value="popular">Most Popular</option>
									<option value="rating">Highest Rated</option>
								</select>
							</div>

							<!-- Difficulty Filter -->
							<div class="difficulty-field">
								<select class="input-field" bind:value={difficultyFilter}>
									<option value="all">All Difficulties</option>
									<option value="easy">Easy</option>
									<option value="medium">Medium</option>
									<option value="hard">Hard</option>
								</select>
							</div>

							<!-- Actions -->
							<div class="filter-actions flex gap-2">
								<button class="btn-secondary flex-1 text-sm" on:click={clearFilters}>
									Clear
								</button>
							</div>
						</div>

						<!-- Additional Filters Row -->
						<div class="additional-filters grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
							<!-- Tag Filter -->
							<div class="tag-filter">
								<input
									type="text"
									placeholder="Filter by tag..."
									class="input-field"
									bind:value={tagFilter}
								/>
							</div>

							<!-- Rating Filter -->
							<div class="rating-filter">
								<label class="block text-sm font-medium text-gray-700 mb-1">
									Minimum Rating: {minRating} stars
								</label>
								<input
									type="range"
									min="0"
									max="5"
									step="0.5"
									class="w-full"
									bind:value={minRating}
								/>
							</div>
						</div>
					</div>
				{/if}

				<!-- Loading State -->
				{#if loadingGames}
					<div class="loading-state text-center py-12">
						<div class="loading-spinner mx-auto mb-4"></div>
						<p class="text-gray-600">
							Loading {gameFilter === 'my-games' ? 'your' : 'public'} games...
						</p>
					</div>
				{/if}

				<!-- Error State -->
				{#if gamesError}
					<div class="error-state text-center py-12">
						<div class="text-red-500 text-4xl mb-4">⚠️</div>
						<h3 class="text-lg font-semibold text-gray-800 mb-2">Error Loading Games</h3>
						<p class="text-gray-600 mb-4">{gamesError}</p>
						<button class="btn-primary" on:click={loadGames}>Try Again</button>
					</div>
				{/if}

				<!-- Empty State -->
				{#if !loadingGames && !gamesError}
					{#if gameFilter === 'public' && publicGames.length === 0}
						<div class="empty-state text-center py-12">
							<div class="text-6xl mb-6">🌍</div>
							<h3 class="text-xl font-semibold text-gray-800 mb-4">No Public Games Found</h3>
							<p class="text-gray-600 mb-6">
								{searchQuery || tagFilter || difficultyFilter !== 'all' || minRating > 0 
									? 'Try adjusting your search filters'
									: 'Be the first to create and share a public game!'
								}
							</p>
							<div class="flex gap-3 justify-center">
								{#if searchQuery || tagFilter || difficultyFilter !== 'all' || minRating > 0}
									<button class="btn-secondary" on:click={clearFilters}>
										Clear Filters
									</button>
								{/if}
								<button class="btn-primary" on:click={() => switchTab('create')}>
									Create a Game
								</button>
							</div>
						</div>
					{:else if gameFilter === 'my-games' && userGames.length === 0}
						<div class="empty-state text-center py-12">
							<div class="text-6xl mb-6">🎮</div>
							<h3 class="text-xl font-semibold text-gray-800 mb-4">No Games Created Yet</h3>
							<p class="text-gray-600 mb-6">Create your first custom geography game using your uploaded photos</p>
							<button class="btn-primary" on:click={() => switchTab('create')}>
								Create Your First Game
							</button>
						</div>
					{/if}
				{/if}

				<!-- Games Grid -->
				{#if !loadingGames && !gamesError}
					{@const currentGames = gameFilter === 'my-games' ? userGames : publicGames}
					{#if currentGames.length > 0}
						<div class="games-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{#each currentGames as game}
								<div class="game-card bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden">
									<div class="game-header p-4 border-b">
										<h3 class="font-semibold text-gray-800 text-lg mb-1" title={game.name}>
											{game.name}
										</h3>
										<p class="text-sm text-gray-600 line-clamp-2">
											{game.description || 'No description provided'}
										</p>
									</div>
									
									<div class="game-info p-4">
										<div class="flex justify-between items-center mb-3">
											<div class="flex items-center text-sm text-gray-500">
												<span class="mr-1">📸</span>
												<span>{game.imageIds.length} photos</span>
											</div>
											<div class="flex items-center text-sm text-gray-500">
												<span class="mr-1">🎮</span>
												<span>{formatPlayCount(game.playCount)} plays</span>
											</div>
										</div>

										<!-- Rating Display -->
										<div class="rating-display mb-3">
											<GameRating {game} readonly={true} size="sm" />
										</div>
										
										<!-- Game Meta -->
										<div class="game-meta flex justify-between items-center text-xs text-gray-500 mb-3">
											<div>by {gameFilter === 'my-games' ? 'You' : game.createdBy}</div>
											<div>{formatDate(game.createdAt)}</div>
										</div>
										
										<!-- Tags -->
										{#if game.tags && game.tags.length > 0}
											<div class="game-tags mb-3 flex flex-wrap gap-1">
												{#each game.tags.slice(0, 3) as tag}
													<span class="tag px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
														{tag}
													</span>
												{/each}
												{#if game.tags.length > 3}
													<span class="text-xs text-gray-500">+{game.tags.length - 3} more</span>
												{/if}
											</div>
										{/if}

										<!-- Actions -->
										<div class="game-actions flex gap-2">
											<button 
												class="btn-primary flex-1 text-sm"
												on:click={() => playPublicGame(game)}
											>
												▶️ Play
											</button>
											<button 
												class="btn-secondary text-sm"
												on:click={() => viewGameDetails(game)}
												title="View Details"
											>
												👁️
											</button>
											<button 
												class="btn-secondary text-sm"
												on:click={() => shareGame(game)}
												title="Share Game"
											>
												🔗
											</button>
										</div>
									</div>
								</div>
							{/each}
						</div>

						<!-- Pagination (for public games only) -->
						{#if gameFilter === 'public' && totalGames > itemsPerPage}
							<div class="pagination flex justify-center items-center gap-4 mt-8">
								<button
									class="btn-secondary"
									disabled={currentPage === 1}
									on:click={() => { currentPage = Math.max(1, currentPage - 1); loadGames(); }}
								>
									← Previous
								</button>
								<span class="pagination-info text-sm text-gray-600">
									Page {currentPage} of {Math.ceil(totalGames / itemsPerPage)}
								</span>
								<button
									class="btn-secondary"
									disabled={currentPage >= Math.ceil(totalGames / itemsPerPage)}
									on:click={() => { currentPage++; loadGames(); }}
								>
									Next →
								</button>
							</div>
						{/if}
					{/if}
				{/if}
			</div>
		{:else if activeTab === 'create'}
			<div class="create-game">
				<div class="section-header mb-6">
					<h2 class="text-xl font-semibold text-gray-800 mb-2">Create Custom Game</h2>
					<p class="text-gray-600">Select 3-20 photos from your gallery to create a custom geography game</p>
				</div>

				<UserGallery 
					selectable={true}
					multiSelect={true}
					maxSelection={20}
					on:createGame={handleCreateGame}
				/>
			</div>
		{/if}
	</div>
</div>

<!-- Enhanced Create Game Modal -->
{#if showCreateGameModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
			<div class="modal-header p-6 border-b">
				<h3 class="text-xl font-semibold text-gray-800">Create Custom Game</h3>
				<p class="text-sm text-gray-600 mt-1">
					Creating a game with {selectedImages.length} photo{selectedImages.length !== 1 ? 's' : ''}
				</p>
			</div>
			
			<div class="modal-content p-6 overflow-y-auto">
				<div class="form-section mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Game Name *
					</label>
					<input
						type="text"
						class="input-field"
						placeholder="Enter a name for your game..."
						bind:value={newGameName}
						maxlength="100"
					/>
				</div>

				<div class="form-section mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Description (Optional)
					</label>
					<textarea
						class="input-field"
						rows="3"
						placeholder="Describe your game theme or locations..."
						bind:value={newGameDescription}
						maxlength="500"
					></textarea>
				</div>

				<!-- Enhanced options -->
				<div class="form-section mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Difficulty Level (Optional)
					</label>
					<select class="input-field" bind:value={newGameDifficulty}>
						<option value={undefined}>Select difficulty...</option>
						<option value="easy">Easy - Well-known landmarks</option>
						<option value="medium">Medium - Recognizable places</option>
						<option value="hard">Hard - Obscure locations</option>
					</select>
				</div>

				<div class="form-section mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Tags (Optional) - Max 5 tags
					</label>
					<div class="tags-input">
						<input
							type="text"
							class="input-field"
							placeholder="Add a tag and press Enter..."
							on:keydown={handleTagInputKeydown}
							disabled={newGameTags.length >= 5}
						/>
						{#if newGameTags.length > 0}
							<div class="tags-list flex flex-wrap gap-2 mt-2">
								{#each newGameTags as tag}
									<span class="tag px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
										{tag}
										<button class="text-blue-600 hover:text-blue-800" on:click={() => removeTag(tag)}>
											×
										</button>
									</span>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="form-section mb-6">
					<label class="flex items-center">
						<input
							type="checkbox"
							class="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
							bind:checked={newGameIsPublic}
						/>
						<span class="ml-2 text-sm text-gray-700">
							Make this game public (others can discover and play it)
						</span>
					</label>
				</div>

				<!-- Selected Images Preview -->
				<div class="selected-images mb-6">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Selected Photos</h4>
					<div class="image-preview-grid grid grid-cols-6 gap-2">
						{#each selectedImages.slice(0, 12) as image}
							<div class="preview-item aspect-square bg-gray-100 rounded overflow-hidden">
								<img 
									src={image.thumbnailUrl || `/api/images/${image.id}`}
									alt={image.filename}
									class="w-full h-full object-cover"
								/>
							</div>
						{/each}
						{#if selectedImages.length > 12}
							<div class="preview-item aspect-square bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600">
								+{selectedImages.length - 12} more
							</div>
						{/if}
					</div>
				</div>
			</div>
			
			<div class="modal-footer p-6 border-t flex justify-end gap-3">
				<button class="btn-secondary" on:click={cancelCreateGame} disabled={creating}>
					Cancel
				</button>
				<button 
					class="btn-primary" 
					disabled={!newGameName.trim() || selectedImages.length < 3 || creating}
					on:click={createCustomGame}
				>
					{creating ? 'Creating...' : 'Create & Play Game'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Share Modal -->
{#if gameToShare}
	<ShareGame 
		game={gameToShare} 
		bind:showModal={showShareModal} 
		on:shared={() => console.log('Game shared')} 
		on:close={() => { showShareModal = false; gameToShare = null; }} 
	/>
{/if}

<style>
	.tab-btn:hover {
		background-color: rgba(59, 130, 246, 0.1);
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.game-card:hover {
		transform: translateY(-2px);
	}

	.image-preview-grid {
		max-height: 200px;
		overflow-y: auto;
	}

	/* Custom scrollbar for image preview */
	.image-preview-grid::-webkit-scrollbar {
		width: 6px;
	}

	.image-preview-grid::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 3px;
	}

	.image-preview-grid::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 3px;
	}

	.image-preview-grid::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}

	@media (max-width: 768px) {
		.tab-navigation .flex {
			flex-direction: column;
			space-y: 1;
		}
		
		.tab-btn {
			width: 100%;
		}
		
		.games-grid {
			grid-template-columns: 1fr;
		}
		
		.image-preview-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}
</style>
