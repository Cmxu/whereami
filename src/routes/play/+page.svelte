<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import GameRound from '$lib/components/GameRound.svelte';
	import GameResults from '$lib/components/GameResults.svelte';
	import {
		gameState,
		isGameActive,
		initializeGame,
		resetGame,
		proceedToNextRound,
		saveGame,
		error,
		isLoading,
		checkForSavedGame
	} from '$lib/stores/gameStore';
	import type { GameSettings } from '$lib/types';

	async function handleStartGame(settings: GameSettings) {
		await initializeGame(settings);
	}

	function handleBackToHome() {
		// Save the current game state before navigating
		if ($isGameActive) {
			saveGame();
		}
		goto('/');
	}

	function handleGameComplete() {
		// Complete the game and show results
		proceedToNextRound();
	}

	function handlePlayAgain() {
		// Reset and go back to home for new game selection
		resetGame();
		goto('/');
	}

	onMount(() => {
		// Check for pending game settings from home page
		const pendingSettings = sessionStorage.getItem('pendingGameSettings');
		if (pendingSettings) {
			try {
				const settings = JSON.parse(pendingSettings);
				sessionStorage.removeItem('pendingGameSettings');
				handleStartGame(settings);
				return;
			} catch (error) {
				console.error('Error parsing pending game settings:', error);
				sessionStorage.removeItem('pendingGameSettings');
			}
		}

		// Check if there's a game to resume or start
		checkForSavedGame();
		
		// If no active game and no pending settings, redirect to home after a short delay
		setTimeout(() => {
			if (!$isGameActive && $gameState.rounds.length === 0 && !$isLoading && !$error) {
				// No game state, redirect to home
				goto('/');
			}
		}, 100);
	});

	onDestroy(() => {
		// Ensure no-scroll class is removed when leaving the page
		if (typeof document !== 'undefined') {
			document.body.classList.remove('game-active-no-scroll');
		}
	});

	// Add/remove no-scroll class on body when game is active
	$: {
		if (typeof document !== 'undefined') {
			if ($isGameActive) {
				document.body.classList.add('game-active-no-scroll');
			} else {
				document.body.classList.remove('game-active-no-scroll');
			}
		}
	}
</script>

<svelte:head>
	<title>Play - WhereAmI</title>
	<meta
		name="description"
		content="Play the geography guessing game - try to identify where photos were taken around the world."
	/>
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="theme-color" content="#667eea" />
</svelte:head>

<div class="app-container">
	{#if $isLoading}
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
					<button class="btn-primary" on:click={handleBackToHome}> ← Back to Home </button>
					<button class="btn-secondary" on:click={() => window.location.reload()}>
						🔄 Refresh Page
					</button>
				</div>
			</div>
		</div>
	{:else if $gameState.gameComplete}
		<!-- Game complete - show results -->
		<GameResults on:playAgain={handlePlayAgain} on:backToHome={handleBackToHome} />
	{:else if $isGameActive}
		<!-- Game is active - show current round -->
		<GameRound on:gameComplete={handleGameComplete} on:backToHome={handleBackToHome} />
	{:else}
		<!-- No game active, redirect handled in onMount -->
		<div class="loading-screen min-h-screen flex items-center justify-center">
			<div class="loading-content text-center">
				<div class="loading-spinner mx-auto mb-4"></div>
				<h2 class="text-xl font-semibold text-gray-700 mb-2">Loading...</h2>
				<p class="text-gray-500">Redirecting to home</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.app-container {
		min-height: 100vh;
		width: 100%;
	}

	/* When game is active, use exact height to prevent overflow */
	:global(body.game-active-no-scroll) .app-container {
		height: 100%;
		min-height: 0;
		overflow: hidden;
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