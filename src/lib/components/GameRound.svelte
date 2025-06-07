<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Map from './Map.svelte';
	import { currentRound, gameState, submitGuess, proceedToNextRound } from '$lib/stores/gameStore';
	import type { Location, GuessResult } from '$lib/types';

	const dispatch = createEventDispatcher<{
		gameComplete: void;
		backToHome: void;
	}>();

	let selectedLocation: Location | null = null;
	let guessResult: GuessResult | null = null;
	let showResult = false;
	let mapReady = false;
	let imageLoaded = false;
	let lastRoundId: number | null = null;
	let showMapFull = false; // Toggle between image-full and map-full layouts
	let mapComponent: any;
	let imageScale = 1;
	let imageTranslateX = 0;
	let imageTranslateY = 0;
	let isDragging = false;
	let lastMouseX = 0;
	let lastMouseY = 0;
	// Small map resize functionality
	let smallMapSize = { width: 450, height: 400 };
	let isResizing = false;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartSize = { width: 0, height: 0 };
	let resizeCurrentSize = { width: 0, height: 0 };
	// Small image resize functionality
	let smallImageSize = { width: 400, height: 300 }; // Will be updated based on actual image dimensions
	let isResizingImage = false;
	let imageResizeStartX = 0;
	let imageResizeStartY = 0;
	let imageResizeStartSize = { width: 0, height: 0 };
	let imageResizeCurrentSize = { width: 0, height: 0 };
	// Map state preservation
	let savedMapCenter: Location | null = null;
	let savedMapZoom: number | null = null;

	function handleMapClick(event: CustomEvent<Location>) {
		if (showResult) return; // Don't allow new guesses after submitting

		selectedLocation = event.detail;
	}

	function handleMapReady() {
		mapReady = true;
	}

	function handleImageLoad() {
		imageLoaded = true;
		updateImageOverlaySize();
	}

	function updateImageOverlaySize() {
		// Update small image overlay size based on actual image dimensions
		setTimeout(() => {
			const imageElement = document.querySelector('.small-overlay-image') as HTMLImageElement;
			if (imageElement && imageElement.naturalWidth > 0) {
				const aspectRatio = imageElement.naturalHeight / imageElement.naturalWidth;
				const targetWidth = 400; // Base width
				const targetHeight = targetWidth * aspectRatio;
				
				// Constrain to reasonable bounds
				const finalWidth = Math.min(600, Math.max(300, targetWidth));
				const finalHeight = Math.min(450, Math.max(200, targetHeight));
				
				smallImageSize = { width: finalWidth, height: finalHeight };
			}
		}, 100);
	}

	function handleSubmitGuess() {
		if (!selectedLocation) return;

		guessResult = submitGuess(selectedLocation);
		showResult = true;
	}

	function handleNextRound() {
		if (guessResult?.isLastRound) {
			dispatch('gameComplete');
		} else {
			proceedToNextRound();
			// State resets are handled by the reactive statement when the round changes
		}
	}

	function handleBackToHome() {
		dispatch('backToHome');
	}

	function toggleLayout() {
		// Save current map state before switching
		if (mapComponent && mapComponent.getCurrentView) {
			const currentView = mapComponent.getCurrentView();
			if (currentView) {
				savedMapCenter = currentView.center;
				savedMapZoom = currentView.zoom;
			}
		}

		showMapFull = !showMapFull;

		// Reset any resize state when switching layouts
		isResizing = false;
		resizeCurrentSize = { ...smallMapSize };
		isResizingImage = false;
		imageResizeCurrentSize = { ...smallImageSize };

		// Trigger map re-rendering and restore state after transition
		setTimeout(() => {
			if (mapComponent && mapComponent.invalidateSize) {
				mapComponent.invalidateSize();
			}
			
			// Restore saved map state after a brief delay to ensure map is ready
			setTimeout(() => {
				if (mapComponent && savedMapCenter && savedMapZoom !== null) {
					if (mapComponent.setView) {
						mapComponent.setView(savedMapCenter, savedMapZoom);
					}
				}
			}, 100);
		}, 300);
	}

	// Resize functionality for small map
	function handleResizeStart(event: MouseEvent) {
		if (showMapFull) return; // Only allow resize when map is small

		event.preventDefault();
		event.stopPropagation();
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartSize = { ...smallMapSize };
		resizeCurrentSize = { ...smallMapSize };

		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
	}

	function handleResizeMove(event: MouseEvent) {
		if (!isResizing) return;

		const deltaX = event.clientX - resizeStartX;
		const deltaY = event.clientY - resizeStartY;

		// For top-left resize handle (inverted deltas)
		resizeCurrentSize.width = Math.max(250, Math.min(1200, resizeStartSize.width - deltaX));
		resizeCurrentSize.height = Math.max(250, Math.min(600, resizeStartSize.height - deltaY));

		if (mapComponent && mapComponent.invalidateSize) {
			mapComponent.invalidateSize();
		}
	}

	function handleResizeEnd() {
		isResizing = false;

		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeEnd);

		smallMapSize = { ...resizeCurrentSize };

		setTimeout(() => {
			if (mapComponent && mapComponent.invalidateSize) {
				mapComponent.invalidateSize();
			}
		}, 100);
	}

	// Resize functionality for small image
	function handleImageResizeStart(event: MouseEvent) {
		if (!showMapFull) return; // Only allow resize when image is small (map is full)

		event.preventDefault();
		event.stopPropagation();
		isResizingImage = true;
		imageResizeStartX = event.clientX;
		imageResizeStartY = event.clientY;
		imageResizeStartSize = { ...smallImageSize };
		imageResizeCurrentSize = { ...smallImageSize };

		document.addEventListener('mousemove', handleImageResizeMove);
		document.addEventListener('mouseup', handleImageResizeEnd);
	}

	function handleImageResizeMove(event: MouseEvent) {
		if (!isResizingImage) return;

		const deltaX = event.clientX - imageResizeStartX;
		const deltaY = event.clientY - imageResizeStartY;

		// For top-right resize handle (normal deltaX, inverted deltaY)
		const newWidth = Math.max(250, Math.min(800, imageResizeStartSize.width + deltaX));
		
		// Maintain aspect ratio based on actual image
		let aspectRatio = imageResizeStartSize.height / imageResizeStartSize.width;
		const newHeight = newWidth * aspectRatio;

		imageResizeCurrentSize.width = newWidth;
		imageResizeCurrentSize.height = Math.max(150, Math.min(600, newHeight));
	}

	function handleImageResizeEnd() {
		isResizingImage = false;

		document.removeEventListener('mousemove', handleImageResizeMove);
		document.removeEventListener('mouseup', handleImageResizeEnd);

		smallImageSize = { ...imageResizeCurrentSize };
	}

	function zoomIn() {
		imageScale = Math.min(imageScale * 1.2, 8);
	}

	function zoomOut() {
		imageScale = Math.max(imageScale / 1.2, 1);
		if (imageScale === 1) {
			imageTranslateX = 0;
			imageTranslateY = 0;
		}
	}

	function resetZoom() {
		imageScale = 1;
		imageTranslateX = 0;
		imageTranslateY = 0;
	}

	function fitToWidth() {
		// Reset position to center
		imageTranslateX = 0;
		imageTranslateY = 0;

		// Use a timeout to ensure DOM is ready and image is loaded
		setTimeout(() => {
			const imageElement = document.querySelector('.game-image') as HTMLImageElement;
			const container = document.querySelector('.image-viewport') as HTMLElement;

			if (imageElement && container && imageElement.naturalWidth > 0) {
				const containerWidth = container.clientWidth;
				const containerHeight = container.clientHeight;
				const imageWidth = imageElement.naturalWidth;
				const imageHeight = imageElement.naturalHeight;

				console.log('Container:', containerWidth, 'x', containerHeight);
				console.log('Image:', imageWidth, 'x', imageHeight);

				// Calculate the current object-contain rendered size
				const imageAspectRatio = imageWidth / imageHeight;
				const containerAspectRatio = containerWidth / containerHeight;

				let renderedWidth, renderedHeight;
				if (imageAspectRatio > containerAspectRatio) {
					// Image is wider than container - it's constrained by width
					renderedWidth = containerWidth;
					renderedHeight = containerWidth / imageAspectRatio;
				} else {
					// Image is taller than container - it's constrained by height
					renderedWidth = containerHeight * imageAspectRatio;
					renderedHeight = containerHeight;
				}

				console.log('Rendered size:', renderedWidth, 'x', renderedHeight);

				// Calculate scale to make the rendered image fill the container width
				const targetScale = containerWidth / renderedWidth;
				imageScale = Math.max(1, targetScale);

				console.log('Target scale:', targetScale, 'Final scale:', imageScale);
			} else {
				console.log('Elements not found or image not loaded');
				imageScale = 1;
			}
		}, 50);
	}

	function handleImageWheel(event: WheelEvent) {
		event.preventDefault();
		if (event.deltaY < 0) {
			zoomIn();
		} else {
			zoomOut();
		}
	}

	function handleImageMouseDown(event: MouseEvent) {
		if (imageScale > 1) {
			isDragging = true;
			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
		}
	}

	function handleImageMouseMove(event: MouseEvent) {
		if (isDragging && imageScale > 1) {
			const deltaX = event.clientX - lastMouseX;
			const deltaY = event.clientY - lastMouseY;
			imageTranslateX += deltaX;
			imageTranslateY += deltaY;
			lastMouseX = event.clientX;
			lastMouseY = event.clientY;
		}
	}

	function handleImageMouseUp() {
		isDragging = false;
	}

	function handleImageClick() {
		// If image is fully zoomed out (scale 1), zoom in on first click
		if (imageScale === 1) {
			zoomIn();
		}
	}

	function handleImageDoubleClick() {
		if (imageScale === 1) {
			zoomIn();
		} else {
			resetZoom();
		}
	}

	function getMapMarkers() {
		if (!showResult || !guessResult) {
			return selectedLocation
				? [
						{
							location: selectedLocation,
							popup: 'Your guess',
							type: 'guess' as const
						}
					]
				: [];
		}

		return [
			{
				location: guessResult.userGuess,
				popup: `Your guess<br/><strong>${guessResult.formattedDistance} away</strong><br/>Score: ${guessResult.score}`,
				type: 'guess' as const
			},
			{
				location: $currentRound!.image.location,
				popup: 'Actual location',
				type: 'actual' as const
			}
		];
	}

	// Reset state when round changes (only when round ID changes, not when round data updates)
	$: if ($currentRound && $currentRound.id !== lastRoundId) {
		selectedLocation = null;
		guessResult = null;
		showResult = false;
		imageLoaded = false;
		// Reset image zoom
		imageScale = 1;
		imageTranslateX = 0;
		imageTranslateY = 0;
		isDragging = false;
		// Reset saved map state for new round
		savedMapCenter = null;
		savedMapZoom = null;
		// Don't reset mapReady - the map doesn't need to be reinitialized between rounds
		lastRoundId = $currentRound.id;
		// Reset map view to initial position
		if (mapComponent) {
			mapComponent.resetMapView();
		}
	}

	// Accessibility: Add keyboard support
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && selectedLocation && !showResult) {
			handleSubmitGuess();
		}
		if (event.key === 'Escape' && selectedLocation && !showResult) {
			selectedLocation = null;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if $currentRound}
	<div class="game-round h-full flex flex-col overflow-hidden">
		<!-- Main game content -->
		<div class="game-content flex-1 relative overflow-hidden">
			<!-- Game Info Bar - Centered Top -->
			<div class="game-info-bar absolute top-6 left-1/2 transform -translate-x-1/2 z-50">
				<div class="flex items-center space-x-6">
					<!-- Round Progress -->
					<div class="flex items-center space-x-2">
						<span class="text-sm font-semibold text-gray-800">
							Round {$gameState.currentRound + 1}/{$gameState.rounds.length}
						</span>
						<div class="progress-bar bg-gray-200 rounded-full h-1.5 w-16">
							<div
								class="progress-fill bg-blue-600 h-1.5 rounded-full transition-all duration-300"
								style="width: {($gameState.currentRound / $gameState.rounds.length) * 100}%"
							></div>
						</div>
					</div>

					<!-- Score -->
					<div class="flex items-center space-x-2">
						<span class="text-sm text-gray-800">Score:</span>
						<span class="score-display text-lg font-bold text-gray-800">
							{$gameState.totalScore.toLocaleString()}
						</span>
					</div>

					<!-- Layout Toggle Button -->
					<button
						class="btn-secondary text-xs px-3 py-1 flex items-center space-x-1"
						on:click={toggleLayout}
						aria-label={showMapFull ? 'Show large image' : 'Show large map'}
					>
						{#if showMapFull}
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
								/>
							</svg>
							<span>Image</span>
						{:else}
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
								/>
							</svg>
							<span>Map</span>
						{/if}
					</button>

					<!-- Exit Button -->
					<button
						class="btn-secondary text-xs px-3 py-1"
						on:click={handleBackToHome}
						aria-label="Exit game and return to home"
					>
						← Exit
					</button>
				</div>
			</div>

			{#if showMapFull}
				<!-- Map-focused layout: Large map with small image overlay -->
				<div class="layout-map-full absolute inset-0">
					<!-- Full-size map -->
					<div class="map-container h-full relative z-10">
						<Map
							bind:this={mapComponent}
							height="calc(100vh)"
							forceSquare={false}
							clickable={!showResult}
							markers={getMapMarkers()}
							showDistanceLine={showResult}
							isLoading={!mapReady}
							on:mapClick={handleMapClick}
							on:mapReady={handleMapReady}
						/>

						<!-- Action buttons for map view -->
						<div class="action-buttons absolute bottom-4 right-4 z-50">
							{#if !showResult}
								<div class="flex gap-2">
									<button
										class="btn-primary px-4 py-2 transition-all duration-200"
										class:pulse={selectedLocation}
										disabled={!selectedLocation}
										on:click={handleSubmitGuess}
										aria-label="Submit your guess"
									>
										{selectedLocation ? 'Submit Guess' : 'Select Location'}
									</button>
									{#if selectedLocation}
										<button
											class="btn-secondary px-3 py-2"
											on:click={() => (selectedLocation = null)}
											aria-label="Clear your current guess"
										>
											Clear
										</button>
									{/if}
								</div>
							{:else if guessResult}
								<div
									class="result-panel bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm"
								>
									<div class="text-center mb-4">
										<div class="score-display text-2xl font-bold mb-2 text-blue-600">
											{guessResult.score.toLocaleString()}
										</div>
										<div
											class="score-badge inline-block px-2 py-1 rounded-full text-xs font-medium mb-2"
											class:bg-green-100={guessResult.score >= 8000}
											class:text-green-800={guessResult.score >= 8000}
											class:bg-yellow-100={guessResult.score >= 5000 && guessResult.score < 8000}
											class:text-yellow-800={guessResult.score >= 5000 && guessResult.score < 8000}
											class:bg-orange-100={guessResult.score >= 2000 && guessResult.score < 5000}
											class:text-orange-800={guessResult.score >= 2000 && guessResult.score < 5000}
											class:bg-red-100={guessResult.score < 2000}
											class:text-red-800={guessResult.score < 2000}
										>
											{guessResult.score >= 8000
												? 'Excellent!'
												: guessResult.score >= 5000
													? 'Great!'
													: guessResult.score >= 2000
														? 'Good'
														: 'Keep trying!'}
										</div>
									</div>
									<div class="distance-display text-sm text-gray-700 mb-4">
										Distance: <strong>{guessResult.formattedDistance}</strong>
									</div>
									<button
										class="btn-primary w-full text-sm py-2"
										on:click={handleNextRound}
										aria-label={guessResult.isLastRound
											? 'View final results'
											: 'Continue to next round'}
									>
										{guessResult.isLastRound ? '🏆 View Results' : '➡️ Next Round'}
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Small image overlay -->
					<div
						class="image-overlay absolute bottom-4 left-4 z-50 bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-3 transition-all duration-300"
						class:resizing={isResizingImage}
						style="width: {isResizingImage
							? imageResizeCurrentSize.width
							: smallImageSize.width}px; height: {isResizingImage
							? imageResizeCurrentSize.height
							: smallImageSize.height}px;"
					>
						<!-- Resize handle (top-right corner) -->
						<div
							class="resize-handle absolute top-0 right-0 w-4 h-4 bg-white/60 hover:bg-white/80 cursor-ne-resize z-20 rounded-bl-md border border-white/40"
							role="button"
							tabindex="0"
							on:mousedown={handleImageResizeStart}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									const aspectRatio = smallImageSize.height / smallImageSize.width;
									const newWidth = Math.min(800, smallImageSize.width + 50);
									const newHeight = newWidth * aspectRatio;
									smallImageSize.width = newWidth;
									smallImageSize.height = Math.min(600, newHeight);
								}
							}}
							aria-label="Drag to resize image or press Enter to increase size"
						>
							<svg
								class="w-3 h-3 text-gray-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
								/>
							</svg>
						</div>

						<div class="image-overlay-content relative">
							{#if !imageLoaded}
								<div
									class="image-loading flex items-center justify-center bg-gray-100 rounded-lg"
									style="height: {(isResizingImage
										? imageResizeCurrentSize.height
										: smallImageSize.height) - 24}px;"
								>
									<div class="text-center">
										<div class="loading-spinner mx-auto mb-2"></div>
										<p class="text-gray-500 text-xs">Loading...</p>
									</div>
								</div>
							{/if}

							<!-- Zoom controls for small image -->
							<div class="zoom-controls absolute top-2 right-2 flex flex-col gap-1 z-10">
								<button
									class="zoom-btn bg-black/50 text-white rounded p-1 hover:bg-black/70 transition-colors"
									on:click={zoomIn}
									aria-label="Zoom in"
									disabled={imageScale >= 8}
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</button>
								<button
									class="zoom-btn bg-black/50 text-white rounded p-1 hover:bg-black/70 transition-colors"
									on:click={zoomOut}
									aria-label="Zoom out"
									disabled={imageScale <= 1}
								>
									<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M18 12H6"
										/>
									</svg>
								</button>
								{#if imageScale > 1}
									<button
										class="zoom-btn bg-black/50 text-white rounded p-1 hover:bg-black/70 transition-colors"
										on:click={resetZoom}
										aria-label="Reset zoom"
									>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/>
										</svg>
									</button>
								{/if}
							</div>

							<div
								class="image-viewport w-full overflow-hidden rounded-md"
								style="height: {(isResizingImage
									? imageResizeCurrentSize.height
									: smallImageSize.height) - 24}px;"
								class:cursor-zoom-in={imageScale === 1}
								class:cursor-move={imageScale > 1}
								role="button"
								tabindex="0"
								aria-label="Zoomable game image"
								on:click={handleImageClick}
								on:keydown={(e) => e.key === 'Enter' && handleImageClick()}
								on:wheel={handleImageWheel}
								on:mousedown={handleImageMouseDown}
								on:mousemove={handleImageMouseMove}
								on:mouseup={handleImageMouseUp}
								on:mouseleave={handleImageMouseUp}
								on:dblclick={handleImageDoubleClick}
							>
								<img
									src={$currentRound.image.src}
									alt="Round {$gameState.currentRound + 1} photo"
									class="small-overlay-image w-full h-full object-cover transition-opacity duration-300 select-none"
									class:opacity-0={!imageLoaded}
									style="transform: scale({imageScale}) translate({imageTranslateX}px, {imageTranslateY}px); transform-origin: center center;"
									loading="lazy"
									on:load={handleImageLoad}
									on:error={() => {
										console.warn('Failed to load image:', $currentRound.image.src);
										imageLoaded = true;
									}}
									draggable="false"
								/>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Image-focused layout: Large image with small map overlay -->
				<div class="layout-image-full absolute inset-0 p-4">
					<!-- Full-size image -->
					<div class="image-container h-full relative">
						{#if !imageLoaded}
							<div
								class="image-loading absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg"
							>
								<div class="text-center">
									<div class="loading-spinner mx-auto mb-3"></div>
									<p class="text-gray-500 text-sm">Loading image...</p>
								</div>
							</div>
						{/if}

						<div class="image-viewer w-full h-full rounded-lg overflow-hidden relative">
							<!-- Zoom controls -->
							<div class="zoom-controls absolute top-4 right-4 flex flex-col gap-2 z-10">
								<button
									class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
									on:click={zoomIn}
									aria-label="Zoom in"
									disabled={imageScale >= 8}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</button>
								<button
									class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
									on:click={zoomOut}
									aria-label="Zoom out"
									disabled={imageScale <= 1}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M18 12H6"
										/>
									</svg>
								</button>
								<button
									class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
									on:click={fitToWidth}
									aria-label="Fit to width"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 8h16M4 16h16"
										/>
									</svg>
								</button>
								{#if imageScale > 1}
									<button
										class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
										on:click={resetZoom}
										aria-label="Reset zoom"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/>
										</svg>
									</button>
								{/if}
							</div>

							<div
								class="image-viewport w-full h-full"
								class:cursor-zoom-in={imageScale === 1}
								class:cursor-move={imageScale > 1}
								role="button"
								tabindex="0"
								aria-label="Zoomable game image - click to zoom, mouse wheel to zoom, drag to pan when zoomed"
								on:click={handleImageClick}
								on:keydown={(e) => e.key === 'Enter' && handleImageClick()}
								on:wheel={handleImageWheel}
								on:mousedown={handleImageMouseDown}
								on:mousemove={handleImageMouseMove}
								on:mouseup={handleImageMouseUp}
								on:mouseleave={handleImageMouseUp}
								on:dblclick={handleImageDoubleClick}
							>
								<img
									src={$currentRound.image.src}
									alt="Location to guess - Round {$gameState.currentRound + 1}"
									class="game-image w-full h-full object-contain transition-opacity duration-300 select-none"
									class:opacity-0={!imageLoaded}
									style="transform: scale({imageScale}) translate({imageTranslateX}px, {imageTranslateY}px); transform-origin: center center;"
									loading="lazy"
									on:load={handleImageLoad}
									on:error={() => {
										console.warn('Failed to load image:', $currentRound.image.src);
										imageLoaded = true;
									}}
									draggable="false"
								/>
							</div>
						</div>
					</div>

					<!-- Small map overlay -->
					<div
						class="map-overlay absolute bottom-4 right-4 z-40 bg-white/10 backdrop-blur-md rounded-lg shadow-xl border border-white/20 p-3 transition-all duration-300 flex flex-col"
						class:resizing={isResizing}
						style="width: {isResizing
							? resizeCurrentSize.width
							: smallMapSize.width}px; height: {isResizing
							? resizeCurrentSize.height
							: smallMapSize.height}px;"
					>
						<!-- Resize handle (top-left corner) -->
						<div
							class="resize-handle absolute top-0 left-0 w-4 h-4 bg-white/60 hover:bg-white/80 cursor-nw-resize z-20 rounded-br-md border border-white/40"
							role="button"
							tabindex="0"
							on:mousedown={handleResizeStart}
							on:keydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									smallMapSize.width = Math.min(1200, smallMapSize.width + 50);
									smallMapSize.height = Math.min(600, smallMapSize.height + 50);
									setTimeout(() => {
										if (mapComponent && mapComponent.invalidateSize) {
											mapComponent.invalidateSize();
										}
									}, 100);
								}
							}}
							aria-label="Drag to resize map or press Enter to increase size"
						>
							<svg
								class="w-3 h-3 text-gray-600"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
								/>
							</svg>
						</div>

						<div class="map-container flex-1 relative">
							<Map
								bind:this={mapComponent}
								height="{(isResizing ? resizeCurrentSize.height : smallMapSize.height) - 80}px"
								forceSquare={false}
								clickable={!showResult}
								markers={getMapMarkers()}
								showDistanceLine={showResult}
								isLoading={!mapReady}
								on:mapClick={handleMapClick}
								on:mapReady={handleMapReady}
							/>
						</div>

						<!-- Action buttons for image view -->
						<div class="action-buttons mt-2 flex-shrink-0">
							{#if !showResult}
								<div class="flex gap-2">
									<button
										class="btn-primary flex-1 transition-all duration-200 text-sm"
										class:pulse={selectedLocation}
										disabled={!selectedLocation}
										on:click={handleSubmitGuess}
										aria-label="Submit your guess"
									>
										{selectedLocation ? 'Submit' : 'Select Location'}
									</button>
									{#if selectedLocation}
										<button
											class="btn-secondary text-sm"
											on:click={() => (selectedLocation = null)}
											aria-label="Clear your current guess"
										>
											Clear
										</button>
									{/if}
								</div>
							{:else if guessResult}
								<div class="result-panel">
									<div class="text-center mb-3">
										<div class="score-display text-xl font-bold mb-1 text-blue-600">
											{guessResult.score.toLocaleString()}
										</div>
										<div
											class="score-badge inline-block px-2 py-1 rounded-full text-xs font-medium mb-2"
											class:bg-green-100={guessResult.score >= 8000}
											class:text-green-800={guessResult.score >= 8000}
											class:bg-yellow-100={guessResult.score >= 5000 && guessResult.score < 8000}
											class:text-yellow-800={guessResult.score >= 5000 && guessResult.score < 8000}
											class:bg-orange-100={guessResult.score >= 2000 && guessResult.score < 5000}
											class:text-orange-800={guessResult.score >= 2000 && guessResult.score < 5000}
											class:bg-red-100={guessResult.score < 2000}
											class:text-red-800={guessResult.score < 2000}
										>
											{guessResult.score >= 8000
												? 'Excellent!'
												: guessResult.score >= 5000
													? 'Great!'
													: guessResult.score >= 2000
														? 'Good'
														: 'Keep trying!'}
										</div>
									</div>
									<div class="distance-display text-xs text-gray-700 mb-3 text-center">
										Distance: <strong>{guessResult.formattedDistance}</strong>
									</div>
									<button
										class="btn-primary w-full text-sm py-2"
										on:click={handleNextRound}
										aria-label={guessResult.isLastRound
											? 'View final results'
											: 'Continue to next round'}
									>
										{guessResult.isLastRound ? '🏆 View Results' : '➡️ Next Round'}
									</button>
								</div>
							{:else}
								<!-- Loading state for results -->
								<div class="result-loading text-center py-2">
									<div class="loading-spinner mx-auto mb-1"></div>
									<p class="text-gray-500 text-xs">Processing...</p>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<div class="card text-center max-w-md">
			<h2 class="text-xl font-semibold text-gray-800 mb-4">Loading round...</h2>
			<div class="loading-spinner mx-auto mb-4"></div>
			<p class="text-gray-600 text-sm">Preparing your geography challenge</p>
		</div>
	</div>
{/if}

<style>
	.game-round {
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.game-content {
		flex: 1;
		min-height: 0; /* Important for flex child to shrink properly */
		position: relative;
		overflow: hidden;
	}

	.game-info-bar {
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.15);
		backdrop-filter: blur(12px);
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		white-space: nowrap;
		border: 1px solid rgba(255, 255, 255, 0.2);
		z-index: 100; /* Ensure it's always on top */
	}

	.progress-fill {
		transition: width 0.3s ease;
	}

	/* Simple dual layout styles */
	.layout-image-full {
		z-index: 1;
		transition: opacity 0.3s ease-in-out;
	}

	.layout-map-full {
		z-index: 1;
		transition: opacity 0.3s ease-in-out;
	}

	.image-overlay,
	.map-overlay {
		animation: slideInUp 0.3s ease-out;
	}

	.map-overlay.resizing {
		transition: none !important;
	}

	.image-overlay.resizing {
		transition: none !important;
		will-change: width, height;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.image-overlay {
		will-change: auto;
		transform: translateZ(0);
		backface-visibility: hidden;
	}

	.resize-handle {
		transition: all 0.2s ease;
		user-select: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.resize-handle:hover {
		background: rgba(255, 255, 255, 0.9) !important;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		transform: scale(1.1);
	}

	.resize-handle:active {
		transform: scale(0.95);
	}

	.result-panel {
		animation: slideUp 0.4s ease-out;
	}

	.pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	.image-loading {
		border-radius: 8px;
	}

	.game-image {
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		transition: transform 0.1s ease;
		object-fit: contain !important;
	}

	.zoom-controls {
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	.zoom-controls:hover {
		opacity: 1;
	}

	.zoom-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.image-viewport {
		overflow: hidden;
		background-color: #1f2937; /* Dark gray background for letterboxing */
	}

	.cursor-zoom-in {
		cursor: zoom-in;
	}

	.cursor-move {
		cursor: move;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 1024px) {
		/* Mobile: stack image and map vertically */
		.layout-image-full,
		.layout-map-full {
			flex-direction: column !important;
		}

		.image-overlay,
		.map-overlay {
			position: relative !important;
			bottom: auto !important;
			left: auto !important;
			right: auto !important;
			width: 100% !important;
			height: auto !important;
			margin: 0.5rem !important;
			max-width: none !important;
		}

		.game-info-bar {
			top: 1.5rem;
			left: 50%;
			transform: translateX(-50%);
			padding: 0.5rem 0.75rem;
			font-size: 0.875rem;
			max-width: calc(100vw - 2rem);
			white-space: normal;
		}

		.game-info-bar .flex {
			flex-direction: column;
			gap: 0.25rem;
			align-items: center;
		}

		.game-info-bar .score-display {
			font-size: 0.875rem;
		}
	}

	@media (max-width: 640px) {
		.image-container,
		.map-container {
			min-height: 200px;
		}

		.result-panel {
			padding: 1rem;
		}

		.score-display {
			font-size: 1.5rem;
		}

		.game-info-bar {
			top: 1.5rem;
			left: 50%;
			transform: translateX(-50%);
			padding: 0.5rem 0.75rem;
			max-width: calc(100vw - 2rem);
			white-space: normal;
		}

		.game-info-bar .flex {
			flex-direction: column;
			gap: 0.25rem;
			align-items: center;
		}

		.game-info-bar .score-display {
			font-size: 0.875rem;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.game-image {
			border: 2px solid currentColor;
		}

		.btn-primary,
		.btn-secondary {
			border: 2px solid currentColor;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.result-panel,
		.pulse,
		.progress-fill,
		.game-image {
			animation: none;
			transition: none;
		}
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
