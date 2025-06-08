<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/authStore';
	// Dynamic import for UserGallery to reduce initial bundle size
	let UserGallery: any;
	let userGalleryLoaded = false;
	
	async function loadUserGallery() {
		if (!UserGallery && !userGalleryLoaded) {
			userGalleryLoaded = true;
			const module = await import('$lib/components/UserGallery.svelte');
			UserGallery = module.default;
		}
	}
	import AuthModal from '$lib/components/AuthModal.svelte';
	import type { ImageMetadata } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';
	import { showInfo, showSuccess, showError } from '$lib/stores/toastStore';

	let showAuthModal = false;
	let selectedImages: ImageMetadata[] = [];
	let showCreateGameModal = false;
	let newGameName = '';
	let newGameDescription = '';
	let newGameIsPublic = true;
	let newGameTags: string[] = [];
	let newGameDifficulty: 'easy' | 'medium' | 'hard' | undefined = undefined;
	let creating = false;
	let userGalleryComponent: any;

	// Reactive variables for header display
	$: selectedCount = selectedImages.length;
	$: canCreateGame = selectedCount >= 3 && selectedCount <= 20;

	onMount(async () => {
		// Load UserGallery component
		await loadUserGallery();
		
		// Show sign in prompt for unauthenticated users
		if (!$isAuthenticated) {
			showInfo('Sign in to create custom games');
		}
	});

	function handleLogin() {
		showAuthModal = true;
	}

	function handleImageSelect(event: CustomEvent<ImageMetadata[]>) {
		selectedImages = event.detail;
		if (selectedImages.length >= 3) {
			showCreateGameModal = true;
		} else {
			showInfo(`Select at least 3 photos to create a game (${selectedImages.length}/3)`);
		}
	}

	async function createCustomGame() {
		if (!newGameName.trim() || selectedImages.length < 3) return;

		try {
			creating = true;
			const imageIds = selectedImages.map((img) => img.id);
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

			showSuccess('Game created successfully!');

			// Navigate to play the new game
			await initializeGame({
				numRounds: imageIds.length,
				gameMode: 'custom',
				gameId
			});
			goto('/play');
		} catch (err) {
			showError(err instanceof Error ? err.message : 'Failed to create game');
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

	function addTag(tagInput: HTMLInputElement) {
		const tag = tagInput.value.trim();
		if (tag && !newGameTags.includes(tag) && newGameTags.length < 5) {
			newGameTags = [...newGameTags, tag];
			tagInput.value = '';
		}
	}

	function removeTag(tagToRemove: string) {
		newGameTags = newGameTags.filter((tag) => tag !== tagToRemove);
	}

	function handleTagInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			const input = event.target as HTMLInputElement;
			addTag(input);
		}
	}

	function handleUploadPhotos() {
		goto('/gallery?tab=upload');
	}

	function clearSelection() {
		selectedImages = [];
		if (userGalleryComponent) {
			userGalleryComponent.deselectAll();
		}
	}

	function createGameFromHeader() {
		if (selectedImages.length >= 3) {
			showCreateGameModal = true;
		} else {
			showInfo(`Select at least 3 photos to create a game (${selectedImages.length}/3)`);
		}
	}
</script>

<svelte:head>
	<title>Create Game - WhereAmI</title>
	<meta name="description" content="Create custom geography games with your photos." />
</svelte:head>

{#if !$isAuthenticated}
	<!-- Unauthenticated state -->
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="card max-w-md w-full text-center">
			<div class="text-blue-500 text-6xl mb-6">🎯</div>
			<h1 class="text-3xl font-bold mb-4" style="color: var(--text-primary);">
				Create Custom Game
			</h1>
			<p class="mb-6" style="color: var(--text-secondary);">
				Sign in to create custom geography games using your uploaded photos.
			</p>
			<button class="btn-primary w-full" on:click={handleLogin}> Sign In to Continue </button>
		</div>
	</div>
{:else}
	<!-- Authenticated state -->
	<div class="create-page min-h-screen" style="background-color: var(--bg-secondary);">
		<!-- Header -->
		<div
			class="page-header border-b"
			style="background-color: var(--bg-primary); border-color: var(--border-color);"
		>
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div
					class="header-content py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between"
				>
					<div class="flex items-center justify-between w-full">
						<div class="header-text">
							<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Create Game</h1>
							<p class="text-md mt-2" style="color: var(--text-secondary);">
								Select 3-20 photos to create your custom geography game
							</p>
						</div>

						<!-- Action Buttons -->
						<div class="action-section flex items-center gap-4">
							<div class="selection-info">
								<span class="text-sm font-medium" style="color: var(--text-primary);">
									{selectedCount} photos selected
								</span>
								{#if selectedCount > 0}
									<span class="text-xs ml-2" style="color: var(--text-secondary);">
										(need 3-20 for game)
									</span>
								{/if}
							</div>
							<div class="action-buttons flex gap-2">
								<button
									class="btn-secondary px-4 py-2"
									class:disabled={selectedCount === 0}
									disabled={selectedCount === 0}
									on:click={clearSelection}
								>
									Clear
								</button>
								<button
									class="btn-primary px-4 py-2"
									class:disabled={!canCreateGame}
									disabled={!canCreateGame}
									on:click={createGameFromHeader}
								>
									Create Game
									{#if selectedCount > 0}
										({selectedCount})
									{/if}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="create-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<!-- Photo Gallery -->
			{#if UserGallery}
				<svelte:component 
					this={UserGallery}
					selectable={true}
					multiSelect={true}
					on:imagesSelect={(event) => (selectedImages = event.detail)}
					on:switchToUpload={handleUploadPhotos}
					bind:this={userGalleryComponent}
				/>
			{:else}
				<div class="flex items-center justify-center py-12">
					<div class="text-center">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
						<p class="mt-2 text-sm text-gray-600">Loading photo gallery...</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Create Game Modal -->
{#if showCreateGameModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div
			class="rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
			style="background-color: var(--bg-primary);"
		>
			<div
				class="modal-header p-6 border-b flex items-center justify-between flex-shrink-0"
				style="border-color: var(--border-color);"
			>
				<div>
					<h3 class="text-xl font-semibold" style="color: var(--text-primary);">
						Create Custom Game
					</h3>
					<p class="text-sm mt-1" style="color: var(--text-secondary);">
						Creating a game with {selectedImages.length} photo{selectedImages.length !== 1
							? 's'
							: ''}
					</p>
				</div>
				<button
					class="close-button text-gray-500 hover:text-gray-700 transition-colors p-2"
					on:click={cancelCreateGame}
					aria-label="Close modal"
					disabled={creating}
				>
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="modal-content p-6 overflow-y-auto flex-1 min-h-0">
				<div class="form-section mb-6">
					<label
						for="game-name"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-primary);"
					>
						Game Name *
					</label>
					<input
						id="game-name"
						type="text"
						class="input-field"
						placeholder="Enter a name for your game..."
						bind:value={newGameName}
						maxlength="100"
					/>
				</div>

				<div class="form-section mb-6">
					<label
						for="game-description"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-primary);"
					>
						Description (Optional)
					</label>
					<textarea
						id="game-description"
						class="input-field"
						rows="3"
						placeholder="Describe your game theme or locations..."
						bind:value={newGameDescription}
						maxlength="500"
					></textarea>
				</div>

				<div class="form-section mb-6">
					<label
						for="game-difficulty"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-primary);"
					>
						Difficulty Level (Optional)
					</label>
					<select id="game-difficulty" class="input-field" bind:value={newGameDifficulty}>
						<option value={undefined}>Select difficulty...</option>
						<option value="easy">Easy - Well-known landmarks</option>
						<option value="medium">Medium - Recognizable places</option>
						<option value="hard">Hard - Obscure locations</option>
					</select>
				</div>

				<div class="form-section mb-6">
					<label
						for="game-tags"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-primary);"
					>
						Tags (Optional) - Max 5 tags
					</label>
					<div class="tags-input">
						<input
							id="game-tags"
							type="text"
							class="input-field"
							placeholder="Add a tag and press Enter..."
							on:keydown={handleTagInputKeydown}
							disabled={newGameTags.length >= 5}
						/>
						{#if newGameTags.length > 0}
							<div class="tags-list flex flex-wrap gap-2 mt-2">
								{#each newGameTags as tag}
									<span
										class="tag px-2 py-1 bg-blue-100-theme text-blue-700-theme text-sm rounded-full flex items-center gap-1"
									>
										{tag}
										<button
											class="text-blue-600 hover:text-blue-800"
											on:click={() => removeTag(tag)}
											aria-label={`Remove tag ${tag}`}
										>
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
						<span class="ml-2 text-sm" style="color: var(--text-primary);">
							Make this game public (others can discover and play it)
						</span>
					</label>
				</div>

				<!-- Selected Images Preview -->
				<div class="selected-images mb-6">
					<h4 class="text-sm font-medium mb-3" style="color: var(--text-primary);">
						Selected Photos
					</h4>
					<div class="image-preview-grid grid grid-cols-6 gap-2">
						{#each selectedImages.slice(0, 12) as image}
							<div
								class="preview-item aspect-square rounded overflow-hidden"
								style="background-color: var(--bg-secondary);"
							>
								<img
									src={image.thumbnailUrl || `/api/images/${image.id}`}
									alt={image.filename}
									class="w-full h-full object-cover"
								/>
							</div>
						{/each}
						{#if selectedImages.length > 12}
							<div
								class="preview-item aspect-square rounded flex items-center justify-center text-xs"
								style="background-color: var(--bg-tertiary); color: var(--text-secondary);"
							>
								+{selectedImages.length - 12} more
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div
				class="modal-footer p-6 border-t flex justify-center flex-shrink-0"
				style="border-color: var(--border-color);"
			>
				<button
					class="btn-primary px-8"
					disabled={!newGameName.trim() || selectedImages.length < 3 || creating}
					on:click={createCustomGame}
				>
					{creating ? 'Creating...' : 'Create & Play Game'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Auth modal -->
<AuthModal bind:isOpen={showAuthModal} on:close={() => (showAuthModal = false)} />

<style>
	.create-page {
		min-height: calc(100vh - 64px); /* Account for navigation height */
	}

	.preview-item {
		border: 2px solid transparent;
	}

	.tags-input input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tag button {
		font-size: 1.2em;
		line-height: 1;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
	}

	.close-button {
		border-radius: 0.375rem;
	}

	.close-button:hover {
		background-color: var(--bg-secondary);
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.close-button svg {
		stroke: var(--text-secondary);
	}

	.close-button:hover svg {
		stroke: var(--text-primary);
	}

	@media (max-width: 640px) {
		.modal-content {
			padding: 1rem;
		}

		.modal-header,
		.modal-footer {
			padding: 1rem;
		}

		.image-preview-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.disabled:hover {
		background: transparent !important;
		color: var(--text-secondary) !important;
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

		.action-section {
			align-items: center !important;
			width: 100%;
			flex-direction: column;
			gap: 1rem !important;
		}

		.selection-info {
			text-align: center !important;
		}

		.selection-info .text-xs {
			display: block !important;
			margin-left: 0 !important;
			margin-top: 0.25rem;
		}

		.action-buttons {
			width: 100%;
			justify-content: center;
		}

		.action-buttons button {
			flex: 1;
			max-width: 120px;
		}
	}
</style>
