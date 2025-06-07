<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { gameState, getGameSummary } from '$lib/stores/gameStore';
	import { getPerformanceRating } from '$lib/utils/gameLogic';
	import Map from './Map.svelte';
	import type { Location } from '$lib/types';

	const dispatch = createEventDispatcher<{
		playAgain: void;
		backToHome: void;
	}>();

	let reviewModalOpen = false;
	let selectedRound: any = null;
	let imageScale = 1;
	let imageTranslateX = 0;
	let imageTranslateY = 0;
	let isDragging = false;
	let lastMouseX = 0;
	let lastMouseY = 0;

	function handlePlayAgain() {
		dispatch('playAgain');
	}

	function handleBackToHome() {
		dispatch('backToHome');
	}

	function handleShare() {
		const summary = getGameSummary();
		const shareText = `I just scored ${summary.totalScore} out of ${summary.maxPossible} points in WhereAmI! Can you beat my score?`;

		if (navigator.share) {
			navigator.share({
				title: 'WhereAmI Game Results',
				text: shareText,
				url: window.location.origin
			});
		} else {
			// Fallback: copy to clipboard
			navigator.clipboard.writeText(`${shareText} ${window.location.origin}`);
			alert('Results copied to clipboard!');
		}
	}

	function openReviewModal(round: any, index: number) {
		selectedRound = { ...round, roundNumber: index + 1 };
		reviewModalOpen = true;
	}

	function closeReviewModal() {
		reviewModalOpen = false;
		selectedRound = null;
		// Reset zoom when closing modal
		imageScale = 1;
		imageTranslateX = 0;
		imageTranslateY = 0;
		isDragging = false;
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
			const imageElement = document.querySelector('.modal-content img') as HTMLImageElement;
			const container = document.querySelector('.modal-content .image-viewport') as HTMLElement;

			if (imageElement && container && imageElement.naturalWidth > 0) {
				const containerWidth = container.clientWidth;
				const containerHeight = container.clientHeight;
				const imageWidth = imageElement.naturalWidth;
				const imageHeight = imageElement.naturalHeight;

				console.log('Modal Container:', containerWidth, 'x', containerHeight);
				console.log('Modal Image:', imageWidth, 'x', imageHeight);

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

				console.log('Modal Rendered size:', renderedWidth, 'x', renderedHeight);

				// Calculate scale to make the rendered image fill the container width
				const targetScale = containerWidth / renderedWidth;
				imageScale = Math.max(1, targetScale);

				console.log('Modal Target scale:', targetScale, 'Final scale:', imageScale);
			} else {
				console.log('Modal elements not found or image not loaded');
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

	function handleImageDoubleClick() {
		if (imageScale === 1) {
			zoomIn();
		} else {
			resetZoom();
		}
	}

	function getReviewMarkers() {
		if (!selectedRound || !selectedRound.userGuess) return [];

		return [
			{
				location: selectedRound.userGuess,
				popup: `Your guess<br/><strong>${selectedRound.formattedDistance}${selectedRound.formattedDistanceUnit} away</strong><br/>Score: ${selectedRound.score}`,
				type: 'guess' as const
			},
			{
				location: selectedRound.image.location,
				popup: 'Actual location',
				type: 'actual' as const
			}
		];
	}

	$: maxPossible = $gameState.rounds.length * 10000;
	$: performanceRating = getPerformanceRating($gameState.totalScore, maxPossible);
	$: percentage = Math.round(($gameState.totalScore / maxPossible) * 100);
</script>

<div class="game-results min-h-screen flex items-center justify-center p-4">
	<div class="results-container max-w-4xl w-full">
		<!-- Header -->
		<div class="results-header text-center mb-8">
			<div class="celebration-icon text-6xl mb-4">
				{#if percentage >= 90}
					🏆
				{:else if percentage >= 75}
					🎉
				{:else if percentage >= 60}
					👏
				{:else}
					🎯
				{/if}
			</div>
			<h1 class="text-4xl font-bold text-gray-800 mb-2">Game Complete!</h1>
			<p class="text-xl text-gray-600">{performanceRating}</p>
		</div>

		<!-- Score summary -->
		<div class="score-summary card mb-8">
			<div class="grid md:grid-cols-3 gap-6 text-center">
				<div class="score-stat">
					<div class="score-display text-4xl mb-2">{$gameState.totalScore}</div>
					<div class="text-gray-600">Total Score</div>
				</div>
				<div class="score-stat">
					<div class="text-4xl font-bold text-blue-600 mb-2">{percentage}%</div>
					<div class="text-gray-600">Accuracy</div>
				</div>
				<div class="score-stat">
					<div class="text-4xl font-bold text-purple-600 mb-2">{$gameState.rounds.length}</div>
					<div class="text-gray-600">Rounds Played</div>
				</div>
			</div>
		</div>

		<!-- Round breakdown -->
		<div class="rounds-breakdown card mb-8">
			<h2 class="text-2xl font-bold text-gray-800 mb-6">Round Breakdown</h2>
			<div class="rounds-list space-y-4">
				{#each $gameState.rounds as round, index}
					<button
						class="round-item w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg text-left cursor-pointer hover:bg-blue-50 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
						on:click={() => openReviewModal(round, index)}
						aria-label="Review round {index + 1} details"
					>
						<div class="round-info flex items-center gap-4">
							<div
								class="round-number bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold"
							>
								{index + 1}
							</div>
							<div class="round-details">
								<div class="font-medium text-gray-800">Round {index + 1}</div>
								{#if round.formattedDistance}
									<div class="text-sm text-gray-600">Distance: {round.formattedDistance}{round.formattedDistanceUnit}</div>
								{/if}
							</div>
						</div>
						<div class="round-score flex items-center gap-2">
							<div>
								<div class="score-display text-lg">{round.score}</div>
								<div class="text-xs text-gray-500">points</div>
							</div>
							<svg
								class="w-5 h-5 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Actions -->
		<div class="results-actions flex flex-col sm:flex-row gap-4 justify-center">
			<button class="btn-primary" on:click={handlePlayAgain}> 🎮 Play Again </button>
			<button class="btn-secondary" on:click={handleShare}> 📤 Share Results </button>
			<button class="btn-secondary" on:click={handleBackToHome}> 🏠 Back to Home </button>
		</div>

		<!-- Performance tips -->
		<div class="performance-tips card mt-8">
			<h3 class="text-lg font-semibold text-gray-800 mb-4">💡 Tips for Better Scores</h3>
			<ul class="text-gray-600 space-y-2">
				<li>• Look for architectural styles and building designs</li>
				<li>• Pay attention to vegetation and landscape features</li>
				<li>• Notice road signs, license plates, and text in images</li>
				<li>• Consider the lighting and shadows for time of day clues</li>
				<li>• Look for distinctive landmarks or geographical features</li>
			</ul>
		</div>
	</div>
</div>

<!-- Review Modal -->
{#if reviewModalOpen && selectedRound}
	<div
		class="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		on:click={closeReviewModal}
		on:keydown={(e) => e.key === 'Escape' && closeReviewModal()}
		role="button"
		tabindex="0"
	>
		<div
			class="modal-content bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden"
			on:click|stopPropagation
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			tabindex="-1"
		>
			<!-- Modal Header -->
			<div class="modal-header flex items-center justify-between p-4 border-b">
				<h2 id="modal-title" class="text-xl font-bold text-gray-800">
					Round {selectedRound.roundNumber} Review
				</h2>
				<button
					class="text-gray-400 hover:text-gray-600 transition-colors"
					on:click={closeReviewModal}
					aria-label="Close modal"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Modal Body -->
			<div class="modal-body p-4 overflow-y-auto">
				<div class="grid lg:grid-cols-2 gap-6">
					<!-- Image Panel -->
					<div class="image-panel">
						<h3 class="text-lg font-semibold text-gray-800 mb-3">📷 Photo</h3>
						<div class="image-container bg-gray-100 rounded-lg overflow-hidden relative">
							<!-- Zoom controls -->
							<div class="zoom-controls absolute top-2 right-2 flex flex-col gap-1 z-10">
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
								class="image-viewport w-full h-80"
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
									src={selectedRound.image.src}
									alt="Round {selectedRound.roundNumber} location"
									class="w-full h-full object-contain transition-opacity duration-300 select-none"
									style="transform: scale({imageScale}) translate({imageTranslateX}px, {imageTranslateY}px); transform-origin: center center;"
									draggable="false"
								/>
							</div>
						</div>
					</div>

					<!-- Map Panel -->
					<div class="map-panel">
						<h3 class="text-lg font-semibold text-gray-800 mb-3">🗺️ Map</h3>
						<div class="map-container h-80 rounded-lg overflow-hidden">
							<Map
								height="320px"
								clickable={false}
								markers={getReviewMarkers()}
								showDistanceLine={true}
								isLoading={false}
							/>
						</div>
					</div>
				</div>

				<!-- Score Summary -->
				<div class="score-summary mt-6 p-4 bg-gray-50 rounded-lg">
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
						<div class="stat">
							<div class="text-2xl font-bold text-blue-600">{selectedRound.score}</div>
							<div class="text-sm text-gray-600">Points Scored</div>
						</div>
						<div class="stat">
							<div class="text-2xl font-bold text-orange-600">
								{selectedRound.formattedDistance || 'N/A'}{selectedRound.formattedDistanceUnit || ''}
							</div>
							<div class="text-sm text-gray-600">Distance Off</div>
						</div>
						<div class="stat">
							<div class="text-2xl font-bold text-purple-600">
								{Math.round((selectedRound.score / 10000) * 100)}%
							</div>
							<div class="text-sm text-gray-600">Accuracy</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.game-results {
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
	}

	.celebration-icon {
		animation: bounce 2s infinite;
	}

	@keyframes bounce {
		0%,
		20%,
		50%,
		80%,
		100% {
			transform: translateY(0);
		}
		40% {
			transform: translateY(-10px);
		}
		60% {
			transform: translateY(-5px);
		}
	}

	.score-stat {
		transition: transform 0.2s ease;
	}

	.score-stat:hover {
		transform: translateY(-2px);
	}

	.round-item {
		transition: all 0.2s ease;
	}

	.round-item:hover {
		background-color: #e5e7eb;
		transform: translateX(4px);
	}

	.modal-overlay {
		animation: fadeIn 0.2s ease-out;
	}

	.modal-content {
		animation: slideInUp 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
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

	.results-actions button {
		min-width: 140px;
	}
</style>
