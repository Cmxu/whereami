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
		// Always call proceedToNextRound - it handles both advancing rounds and game completion
		proceedToNextRound();
		// State resets are handled by the reactive statement when the round changes
	}

	function handleBackToHome() {
		dispatch('backToHome');
	}

	function toggleMapExpanded() {
		mapExpanded = !mapExpanded;
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
		// Don't reset mapReady - the map doesn't need to be reinitialized between rounds
		lastRoundId = $currentRound.id;
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
	<div class="game-round game-container">
		<!-- Header -->
		<div class="game-header bg-white shadow-sm p-4">
			<div class="flex justify-between items-center max-w-6xl mx-auto">
				<div class="game-progress">
					<h2 class="text-lg font-semibold text-gray-800">
						Round {$gameState.currentRound + 1} of {$gameState.rounds.length}
					</h2>
					<div class="progress-bar bg-gray-200 rounded-full h-2 mt-2 w-48">
						<div
							class="progress-fill bg-blue-600 h-2 rounded-full transition-all duration-300"
							style="width: {(($gameState.currentRound + 1) / $gameState.rounds.length) * 100}%"
						></div>
					</div>
				</div>
				<div class="game-score">
					<span class="text-sm text-gray-600">Total Score:</span>
					<span class="score-display text-lg ml-2 font-bold"
						>{$gameState.totalScore.toLocaleString()}</span
					>
				</div>
				<button
					class="btn-secondary text-sm"
					on:click={handleBackToHome}
					aria-label="Exit game and return to home"
				>
					← Exit Game
				</button>
			</div>
		</div>

		<!-- Main game content -->
		<div class="game-content flex-1 relative">
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
					<button
						class="game-image-button w-full h-full rounded-lg overflow-hidden"
						on:click={() => {
							const img = document.querySelector('.game-image');
							if (img) {
								(img as any).requestFullscreen?.() || 
								(img as any).webkitRequestFullscreen?.() || 
								(img as any).mozRequestFullScreen?.() || 
								(img as any).msRequestFullscreen?.();
							}
						}}
						aria-label="Click to zoom image fullscreen"
					>
						<img
							src={$currentRound.image.src}
							alt="Location to guess - Round {$gameState.currentRound + 1}"
							class="game-image w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
							class:opacity-0={!imageLoaded}
							loading="lazy"
							on:load={handleImageLoad}
							on:error={() => {
								console.warn('Failed to load image:', $currentRound.image.src);
								imageLoaded = true; // Show placeholder if image fails
							}}
						/>
					</button>
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

					<div class="map-header mb-4">
						<h3 class="text-lg font-semibold text-gray-800">
							{showResult ? 'Results' : 'Click on the map to make your guess'}
						</h3>
						{#if selectedLocation && !showResult}
							<p class="text-sm text-gray-600 mt-1">
								Selected: {selectedLocation.lat.toFixed(4)}°, {selectedLocation.lng.toFixed(4)}°
							</p>
						{/if}
					</div>

					<Map
						height={mapExpanded ? 'calc(100% - 160px)' : 'calc(100% - 120px)'}
						clickable={!showResult}
						markers={getMapMarkers()}
						showDistanceLine={showResult}
						isLoading={!mapReady}
						on:mapClick={handleMapClick}
						on:mapReady={handleMapReady}
					/>

					<!-- Action buttons -->
					<div class="map-actions mt-4">
						{#if !showResult}
							<div class="flex gap-2">
								<button
									class="btn-primary flex-1 transition-all duration-200 text-sm"
									class:pulse={selectedLocation}
									disabled={!selectedLocation}
									on:click={handleSubmitGuess}
									aria-label={selectedLocation
										? 'Submit your guess'
										: 'Click on the map to make a guess first'}
								>
									{selectedLocation ? 'Submit' : 'Click to guess'}
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

		<!-- Mobile optimization notice -->
		<div
			class="mobile-hint lg:hidden fixed bottom-4 left-4 right-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 z-10"
		>
			<span class="font-medium">📱 Mobile tip:</span> Pinch to zoom on the map for better precision
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
		width: 350px;
		height: 250px;
		padding: 0.75rem;
		z-index: 2;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.95);
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
	}

	.mobile-hint {
		animation: fadeInUp 0.5s ease-out;
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
			height: auto !important;
			padding: 1rem !important;
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
			height: auto !important;
		}

		.map-small,
		.map-main {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			right: auto !important;
			bottom: auto !important;
			width: 100% !important;
			height: auto !important;
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

		.game-image-container,
		.map-container {
			min-height: 300px;
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
		.mobile-hint,
		.pulse,
		.progress-fill,
		.game-image {
			animation: none;
			transition: none;
		}
	}
</style>
