<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { isAuthenticated } from '$lib/stores/authStore';
	import UserGallery from '$lib/components/UserGallery.svelte';
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

	onMount(() => {
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
			goto('/');
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
			<h1 class="text-3xl font-bold text-gray-800 mb-4">Create Custom Game</h1>
			<p class="text-gray-600 mb-6">
				Sign in to create custom geography games using your uploaded photos.
			</p>
			<button class="btn-primary w-full" on:click={handleLogin}> Sign In to Continue </button>
		</div>
	</div>
{:else}
	<!-- Authenticated state -->
	<div class="create-page min-h-screen bg-gray-50">
		<!-- Header -->
		<div class="page-header bg-white border-b border-gray-200">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
					<div>
						<h1 class="text-2xl font-bold text-gray-900">Create Custom Game</h1>
						<p class="text-gray-600">
							Select 3-20 photos from your gallery to create a geography game
						</p>
					</div>

					<!-- Action buttons -->
					<div class="flex gap-3">
						<button class="btn-secondary" on:click={handleUploadPhotos}>
							📤 Upload More Photos
						</button>
						{#if selectedImages.length > 0}
							<button
								class="btn-primary"
								on:click={() => (showCreateGameModal = true)}
								disabled={selectedImages.length < 3}
							>
								Create Game ({selectedImages.length})
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="create-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<!-- Selection info -->
			{#if selectedImages.length > 0}
				<div class="selection-info bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div class="text-blue-600 text-xl">✅</div>
							<div>
								<p class="font-medium text-blue-900">
									{selectedImages.length} photo{selectedImages.length !== 1 ? 's' : ''} selected
								</p>
								<p class="text-sm text-blue-700">
									{selectedImages.length < 3
										? `Select ${3 - selectedImages.length} more to create a game`
										: 'Ready to create your game!'}
								</p>
							</div>
						</div>
						<button
							class="btn-primary"
							on:click={() => (showCreateGameModal = true)}
							disabled={selectedImages.length < 3}
						>
							Create Game
						</button>
					</div>
				</div>
			{:else}
				<div class="instructions bg-white border border-gray-200 rounded-lg p-6 mb-6">
					<div class="text-center">
						<div class="text-gray-400 text-5xl mb-4">🖼️</div>
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Select Photos for Your Game</h3>
						<p class="text-gray-600 mb-4">
							Choose 3-20 photos from your gallery below. Each photo will be a round in your custom
							geography game.
						</p>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
							<div class="flex items-center justify-center gap-2">
								<span class="text-green-600">✓</span>
								<span>Minimum 3 photos</span>
							</div>
							<div class="flex items-center justify-center gap-2">
								<span class="text-green-600">✓</span>
								<span>Maximum 20 photos</span>
							</div>
							<div class="flex items-center justify-center gap-2">
								<span class="text-green-600">✓</span>
								<span>Photos need GPS data</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Photo Gallery -->
			<UserGallery
				selectable={true}
				multiSelect={true}
				maxSelection={20}
				on:createGame={handleImageSelect}
			/>
		</div>
	</div>
{/if}

<!-- Create Game Modal -->
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
					<label for="game-name" class="block text-sm font-medium text-gray-700 mb-2">
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
					<label for="game-description" class="block text-sm font-medium text-gray-700 mb-2">
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
					<label for="game-difficulty" class="block text-sm font-medium text-gray-700 mb-2">
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
					<label for="game-tags" class="block text-sm font-medium text-gray-700 mb-2">
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
										class="tag px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1"
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
							<div
								class="preview-item aspect-square bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600"
							>
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
</style>
