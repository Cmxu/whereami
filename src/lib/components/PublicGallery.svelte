<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import type { ImageMetadata } from '$lib/types';
	import { api } from '$lib/utils/api';

	const dispatch = createEventDispatcher<{
		imageSelect: ImageMetadata;
		imagesSelect: ImageMetadata[];
		createGame: ImageMetadata[];
	}>();

	export let selectable = false;
	export let multiSelect = false;
	export let maxSelection = 20;

	let images: ImageMetadata[] = [];
	let filteredImages: ImageMetadata[] = [];
	let selectedImages: Set<string> = new Set();
	let loading = true;
	let error: string | null = null;
	let searchQuery = '';
	let sortBy: 'newest' | 'oldest' | 'name' = 'newest';

	// Pagination
	let currentPage = 1;
	let itemsPerPage = 12;
	let totalPages = 1;

	onMount(async () => {
		await loadImages();
	});

	async function loadImages() {
		try {
			loading = true;
			error = null;
			images = await api.getPublicImages();
			updateFilteredImages();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load curated public images';
		} finally {
			loading = false;
		}
	}

	function updateFilteredImages() {
		let filtered = [...images];

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(img) =>
					img.filename.toLowerCase().includes(query) ||
					img.tags?.some((tag) => tag.toLowerCase().includes(query))
			);
		}

		// Apply sorting
		filtered.sort((a, b) => {
			switch (sortBy) {
				case 'newest':
					return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
				case 'oldest':
					return new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
				case 'name':
					return a.filename.localeCompare(b.filename);
				default:
					return 0;
			}
		});

		filteredImages = filtered;
		totalPages = Math.ceil(filteredImages.length / itemsPerPage);
		currentPage = Math.min(currentPage, totalPages || 1);
	}

	function toggleImageSelection(image: ImageMetadata) {
		if (!selectable) return;

		if (selectedImages.has(image.id)) {
			selectedImages.delete(image.id);
		} else {
			if (!multiSelect) {
				selectedImages.clear();
			}
			if (selectedImages.size < maxSelection) {
				selectedImages.add(image.id);
			}
		}
		selectedImages = new Set(selectedImages);

		// Dispatch selection changes to parent
		if (multiSelect) {
			const selected = images.filter((img) => selectedImages.has(img.id));
			dispatch('imagesSelect', selected);
		}

		if (!multiSelect && selectedImages.size === 1) {
			dispatch('imageSelect', image);
		}
	}

	function selectAll() {
		const pageImages = getPaginatedImages();
		pageImages.forEach((img) => {
			if (selectedImages.size < maxSelection) {
				selectedImages.add(img.id);
			}
		});
		selectedImages = new Set(selectedImages);

		// Dispatch selection changes to parent
		if (multiSelect) {
			const selected = images.filter((img) => selectedImages.has(img.id));
			dispatch('imagesSelect', selected);
		}
	}

	export function deselectAll() {
		selectedImages.clear();
		selectedImages = new Set(selectedImages);

		// Dispatch selection changes to parent
		if (multiSelect) {
			dispatch('imagesSelect', []);
		}
	}

	function getPaginatedImages() {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return filteredImages.slice(startIndex, endIndex);
	}

	function changePage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	// Watch for changes in search and sort
	$: if (searchQuery !== undefined || sortBy !== undefined) {
		updateFilteredImages();
	}

	$: selectedCount = selectedImages.size;
	$: canCreateGame = selectedCount >= 3 && selectedCount <= 20;
</script>

<div class="public-gallery">
	<!-- Filters and Search -->
	<div
		class="gallery-filters mb-8 p-6 rounded-lg border"
		style="background-color: var(--bg-primary); border-color: var(--border-color);"
	>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
			<!-- Search -->
			<div class="search-field">
				<input
					type="text"
					placeholder="Search curated photos..."
					class="input-field h-11 w-full"
					bind:value={searchQuery}
				/>
			</div>

			<!-- Sort -->
			<div class="sort-field">
				<select class="input-field h-11 w-full" bind:value={sortBy}>
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
					<option value="name">Name A-Z</option>
				</select>
			</div>

			<!-- Batch Actions -->
			<div class="batch-actions">
				{#if selectable && multiSelect}
					<button
						class="btn-secondary w-full h-11 flex items-center justify-center"
						on:click={selectAll}
					>
						Select Page
					</button>
				{:else}
					<div class="text-center">
						<span class="text-sm text-gray-600">
							{images.length} curated public photos available
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state text-center py-12">
			<div class="loading-spinner mx-auto mb-4"></div>
			<p class="text-gray-600">Loading curated photos...</p>
		</div>
	{/if}

	<!-- Error State -->
	{#if error}
		<div class="error-state text-center py-12">
			<div class="text-red-500 text-4xl mb-4">⚠️</div>
			<h3 class="text-lg font-semibold text-gray-800 mb-2">Error Loading Curated Photos</h3>
			<p class="text-gray-600 mb-4">{error}</p>
			<button class="btn-primary" on:click={loadImages}>Try Again</button>
		</div>
	{/if}

	<!-- Empty State -->
	{#if !loading && !error && images.length === 0}
		<div class="empty-state text-center py-12">
			<div class="text-6xl mb-6">🌍</div>
			<h3 class="text-xl font-semibold text-gray-800 mb-4">No Public Photos Available</h3>
			<p class="text-gray-600 mb-6">Public photos are curated images available for everyone to use in their games.</p>
		</div>
	{/if}

	<!-- Gallery Grid -->
	{#if !loading && !error && filteredImages.length > 0}
		<div class="gallery-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
			{#each getPaginatedImages() as image}
				<div
					class="gallery-item relative bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-200"
					class:selected={selectedImages.has(image.id)}
					class:selectable
				>
					<!-- Selection Checkbox -->
					{#if selectable}
						<div class="selection-overlay absolute top-2 left-2 z-10">
							<input
								type="checkbox"
								checked={selectedImages.has(image.id)}
								on:change={(e) => {
									e.stopPropagation();
									toggleImageSelection(image);
								}}
								class="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
							/>
						</div>
					{/if}

					<!-- Image -->
					<div
						class="image-container aspect-square bg-gray-100 cursor-pointer"
						on:click={() =>
							selectable ? toggleImageSelection(image) : dispatch('imageSelect', image)}
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								if (selectable) {
									toggleImageSelection(image);
								} else {
									dispatch('imageSelect', image);
								}
							}
						}}
						role="button"
						tabindex="0"
					>
						<img
							src={image.thumbnailUrl || `/api/images/${image.id}`}
							alt={image.filename}
							class="w-full h-full object-cover"
							loading="lazy"
						/>
					</div>

					<!-- Image Info -->
					<div class="image-info p-3">
						<h4 class="font-medium text-gray-800 text-sm truncate" title={image.filename}>
							{image.filename}
						</h4>
						<div class="flex items-center justify-between mt-2">
							<div class="flex items-center text-xs text-gray-500">
								<span class="mr-1">📍</span>
								<span>{image.location.lat.toFixed(2)}, {image.location.lng.toFixed(2)}</span>
							</div>
							<div class="flex items-center gap-1">
								<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded" title="Public">
									🌍 Public
								</span>
							</div>
						</div>

						<!-- Source Info -->
						<div class="source-info mt-2">
							{#if image.sourceUrl}
								<p class="text-xs text-gray-500">
									Source: <a 
										href={image.sourceUrl} 
										target="_blank" 
										rel="noopener noreferrer"
										class="text-blue-600 hover:text-blue-800 underline"
										title="View original source"
									>
										View Source
									</a>
								</p>
							{:else}
								<p class="text-xs text-gray-500">
									Curated Public Photo
								</p>
							{/if}
						</div>
					</div>

					<!-- Selection Indicator -->
					{#if selectable && selectedImages.has(image.id)}
						<div
							class="selected-indicator absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none"
						></div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="pagination flex justify-center items-center gap-2">
				<button
					class="btn-secondary text-sm"
					disabled={currentPage === 1}
					on:click={() => changePage(currentPage - 1)}
				>
					← Previous
				</button>

				<div class="page-numbers flex gap-1">
					{#each Array(totalPages) as _, i}
						<button
							class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
							class:bg-blue-600={currentPage === i + 1}
							class:text-white={currentPage === i + 1}
							class:bg-gray-200={currentPage !== i + 1}
							class:text-gray-700={currentPage !== i + 1}
							on:click={() => changePage(i + 1)}
						>
							{i + 1}
						</button>
					{/each}
				</div>

				<button
					class="btn-secondary text-sm"
					disabled={currentPage === totalPages}
					on:click={() => changePage(currentPage + 1)}
				>
					Next →
				</button>
			</div>
		{/if}
	{/if}

	<!-- No Results -->
	{#if !loading && !error && filteredImages.length === 0 && images.length > 0}
		<div class="no-results text-center py-12">
			<div class="text-4xl mb-4">🔍</div>
			<h3 class="text-lg font-semibold text-gray-800 mb-2">No photos found</h3>
			<p class="text-gray-600">Try adjusting your search</p>
		</div>
	{/if}
</div>

<style>
	.gallery-item.selectable {
		cursor: pointer;
	}

	.gallery-item.selectable:hover {
		transform: translateY(-2px);
	}

	.gallery-item.selected {
		transform: translateY(-2px);
	}

	.selection-overlay {
		border-radius: 4px;
		padding: 2px;
	}

	.selected-indicator {
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.page-btn:hover {
		transform: scale(1.1);
	}

	@media (max-width: 640px) {
		.gallery-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.gallery-filters > div {
			grid-template-columns: 1fr;
		}

		.page-numbers {
			max-width: 200px;
			overflow-x: auto;
		}
	}
</style> 