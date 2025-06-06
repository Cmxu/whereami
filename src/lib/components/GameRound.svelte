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
	let mapExpanded = false;
	let mapComponent: any;
	let imageScale = 1;
	let imageTranslateX = 0;
	let imageTranslateY = 0;
	let isDragging = false;
	let lastMouseX = 0;
	let lastMouseY = 0;

	function handleMapClick(event: CustomEvent<Location>) {
		if (showResult) return; // Don't allow new guesses after submitting

		selectedLocation = event.detail;
	}

	function handleMapReady() {
		mapReady = true;
	}

	function handleImageLoad() {
		imageLoaded = true;
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

	function toggleMapExpanded() {
		mapExpanded = !mapExpanded;
	}

	function zoomIn() {
		imageScale = Math.min(imageScale * 1.3, 8);
	}

	function zoomOut() {
		imageScale = Math.max(imageScale / 1.3, 1);
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
		<!-- Header -->
		<div class="game-header bg-white shadow-sm p-3 flex-shrink-0">
			<div class="flex justify-between items-center max-w-6xl mx-auto">
				<div class="game-progress">
					<h2 class="text-base font-semibold text-gray-800">
						Round {$gameState.currentRound + 1} of {$gameState.rounds.length}
					</h2>
					<div class="progress-bar bg-gray-200 rounded-full h-1.5 mt-1 w-32">
						<div
							class="progress-fill bg-blue-600 h-1.5 rounded-full transition-all duration-300"
							style="width: {(($gameState.currentRound + 1) / $gameState.rounds.length) * 100}%"
						></div>
					</div>
				</div>
				<div class="game-score">
					<span class="text-xs text-gray-600">Score:</span>
					<span class="score-display text-base ml-1 font-bold"
						>{$gameState.totalScore.toLocaleString()}</span
					>
				</div>
				<button
					class="btn-secondary text-xs px-3 py-1"
					on:click={handleBackToHome}
					aria-label="Exit game and return to home"
				>
					← Exit
				</button>
			</div>
		</div>

		<!-- Main game content -->
		<div class="game-content flex-1 relative overflow-hidden">
			<!-- Image panel -->
			<div
				class="image-panel absolute inset-0 transition-all duration-500 ease-in-out"
				class:image-main={!mapExpanded}
				class:image-small={mapExpanded}
			>
				<div class="game-image-container h-full relative">
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
					<div class="game-image-viewer w-full h-full rounded-lg overflow-hidden relative">
						<!-- Zoom controls -->
						<div class="zoom-controls absolute top-2 right-2 flex flex-col gap-1 z-10">
							<button
								class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
								on:click={zoomIn}
								aria-label="Zoom in"
								disabled={imageScale >= 8}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
								</svg>
							</button>
							<button
								class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
								on:click={zoomOut}
								aria-label="Zoom out"
								disabled={imageScale <= 1}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"/>
								</svg>
							</button>
							{#if imageScale > 1}
								<button
									class="zoom-btn bg-black/50 text-white rounded p-2 hover:bg-black/70 transition-colors"
									on:click={resetZoom}
									aria-label="Reset zoom"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
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
							aria-label="Zoomable game image - double click to zoom, mouse wheel to zoom, drag to pan when zoomed"
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
									imageLoaded = true; // Show placeholder if image fails
								}}
								draggable="false"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Map panel -->
			<div
				class="map-panel absolute transition-all duration-500 ease-in-out"
				class:map-small={!mapExpanded}
				class:map-main={mapExpanded}
			>
				<div class="map-container h-full relative">
					<!-- Expand/Collapse button -->
					<button
						class="map-toggle-btn absolute top-2 right-2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-lg p-2 transition-all duration-200"
						on:click={toggleMapExpanded}
						aria-label={mapExpanded ? 'Collapse map' : 'Expand map'}
					>
						{#if mapExpanded}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
								/>
							</svg>
						{/if}
					</button>

					<Map
						bind:this={mapComponent}
						height={mapExpanded ? 'calc(100% - 100px)' : '326px'}
						forceSquare={!mapExpanded}
						clickable={!showResult}
						markers={getMapMarkers()}
						showDistanceLine={showResult}
						isLoading={!mapReady}
						on:mapClick={handleMapClick}
						on:mapReady={handleMapReady}
					/>

					<!-- Action buttons -->
					<div class="map-actions mt-2">
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
							<div class="result-panel card">
								<div class="text-center mb-4">
									<div class="result-score">
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
									<div class="distance-display text-sm text-gray-700">
										Distance: <strong>{guessResult.formattedDistance}</strong>
									</div>
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
							<div class="result-loading text-center py-4">
								<div class="loading-spinner mx-auto mb-2"></div>
								<p class="text-gray-500 text-xs">Processing...</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
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

	.game-header {
		flex-shrink: 0;
	}

	.game-content {
		flex: 1;
		min-height: 0; /* Important for flex child to shrink properly */
		position: relative;
		overflow: hidden;
	}

	.progress-fill {
		transition: width 0.3s ease;
	}

	/* New layout styles */
	.image-main {
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 1rem;
		z-index: 1;
	}

	.image-small {
		bottom: 1rem;
		left: 1rem;
		width: 300px;
		height: 200px;
		padding: 0.5rem;
		z-index: 3;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(8px);
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.map-small {
		bottom: 1rem;
		right: 1rem;
		width: auto; /* Let it size to content */
		height: auto; /* Let it size to content */
		padding: 0.75rem;
		z-index: 2;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(8px);
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
	}

	.map-main {
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 1rem;
		z-index: 2;
	}

	.image-panel,
	.map-panel {
		display: flex;
		flex-direction: column;
	}

	.map-container {
		display: flex;
		flex-direction: column;
		height: 100%; /* Ensure full height utilization */
	}

	.map-actions {
		flex-shrink: 0; /* Prevent action buttons from shrinking */
		margin-top: 0.5rem; /* Further reduced spacing */
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
		/* Mobile: revert to stacked layout */
		.game-content {
			flex-direction: column;
			position: relative;
		}

		.image-panel,
		.map-panel {
			position: relative !important;
			width: 100% !important;
			flex: 1 !important;
			min-height: 0 !important;
			padding: 0.5rem !important;
			margin: 0 !important;
			border-radius: 0 !important;
			background: transparent !important;
			backdrop-filter: none !important;
			box-shadow: none !important;
			z-index: auto !important;
		}

		.image-main,
		.image-small {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			right: auto !important;
			bottom: auto !important;
			width: 100% !important;
			height: 100% !important;
		}

		.map-small,
		.map-main {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			right: auto !important;
			bottom: auto !important;
			width: 100% !important;
			height: 100% !important;
		}

		.map-toggle-btn {
			display: none !important;
		}

		.game-header {
			padding: 1rem 0.5rem;
		}

		.game-header .flex {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.game-progress {
			text-align: center;
		}

		.progress-bar {
			width: 100%;
		}
	}

	@media (max-width: 640px) {
		.image-panel,
		.map-panel {
			padding: 0.5rem;
		}

		.game-image-container {
			min-height: 200px;
			/* Remove max-height constraint to allow flexibility */
		}
		
		.map-container {
			min-height: 200px;
		}

		.result-panel {
			padding: 1rem;
		}

		.score-display {
			font-size: 2rem;
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
</style>
