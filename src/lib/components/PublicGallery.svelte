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
	let selectedImages: Set<string> = new Set();
	let loading = true;
	let error: string | null = null;
	let searchQuery = '';
	let sortBy: 'newest' | 'oldest' | 'name' = 'newest';

	// Server-side pagination
	let currentPage = 1;
	let itemsPerPage = 24; // Show more images per page
	let totalImages = 0;
	let totalPages = 1;

	// Calculate pagination range (always show 5 pages centered around current)
	$: startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
	$: endPage = Math.min(totalPages, startPage + 4);

	onMount(async () => {
		await loadImages();
	});

	async function loadImages() {
		try {
			loading = true;
			error = null;
			
			const offset = (currentPage - 1) * itemsPerPage;
			const result = await api.getCuratedImages(itemsPerPage, offset);
			
			images = result.images;
			totalImages = result.total;
			totalPages = Math.ceil(totalImages / itemsPerPage);
		} catch (err) {
			console.error('Failed to load curated images:', err);
			error = err instanceof Error ? err.message : 'Failed to load curated images';
			images = []; // Ensure images is always an array
		} finally {
			loading = false;
		}
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
		images.forEach((img) => {
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

	function changePage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
		loadImages();
	}

	// Note: Search and sort are not yet implemented server-side for curated images
	// In a full implementation, you'd pass these as parameters to the API
	$: if (searchQuery !== undefined || sortBy !== undefined) {
		// Placeholder for future server-side search/sort implementation
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
					disabled
					title="Search functionality coming soon"
				/>
			</div>

			<!-- Sort -->
			<div class="sort-field">
				<select class="input-field h-11 w-full" bind:value={sortBy} disabled title="Sorting functionality coming soon">
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
							{totalImages} curated photos available
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
			<h3 class="text-xl font-semibold text-gray-800 mb-4">No Curated Photos Available</h3>
			<p class="text-gray-600 mb-6">Curated photos are hand-picked landmark images available for everyone to use in their games.</p>
		</div>
	{/if}

	<!-- Gallery Grid -->
	{#if !loading && !error && images.length > 0}
		<div class="gallery-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
			{#each images as image}
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
			<div class="pagination-container mb-6">
				<div class="pagination-info text-center mb-4">
					<span class="text-sm text-gray-600">
						Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalImages)} of {totalImages} curated photos
					</span>
				</div>
				
				<div class="pagination relative flex justify-center items-center">
					<!-- Centered: All navigation buttons and page numbers -->
					<div class="flex items-center gap-2">
						<!-- First Page Button -->
						<button
							class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
							class:bg-blue-600={false}
							class:text-white={false}
							class:bg-gray-200={true}
							class:text-gray-700={true}
							disabled={currentPage === 1}
							on:click={() => changePage(1)}
							title="First page"
						>
							&lt;&lt;
						</button>

						<!-- Previous Button -->
						<button
							class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
							class:bg-blue-600={false}
							class:text-white={false}
							class:bg-gray-200={true}
							class:text-gray-700={true}
							disabled={currentPage === 1}
							on:click={() => changePage(currentPage - 1)}
							title="Previous page"
						>
							&lt;
						</button>

						<!-- Page Numbers -->
						{#each Array(endPage - startPage + 1) as _, i}
							{@const pageNum = startPage + i}
							<button
								class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
								class:bg-blue-600={currentPage === pageNum}
								class:text-white={currentPage === pageNum}
								class:bg-gray-200={currentPage !== pageNum}
								class:text-gray-700={currentPage !== pageNum}
								on:click={() => changePage(pageNum)}
							>
								{pageNum}
							</button>
						{/each}

						<!-- Next Button -->
						<button
							class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
							class:bg-blue-600={false}
							class:text-white={false}
							class:bg-gray-200={true}
							class:text-gray-700={true}
							disabled={currentPage === totalPages}
							on:click={() => changePage(currentPage + 1)}
							title="Next page"
						>
							&gt;
						</button>

						<!-- Last Page Button -->
						<button
							class="page-btn w-8 h-8 text-sm rounded-lg transition-colors duration-200"
							class:bg-blue-600={false}
							class:text-white={false}
							class:bg-gray-200={true}
							class:text-gray-700={true}
							disabled={currentPage === totalPages}
							on:click={() => changePage(totalPages)}
							title="Last page"
						>
							&gt;&gt;
						</button>
					</div>

					<!-- Absolutely positioned: Go to input -->
					<div class="absolute right-0 direct-page-input flex items-center gap-2">
						<span class="text-sm text-gray-600">Go to:</span>
						<input
							type="number"
							min="1"
							max={totalPages}
							value={currentPage}
							class="w-16 h-8 text-sm border border-gray-300 rounded px-2 text-center"
							on:keydown={(e) => {
								if (e.key === 'Enter') {
									const value = parseInt((e.target as HTMLInputElement).value);
									if (value >= 1 && value <= totalPages) {
										changePage(value);
									}
								}
							}}
							on:change={(e) => {
								const value = parseInt((e.target as HTMLInputElement).value);
								if (value >= 1 && value <= totalPages) {
									changePage(value);
								}
							}}
						/>
						<span class="text-sm text-gray-600">of {totalPages}</span>
					</div>
				</div>
			</div>
		{/if}
	{/if}

	<!-- No Results (this case shouldn't occur with proper pagination) -->
	{#if !loading && !error && images.length === 0 && totalImages > 0}
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