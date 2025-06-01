<script lang="ts">
	import { onMount } from 'svelte';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import GameRound from '$lib/components/GameRound.svelte';
	import GameResults from '$lib/components/GameResults.svelte';
	import {
		gameState,
		isGameActive,
		initializeGame,
		resetGame,
		error,
		isLoading,
		checkForSavedGame
	} from '$lib/stores/gameStore';
	import type { GameSettings } from '$lib/types';

	let showWelcome = true;

	// Subscribe to game state changes
	$: if ($gameState.rounds.length > 0) {
		showWelcome = false;
	}

	async function handleStartGame(event: CustomEvent<GameSettings>) {
		const settings = event.detail;
		showWelcome = false;
		await initializeGame(settings);
	}

	function handleResumeGame() {
		showWelcome = false;
		// Resume logic is handled in the WelcomeScreen component
		// The game store state will automatically update to show the game
	}

	function handleBackToWelcome() {
		showWelcome = true;
		resetGame();
	}

	function handleGameComplete() {
		// Game completion is handled by the game state
		// The UI will automatically show results when gameComplete is true
	}

	function handlePlayAgain() {
		// Reset and show welcome screen for new game selection
		resetGame();
		showWelcome = true;
	}

	onMount(() => {
		// Check for saved games on app start
		checkForSavedGame();
	});
</script>

<svelte:head>
	<title>WhereAmI - Guess the Location Game</title>
	<meta
		name="description"
		content="Test your geographical knowledge by guessing where photos were taken around the world."
	/>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="theme-color" content="#667eea" />
</svelte:head>

<div class="app-container">
	{#if showWelcome}
		<WelcomeScreen on:startGame={handleStartGame} on:resumeGame={handleResumeGame} />
	{:else if $isLoading}
		<!-- Loading screen -->
		<div class="loading-screen min-h-screen flex items-center justify-center">
			<div class="loading-content text-center">
				<div class="loading-spinner mx-auto mb-4"></div>
				<h2 class="text-xl font-semibold text-gray-700 mb-2">Loading Game...</h2>
				<p class="text-gray-500">Preparing your geography challenge</p>
			</div>
		</div>
	{:else if $error}
		<!-- Error screen -->
		<div class="error-screen min-h-screen flex items-center justify-center p-4">
			<div class="error-content card max-w-md w-full text-center">
				<div class="text-red-500 text-4xl mb-4">⚠️</div>
				<h2 class="text-xl font-semibold text-gray-800 mb-4">Oops! Something went wrong</h2>
				<p class="text-gray-600 mb-6">{$error}</p>
				<div class="flex gap-4 justify-center flex-wrap">
					<button class="btn-primary" on:click={handleBackToWelcome}> ← Back to Home </button>
					<button class="btn-secondary" on:click={() => window.location.reload()}>
						🔄 Refresh Page
					</button>
				</div>
			</div>
		</div>
	{:else if $gameState.gameComplete}
		<!-- Game complete - show results -->
		<GameResults on:playAgain={handlePlayAgain} on:backToHome={handleBackToWelcome} />
	{:else if $isGameActive}
		<!-- Game is active - show current round -->
		<GameRound on:gameComplete={handleGameComplete} on:backToHome={handleBackToWelcome} />
	{:else}
		<!-- Fallback -->
		<WelcomeScreen on:startGame={handleStartGame} on:resumeGame={handleResumeGame} />
	{/if}
</div>

<style>
	.app-container {
		min-height: 100vh;
		width: 100%;
	}

	.loading-screen {
		background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
	}

	.error-screen {
		background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #e2e8f0;
		border-top: 4px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.error-content .flex {
			flex-direction: column;
		}

		.error-content .btn-primary,
		.error-content .btn-secondary {
			width: 100%;
		}
	}
</style>
