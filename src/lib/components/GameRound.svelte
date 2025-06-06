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
		<div class="game-content flex-1 flex flex-col lg:flex-row">
			<!-- Image panel -->
			<div class="image-panel lg:w-1/2 p-4">
				<div class="game-image-container h-full min-h-[400px] relative">
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
					<img
						src={$currentRound.image.src}
						alt="Location to guess - Round {$gameState.currentRound + 1}"
						class="game-image w-full h-full object-cover rounded-lg transition-opacity duration-300"
						class:opacity-0={!imageLoaded}
						loading="lazy"
						on:load={handleImageLoad}
						on:error={() => {
							console.warn('Failed to load image:', $currentRound.image.src);
							imageLoaded = true; // Show placeholder if image fails
						}}
					/>
				</div>
			</div>

			<!-- Map panel -->
			<div class="map-panel lg:w-1/2 p-4">
				<div class="map-container h-full min-h-[400px]">
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
						height="calc(100% - 160px)"
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
							<div class="flex gap-4">
								<button
									class="btn-primary flex-1 transition-all duration-200"
									class:pulse={selectedLocation}
									disabled={!selectedLocation}
									on:click={handleSubmitGuess}
									aria-label={selectedLocation
										? 'Submit your guess'
										: 'Click on the map to make a guess first'}
								>
									{selectedLocation ? 'Submit Guess' : 'Click on map to guess'}
								</button>
								{#if selectedLocation}
									<button
										class="btn-secondary"
										on:click={() => (selectedLocation = null)}
										aria-label="Clear your current guess"
									>
										Clear
									</button>
								{/if}
							</div>
							<div class="help-text text-xs text-gray-500 mt-2 text-center">
								💡 Tip: Look for landmarks, architecture, and landscape clues
							</div>
						{:else if guessResult}
							<div class="result-panel card">
								<div class="text-center mb-4">
									<div class="result-score">
										<div class="score-display text-3xl font-bold mb-2 text-blue-600">
											{guessResult.score.toLocaleString()}
										</div>
										<div
											class="score-badge inline-block px-3 py-1 rounded-full text-sm font-medium mb-3"
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
									<div class="distance-display text-lg text-gray-700">
										Distance: <strong>{guessResult.formattedDistance}</strong>
									</div>
								</div>
								<button
									class="btn-primary w-full text-lg py-3"
									on:click={handleNextRound}
									aria-label={guessResult.isLastRound
										? 'View final results'
										: 'Continue to next round'}
								>
									{guessResult.isLastRound ? '🏆 View Final Results' : '➡️ Next Round'}
								</button>
							</div>
						{:else}
							<!-- Loading state for results -->
							<div class="result-loading text-center py-8">
								<div class="loading-spinner mx-auto mb-3"></div>
								<p class="text-gray-500 text-sm">Processing your guess...</p>
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
		.game-content {
			flex-direction: column;
		}

		.image-panel,
		.map-panel {
			width: 100%;
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
