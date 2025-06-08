<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { GameSettings } from '$lib/types';
	import { hasSavedGameInProgress, resumeSavedGame } from '$lib/stores/gameStore';
	import {
		getUserPreferences,
		type UserPreferences
	} from '$lib/utils/localStorage';

	const dispatch = createEventDispatcher<{
		startGame: GameSettings;
		resumeGame: void;
	}>();

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

	onMount(() => {
		// Refresh preferences on mount
		preferences = getUserPreferences();
	});
</script>

<div class="welcome-screen min-h-screen flex items-center justify-center p-4">
	<div class="welcome-content max-w-4xl w-full text-center fade-in">
		<!-- Logo and title -->
		<div class="logo-container mb-8 md:mb-12">
			<h1 class="game-logo text-5xl md:text-8xl font-bold mb-4">WhereAmI</h1>
			<p class="tagline text-lg md:text-2xl max-w-2xl mx-auto">
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
				<p class="custom-options-text text-sm mb-3">Or choose your rounds:</p>
				<div class="flex justify-center gap-2 flex-wrap">
					{#each [5, 15, 20] as roundCount}
						<button
							class="custom-round-btn text-sm px-3 py-1 rounded-full transition-all duration-200"
							on:click={() => startCustomGame(roundCount)}
						>
							{roundCount} rounds
						</button>
					{/each}
				</div>
			</div>
		</div>





		<!-- Footer -->
		<div class="welcome-footer text-xs md:text-sm">
			<p>WhereAmI v2.0 - created by calvin</p>
		</div>
	</div>
</div>

<style>
	.welcome-screen {
		background-color: var(--bg-secondary);
		position: relative;
		overflow: hidden;
		transition: background-color 0.3s ease;
	}



	.welcome-content {
		position: relative;
		z-index: 1;
	}

	.game-logo {
		color: var(--blue-600);
	}

	:global(.dark) .game-logo {
		color: var(--blue-600);
	}

	.tagline {
		color: var(--text-secondary);
	}

	.option-button {
		border: 2px solid transparent;
		transition: all 0.3s ease;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
	}

	:global(.dark) .option-button {
		background: rgba(30, 41, 59, 0.95);
		backdrop-filter: blur(10px);
	}

	.option-button:hover {
		border-color: rgba(59, 130, 246, 0.3);
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(20px);
	}

	:global(.dark) .option-button:hover {
		border-color: rgba(96, 165, 250, 0.4);
		background: rgba(30, 41, 59, 0.98);
		backdrop-filter: blur(20px);
	}

	.option-title {
		color: #1f2937;
	}

	:global(.dark) .option-title {
		color: #f9fafb;
	}

	.rounds-info {
		color: #6b7280;
	}

	:global(.dark) .rounds-info {
		color: #d1d5db;
	}

	.option-icon {
		transition: transform 0.3s ease;
	}

	.option-button:hover .option-icon {
		transform: scale(1.1);
	}

	.custom-options-text {
		color: var(--text-secondary);
	}

	.custom-round-btn {
		background-color: var(--bg-tertiary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
		transition: all 0.2s ease;
	}

	.custom-round-btn:hover {
		background-color: var(--btn-primary-bg);
		color: var(--btn-primary-text);
		transform: scale(1.05);
	}



	.resume-notification {
		animation: slideInDown 0.5s ease-out;
	}

	.welcome-footer {
		color: var(--text-tertiary);
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


	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.welcome-screen::before,
		.resume-notification,
		.fade-in,
		.option-button,
		.custom-round-btn {
			animation: none;
			transition: none;
		}

		.option-button:hover .option-icon,
		.custom-round-btn:hover {
			transform: none;
		}
	}
</style>
