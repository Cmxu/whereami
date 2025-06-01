<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { gameState, getGameSummary } from '$lib/stores/gameStore';
	import { getPerformanceRating } from '$lib/utils/gameLogic';

	const dispatch = createEventDispatcher<{
		playAgain: void;
		backToHome: void;
	}>();

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
					<div class="round-item flex items-center justify-between p-4 bg-gray-50 rounded-lg">
						<div class="round-info flex items-center gap-4">
							<div
								class="round-number bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold"
							>
								{index + 1}
							</div>
							<div class="round-details">
								<div class="font-medium text-gray-800">Round {index + 1}</div>
								{#if round.formattedDistance}
									<div class="text-sm text-gray-600">Distance: {round.formattedDistance}</div>
								{/if}
							</div>
						</div>
						<div class="round-score">
							<div class="score-display text-lg">{round.score}</div>
							<div class="text-xs text-gray-500">points</div>
						</div>
					</div>
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

	.results-actions button {
		min-width: 140px;
	}
</style>
