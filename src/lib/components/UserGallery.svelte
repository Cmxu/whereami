<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import Map from './Map.svelte';
	import type { Location, ImageMetadata } from '$lib/types';
	import { api } from '$lib/utils/api';

	const dispatch = createEventDispatcher<{
		imageSelect: ImageMetadata;
		imagesSelect: ImageMetadata[];
		createGame: ImageMetadata[];
		switchToUpload: void;
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
	let filterBy: 'all' | 'public' | 'private' = 'all';
	let showLocationMap = false;
	let selectedImageForLocation: ImageMetadata | null = null;
	let editingLocation: Location | null = null;

	// Image name editing state
	let showNameEditor = false;
	let selectedImageForNameEdit: ImageMetadata | null = null;
	let editingName = '';

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
			images = await api.getUserImages();
			updateFilteredImages();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load images';
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

		// Apply visibility filter
		if (filterBy !== 'all') {
			filtered = filtered.filter((img) => (filterBy === 'public' ? img.isPublic : !img.isPublic));
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
	}

	function deselectAll() {
		selectedImages.clear();
		selectedImages = new Set(selectedImages);
	}

	function getPaginatedImages() {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return filteredImages.slice(startIndex, endIndex);
	}

	function changePage(page: number) {
		currentPage = Math.max(1, Math.min(page, totalPages));
	}

	async function deleteImage(image: ImageMetadata) {
		if (!confirm(`Are you sure you want to delete "${image.filename}"?`)) {
			return;
		}

		try {
			await api.deleteImage(image.id);
			images = images.filter((img) => img.id !== image.id);
			selectedImages.delete(image.id);
			selectedImages = new Set(selectedImages);
			updateFilteredImages();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete image';
		}
	}

	async function updateImageLocation(image: ImageMetadata, location: Location) {
		try {
			await api.updateImageLocation(image.id, location);

			// Update local data
			const imageIndex = images.findIndex((img) => img.id === image.id);
			if (imageIndex !== -1) {
				images[imageIndex].location = location;
				images = [...images];
				updateFilteredImages();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update location';
		}
	}

	async function updateImageName(image: ImageMetadata, newName: string) {
		try {
			const updatedImage = await api.updateImage(image.id, { filename: newName });

			// Update local data
			const imageIndex = images.findIndex((img) => img.id === image.id);
			if (imageIndex !== -1) {
				images[imageIndex] = { ...images[imageIndex], ...updatedImage };
				images = [...images];
				updateFilteredImages();
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update image name';
			throw err;
		}
	}

	function editImageLocation(image: ImageMetadata) {
		selectedImageForLocation = image;
		editingLocation = { ...image.location };
		showLocationMap = true;
	}

	function editImageName(image: ImageMetadata) {
		selectedImageForNameEdit = image;
		editingName = image.filename;
		showNameEditor = true;
	}

	function handleMapClick(event: CustomEvent<Location>) {
		editingLocation = event.detail;
	}

	async function saveLocationEdit() {
		if (selectedImageForLocation && editingLocation) {
			await updateImageLocation(selectedImageForLocation, editingLocation);
			showLocationMap = false;
			selectedImageForLocation = null;
		}
	}

	async function saveNameEdit() {
		if (selectedImageForNameEdit && editingName.trim()) {
			try {
				await updateImageName(selectedImageForNameEdit, editingName.trim());
				showNameEditor = false;
				selectedImageForNameEdit = null;
				editingName = '';
			} catch (err) {
				// Error handling is done in updateImageName function
			}
		}
	}

	function cancelLocationEdit() {
		showLocationMap = false;
		selectedImageForLocation = null;
		editingLocation = null;
	}

	function cancelNameEdit() {
		showNameEditor = false;
		selectedImageForNameEdit = null;
		editingName = '';
	}

	function createGameFromSelected() {
		const selected = images.filter((img) => selectedImages.has(img.id));
		dispatch('createGame', selected);
	}

	// Reactive updates
	$: updateFilteredImages(), searchQuery, sortBy, filterBy;
	$: selectedCount = selectedImages.size;
	$: canCreateGame = selectedCount >= 3 && selectedCount <= 20;
</script>

<div class="user-gallery">
	<!-- Gallery Header -->
	<div class="gallery-header mb-6">
		<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
			<div>
				<h2 class="text-2xl font-bold text-gray-800">Your Photo Gallery</h2>
				<p class="text-gray-600">{images.length} photos uploaded</p>
			</div>

			{#if selectable && multiSelect && selectedCount > 0}
				<div class="selection-actions flex gap-2">
					<span class="text-sm text-gray-600 self-center">{selectedCount} selected</span>
					<button class="btn-secondary text-sm" on:click={deselectAll}>Clear</button>
					{#if canCreateGame}
						<button class="btn-primary text-sm" on:click={createGameFromSelected}>
							Create Game ({selectedCount})
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Filters and Search -->
	<div
		class="gallery-filters mb-6 p-4 rounded-lg border"
		style="background-color: var(--bg-primary); border-color: var(--border-color);"
	>
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
			<!-- Search -->
			<div class="search-field">
				<input
					type="text"
					placeholder="Search photos..."
					class="input-field h-11"
					bind:value={searchQuery}
				/>
			</div>

			<!-- Sort -->
			<div class="sort-field">
				<select class="input-field h-11" bind:value={sortBy}>
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
					<option value="name">Name A-Z</option>
				</select>
			</div>

			<!-- Filter -->
			<div class="filter-field">
				<select class="input-field h-11" bind:value={filterBy}>
					<option value="all">All Photos</option>
					<option value="public">Public Only</option>
					<option value="private">Private Only</option>
				</select>
			</div>

			<!-- Batch Actions -->
			<div class="batch-actions">
				{#if selectable && multiSelect}
					<button class="btn-secondary w-full text-sm h-11" on:click={selectAll}>
						Select Page
					</button>
				{:else}
					<button
						class="btn-primary w-full text-sm h-11 flex items-center justify-center gap-2"
						on:click={() => dispatch('switchToUpload')}
					>
						⬆️ Upload
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="loading-state text-center py-12">
			<div class="loading-spinner mx-auto mb-4"></div>
			<p class="text-gray-600">Loading your photos...</p>
		</div>
	{/if}

	<!-- Error State -->
	{#if error}
		<div class="error-state text-center py-12">
			<div class="text-red-500 text-4xl mb-4">⚠️</div>
			<h3 class="text-lg font-semibold text-gray-800 mb-2">Error Loading Photos</h3>
			<p class="text-gray-600 mb-4">{error}</p>
			<button class="btn-primary" on:click={loadImages}>Try Again</button>
		</div>
	{/if}

	<!-- Empty State -->
	{#if !loading && !error && images.length === 0}
		<div class="empty-state text-center py-12">
			<div class="text-6xl mb-6">📸</div>
			<h3 class="text-xl font-semibold text-gray-800 mb-4">No Photos Yet</h3>
			<p class="text-gray-600 mb-6">Upload your first photos to start creating custom games</p>
			<button class="btn-primary" on:click={() => dispatch('switchToUpload')}>
				Upload Photos
			</button>
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
								{#if image.isPublic}
									<span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded" title="Public"
										>🌐</span
									>
								{:else}
									<span class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded" title="Private"
										>🔒</span
									>
								{/if}
							</div>
						</div>

						<!-- Action Buttons -->
						<div class="action-buttons mt-3 space-y-2">
							<div class="flex gap-2">
								<button
									class="btn-secondary text-xs flex-1"
									on:click={(e) => {
										e.stopPropagation();
										editImageName(image);
									}}
								>
									✏️ Edit Name
								</button>
								<button
									class="btn-secondary text-xs flex-1"
									on:click={(e) => {
										e.stopPropagation();
										editImageLocation(image);
									}}
								>
									📍 Edit Location
								</button>
							</div>
							<button
								class="w-full text-red-500 hover:text-red-700 text-xs py-1 hover:bg-red-50 rounded transition-colors"
								on:click={(e) => {
									e.stopPropagation();
									deleteImage(image);
								}}
								title="Delete photo"
							>
								🗑️ Delete Photo
							</button>
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
			<p class="text-gray-600">Try adjusting your search or filters</p>
		</div>
	{/if}
</div>

<!-- Location Editor Modal -->
{#if showLocationMap && selectedImageForLocation}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
			<div class="modal-header p-4 border-b">
				<h3 class="text-lg font-semibold text-gray-800">Edit Photo Location</h3>
				<p class="text-sm text-gray-600">
					Click on the map to update the location for "{selectedImageForLocation.filename}"
				</p>
			</div>
			<div class="modal-content p-4">
				<div class="location-editor-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Photo Preview -->
					<div class="photo-section">
						<div class="photo-preview-large">
							<img
								src={selectedImageForLocation.thumbnailUrl ||
									`/api/images/${selectedImageForLocation.id}`}
								alt={selectedImageForLocation.filename}
								class="w-full h-64 object-cover rounded-lg"
							/>
							<div class="mt-4">
								<h4 class="font-medium text-gray-800">{selectedImageForLocation.filename}</h4>
								{#if editingLocation}
									<p class="text-sm text-gray-600 mt-1">
										New Location: {editingLocation.lat.toFixed(6)}, {editingLocation.lng.toFixed(6)}
									</p>
								{/if}
							</div>
						</div>
					</div>

					<!-- Map -->
					<div class="map-section">
						<Map
							height="300px"
							center={editingLocation || selectedImageForLocation.location}
							zoom={10}
							clickable={true}
							markers={editingLocation
								? [{ location: editingLocation, popup: 'New location' }]
								: []}
							on:mapClick={handleMapClick}
						/>
					</div>
				</div>
			</div>
			<div class="modal-footer p-4 border-t flex justify-end gap-3">
				<button class="btn-secondary" on:click={cancelLocationEdit}>Cancel</button>
				<button class="btn-primary" disabled={!editingLocation} on:click={saveLocationEdit}>
					Update Location
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Image Name Editor Modal -->
{#if showNameEditor && selectedImageForNameEdit}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
			<div class="modal-header p-4 border-b">
				<h3 class="text-lg font-semibold text-gray-800">Edit Image Name</h3>
				<p class="text-sm text-gray-600">
					Enter a new name for "{selectedImageForNameEdit.filename}"
				</p>
			</div>
			<div class="modal-content p-4">
				<div class="name-editor-grid grid grid-cols-1 gap-6">
					<!-- Image Preview -->
					<div class="image-preview">
						<img
							src={selectedImageForNameEdit.thumbnailUrl ||
								`/api/images/${selectedImageForNameEdit.id}`}
							alt={selectedImageForNameEdit.filename}
							class="w-full h-64 object-cover rounded-lg"
						/>
					</div>

					<!-- Name Input -->
					<div class="name-input">
						<input
							type="text"
							placeholder="Enter new name..."
							class="input-field h-11"
							bind:value={editingName}
						/>
					</div>
				</div>
			</div>
			<div class="modal-footer p-4 border-t flex justify-end gap-3">
				<button class="btn-secondary" on:click={cancelNameEdit}>Cancel</button>
				<button class="btn-primary" disabled={!editingName.trim()} on:click={saveNameEdit}>
					Update Name
				</button>
			</div>
		</div>
	</div>
{/if}

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
		background: rgba(0, 0, 0, 0.5);
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
