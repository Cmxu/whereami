<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { GameSettings } from '$lib/types';
	import { hasSavedGameInProgress, resumeSavedGame } from '$lib/stores/gameStore';
	import {
		getGameStatistics,
		getUserPreferences,
		type UserPreferences
	} from '$lib/utils/localStorage';

	const dispatch = createEventDispatcher<{
		startGame: GameSettings;
		resumeGame: void;
	}>();

	let showStatistics = false;
	let statistics = getGameStatistics();
	let preferences: UserPreferences = getUserPreferences();

	function startQuickGame() {
		dispatch('startGame', {
			numRounds: preferences.defaultRounds,
			gameMode: preferences.defaultGameMode
		});
	}

	function startFullGame() {
		dispatch('startGame', {
			numRounds: 10,
			gameMode: 'random'
		});
	}

	function startCustomGame(rounds: number) {
		dispatch('startGame', {
			numRounds: rounds,
			gameMode: 'random'
		});
	}

	function handleResumeGame() {
		const success = resumeSavedGame();
		if (success) {
			dispatch('resumeGame');
		}
	}

	function toggleStatistics() {
		showStatistics = !showStatistics;
		if (showStatistics) {
			statistics = getGameStatistics();
		}
	}

	onMount(() => {
		// Refresh statistics and preferences on mount
		statistics = getGameStatistics();
		preferences = getUserPreferences();
	});
</script>

<div class="welcome-screen min-h-screen flex items-center justify-center p-4">
	<div class="welcome-content max-w-4xl w-full text-center fade-in">
		<!-- Logo and title -->
		<div class="logo-container mb-8 md:mb-12">
			<h1 class="game-logo text-5xl md:text-8xl font-bold text-white mb-4">WhereAmI</h1>
			<p class="tagline text-lg md:text-2xl text-white/90 max-w-2xl mx-auto">
				Test your skills by locating where photos were taken. Can you guess where in the world these
				images are from?
			</p>
		</div>

		<!-- Resume game notification -->
		{#if $hasSavedGameInProgress}
			<div
				class="resume-notification mb-8 bg-yellow-500 text-yellow-900 p-4 rounded-lg mx-auto max-w-md"
			>
				<div class="flex items-center justify-center mb-2">
					<span class="text-2xl mr-2">⏱️</span>
					<span class="font-semibold">Game in Progress</span>
				</div>
				<p class="text-sm mb-3">You have an unfinished game. Pick up where you left off!</p>
				<button
					class="resume-button w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
					on:click={handleResumeGame}
				>
					Resume Game
				</button>
			</div>
		{/if}

		<!-- Game options -->
		<div class="game-options mb-8 md:mb-12">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-2xl mx-auto">
				<!-- Quick Game Button -->
				<button
					class="option-button group bg-white/95 backdrop-blur rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
					on:click={startQuickGame}
				>
					<div class="option-icon text-3xl md:text-4xl mb-3 md:mb-4">🚀</div>
					<div class="option-text">
						<h3 class="option-title text-lg md:text-xl font-bold text-gray-800 mb-2">Quick Game</h3>
						<p class="rounds-info text-sm md:text-base text-gray-600">
							{preferences.defaultRounds} rounds • ~5 minutes
						</p>
					</div>
				</button>

				<!-- Full Game Button -->
				<button
					class="option-button group bg-white/95 backdrop-blur rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
					on:click={startFullGame}
				>
					<div class="option-icon text-3xl md:text-4xl mb-3 md:mb-4">🌍</div>
					<div class="option-text">
						<h3 class="option-title text-lg md:text-xl font-bold text-gray-800 mb-2">Full Game</h3>
						<p class="rounds-info text-sm md:text-base text-gray-600">10 rounds • ~15 minutes</p>
					</div>
				</button>
			</div>

			<!-- Custom round options -->
			<div class="custom-options mt-6">
				<p class="text-white/80 text-sm mb-3">Or choose your rounds:</p>
				<div class="flex justify-center gap-2 flex-wrap">
					{#each [5, 15, 20] as roundCount}
						<button
							class="custom-round-btn bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1 rounded-full transition-all duration-200"
							on:click={() => startCustomGame(roundCount)}
						>
							{roundCount} rounds
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Statistics panel -->
		{#if statistics.totalGames > 0}
			<div class="statistics-section mb-6">
				<button
					class="stats-toggle bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-all duration-200 text-sm"
					on:click={toggleStatistics}
				>
					📊 {showStatistics ? 'Hide' : 'Show'} Your Stats
				</button>

				{#if showStatistics}
					<div class="stats-panel bg-white/95 backdrop-blur rounded-lg p-4 mt-4 max-w-md mx-auto">
						<h3 class="font-bold text-gray-800 mb-3">Your Performance</h3>
						<div class="grid grid-cols-2 gap-4 text-sm">
							<div class="stat-item text-center">
								<div class="stat-value text-lg font-bold text-blue-600">
									{statistics.totalGames}
								</div>
								<div class="stat-label text-gray-600">Games Played</div>
							</div>
							<div class="stat-item text-center">
								<div class="stat-value text-lg font-bold text-green-600">
									{statistics.averageScore.toLocaleString()}
								</div>
								<div class="stat-label text-gray-600">Avg Score</div>
							</div>
							<div class="stat-item text-center">
								<div class="stat-value text-lg font-bold text-purple-600">
									{statistics.bestScore.toLocaleString()}
								</div>
								<div class="stat-label text-gray-600">Best Score</div>
							</div>
							<div class="stat-item text-center">
								<div class="stat-value text-lg font-bold text-orange-600">
									{statistics.averageAccuracy}%
								</div>
								<div class="stat-label text-gray-600">Accuracy</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Additional options -->
		<div class="additional-options mb-6 md:mb-8">
			<p class="text-white/70 mb-4 text-sm md:text-base">More ways to play:</p>
			<div class="flex flex-wrap justify-center gap-3 md:gap-4">
				<a
					href="/upload"
					class="option-link bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
				>
					📸 Upload Photos
				</a>
				<a
					href="/create"
					class="option-link bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
				>
					🎯 Create Game
				</a>
				<a
					href="/browse"
					class="option-link bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm"
				>
					🔍 Browse Games
				</a>
			</div>
		</div>

		<!-- Footer -->
		<div class="welcome-footer text-white/60 text-xs md:text-sm">
			<p>WhereAmI V2.0 - Created by Calvin</p>
		</div>
	</div>
</div>

<style>
	.welcome-screen {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		position: relative;
		overflow: hidden;
	}

	.welcome-screen::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background:
			linear-gradient(45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
			linear-gradient(-45deg, rgba(255, 255, 255, 0.1) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%),
			linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.1) 75%);
		background-size: 60px 60px;
		background-position:
			0 0,
			0 30px,
			30px -30px,
			-30px 0px;
		opacity: 0.3;
		animation: slidePattern 20s linear infinite;
	}

	@keyframes slidePattern {
		0% {
			transform: translateX(0);
		}
		100% {
			transform: translateX(60px);
		}
	}

	.welcome-content {
		position: relative;
		z-index: 1;
	}

	.game-logo {
		text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.option-button {
		border: 2px solid transparent;
		transition: all 0.3s ease;
	}

	.option-button:hover {
		border-color: rgba(59, 130, 246, 0.3);
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(20px);
	}

	.option-icon {
		transition: transform 0.3s ease;
	}

	.option-button:hover .option-icon {
		transform: scale(1.1);
	}

	.resume-notification {
		animation: slideInDown 0.5s ease-out;
	}

	.stats-panel {
		animation: slideInUp 0.3s ease-out;
	}

	@keyframes slideInDown {
		from {
			opacity: 0;
			transform: translateY(-20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
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

	.custom-round-btn:hover {
		transform: scale(1.05);
	}

	.option-link {
		text-decoration: none;
		backdrop-filter: blur(10px);
	}

	.option-link:hover {
		transform: translateY(-2px);
	}

	.fade-in {
		animation: fadeIn 0.8s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.welcome-screen {
			padding: 2rem 1rem;
		}

		.game-options {
			margin-bottom: 2rem;
		}

		.option-button {
			padding: 1.5rem;
		}

		.stats-panel {
			margin-left: 1rem;
			margin-right: 1rem;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.welcome-screen::before,
		.resume-notification,
		.stats-panel,
		.fade-in,
		.option-button,
		.option-link,
		.custom-round-btn {
			animation: none;
			transition: none;
		}

		.option-button:hover .option-icon,
		.option-link:hover,
		.custom-round-btn:hover {
			transform: none;
		}
	}
</style>
