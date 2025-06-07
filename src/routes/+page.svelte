<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';
	import { checkForSavedGame } from '$lib/stores/gameStore';
	import type { GameSettings } from '$lib/types';

	onMount(() => {
		// Check for saved game when home page loads
		checkForSavedGame();
	});

	async function handleStartGame(event: CustomEvent<GameSettings>) {
		const settings = event.detail;
		// Navigate to play page with the game settings
		// Store the settings and redirect to the play page
		sessionStorage.setItem('pendingGameSettings', JSON.stringify(settings));
		goto('/play');
	}

	function handleResumeGame() {
		// Navigate to play page to resume
		goto('/play');
	}

	function handleBrowseGames() {
		goto('/browse');
	}
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
	<WelcomeScreen
		on:startGame={handleStartGame}
		on:resumeGame={handleResumeGame}
		on:browseGames={handleBrowseGames}
	/>
</div>

<style>
	.app-container {
		height: 100vh;
		width: 100%;
		overflow: hidden;
	}
</style>
