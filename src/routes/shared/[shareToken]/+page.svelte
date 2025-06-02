<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { CustomGame } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';

	let game: CustomGame | null = null;
	let loading = true;
	let error = '';

	$: shareToken = $page.params.shareToken;

	onMount(() => {
		loadSharedGame();
	});

	async function loadSharedGame() {
		try {
			loading = true;
			error = '';
			game = await api.getGameByShareToken(shareToken);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load shared game';
		} finally {
			loading = false;
		}
	}

	async function playGame() {
		if (!game) return;

		try {
			await initializeGame({
				numRounds: game.imageIds.length,
				gameMode: 'custom',
				gameId: game.id
			});
			goto('/');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to start game');
		}
	}

	function viewGameDetails() {
		if (game) {
			goto(`/games/${game.id}`);
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatPlayCount(count: number): string {
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}k`;
		}
		return count.toString();
	}
</script>

<svelte:head>
	<title>{game?.name || 'Shared Game'} - WhereAmI</title>
	<meta
		name="description"
		content={game?.description || 'Play this shared geography game on WhereAmI'}
	/>
	<meta property="og:title" content="{game?.name || 'Shared Game'} - WhereAmI" />
	<meta
		property="og:description"
		content={game?.description || 'Play this shared geography game on WhereAmI'}
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<div class="shared-game-page min-h-screen bg-gray-50">
	<!-- Loading State -->
	{#if loading}
		<div class="loading-container flex items-center justify-center min-h-screen">
			<div class="text-center">
				<div class="loading-spinner mx-auto mb-4"></div>
				<p class="text-gray-600">Loading shared game...</p>
			</div>
		</div>
	{/if}

	<!-- Error State -->
	{#if error && !loading}
		<div class="error-container flex items-center justify-center min-h-screen">
			<div class="text-center max-w-md">
				<div class="text-red-500 text-6xl mb-4">🔗</div>
				<h1 class="text-2xl font-bold text-gray-800 mb-2">Link Not Found</h1>
				<p class="text-gray-600 mb-6">{error}</p>
				<div class="flex gap-3 justify-center">
					<button class="btn-secondary" on:click={() => goto('/browse')}> 🌍 Browse Games </button>
					<button class="btn-primary" on:click={() => goto('/')}> 🎮 Play Random Game </button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Game Content -->
	{#if game && !loading}
		<div class="game-content">
			<!-- Header -->
			<div class="shared-header bg-white shadow-sm">
				<div class="max-w-2xl mx-auto p-6 text-center">
					<div
						class="shared-badge inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4"
					>
						🔗 Shared Game
					</div>
					<h1 class="text-3xl font-bold text-gray-800 mb-2">{game.name}</h1>
					<p class="text-gray-600 text-lg mb-6">
						{game.description || 'A custom geography game'}
					</p>

					<!-- Game Preview Stats -->
					<div class="game-preview-stats flex justify-center gap-6 mb-6">
						<div class="stat-item text-center">
							<div class="stat-value text-2xl font-bold text-blue-600">{game.imageIds.length}</div>
							<div class="stat-label text-sm text-gray-600">Locations</div>
						</div>
						<div class="stat-item text-center">
							<div class="stat-value text-2xl font-bold text-green-600">
								{formatPlayCount(game.playCount)}
							</div>
							<div class="stat-label text-sm text-gray-600">Plays</div>
						</div>
						<div class="stat-item text-center">
							<div class="stat-value text-2xl font-bold text-yellow-500">
								{game.rating ? game.rating.toFixed(1) : '—'}
							</div>
							<div class="stat-label text-sm text-gray-600">Rating</div>
						</div>
					</div>

					<!-- Tags -->
					{#if game.tags && game.tags.length > 0}
						<div class="game-tags flex flex-wrap justify-center gap-2 mb-6">
							{#each game.tags as tag}
								<span class="tag px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
									{tag}
								</span>
							{/each}
						</div>
					{/if}

					<!-- Main Actions -->
					<div class="main-actions flex flex-col sm:flex-row gap-3 justify-center mb-6">
						<button class="btn-primary text-lg px-8 py-3" on:click={playGame}>
							🎮 Play This Game
						</button>
						<button class="btn-secondary" on:click={viewGameDetails}> 📋 View Details </button>
					</div>

					<!-- Creator Info -->
					<div class="creator-section text-center">
						<p class="text-sm text-gray-500 mb-2">Created by</p>
						<div class="creator-info inline-flex items-center gap-3">
							<div
								class="creator-avatar w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold"
							>
								{game.createdBy.charAt(0).toUpperCase()}
							</div>
							<div class="text-left">
								<div class="creator-name font-medium text-gray-800">{game.createdBy}</div>
								<div class="creator-date text-sm text-gray-500">{formatDate(game.createdAt)}</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Game Description -->
			<div class="game-description max-w-2xl mx-auto p-6">
				<div class="card p-6 text-center">
					<h2 class="text-xl font-semibold text-gray-800 mb-4">About This Game</h2>

					{#if game.description}
						<p class="text-gray-700 mb-6">{game.description}</p>
					{:else}
						<p class="text-gray-600 mb-6">
							A custom geography game with {game.imageIds.length} carefully selected locations.
						</p>
					{/if}

					<div class="game-challenge bg-blue-50 rounded-lg p-4 mb-6">
						<h3 class="text-lg font-semibold text-blue-800 mb-2">🌍 The Challenge</h3>
						<p class="text-blue-700">
							Look at {game.imageIds.length} photos and try to guess where they were taken. The closer
							your guess, the more points you'll earn!
						</p>
					</div>

					{#if game.difficulty}
						<div
							class="difficulty-badge inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg mb-6"
						>
							<span class="text-lg">⚡</span>
							<span class="font-medium text-gray-700 capitalize">{game.difficulty} Difficulty</span>
						</div>
					{/if}

					<!-- Play Button -->
					<button class="btn-primary w-full text-lg py-4" on:click={playGame}>
						🚀 Start Playing Now
					</button>

					<!-- Additional Links -->
					<div class="additional-links mt-6 flex justify-center gap-4">
						<button class="btn-secondary text-sm" on:click={viewGameDetails}>
							📋 Full Details
						</button>
						<button class="btn-secondary text-sm" on:click={() => goto('/browse')}>
							🌍 More Games
						</button>
						<button class="btn-secondary text-sm" on:click={() => goto('/')}>
							🎮 Random Game
						</button>
					</div>
				</div>
			</div>

			<!-- WhereAmI Promotion -->
			<div class="promotion-section max-w-2xl mx-auto p-6">
				<div class="card p-6 text-center bg-gradient-to-r from-blue-50 to-purple-50">
					<h3 class="text-xl font-semibold text-gray-800 mb-3">🎯 Love Geography Games?</h3>
					<p class="text-gray-600 mb-4">
						Join WhereAmI to create your own games, upload photos, and challenge friends worldwide!
					</p>
					<div class="flex flex-col sm:flex-row gap-3 justify-center">
						<button class="btn-primary" on:click={() => goto('/gallery?tab=upload')}>
							📸 Upload Photos
						</button>
						<button class="btn-secondary" on:click={() => goto('/browse')}>
							🌍 Explore Games
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f4f6;
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

	.card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.tag {
		font-weight: 500;
	}

	.btn-secondary,
	.btn-primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.game-challenge {
		border: 1px solid #93c5fd;
	}

	@media (max-width: 640px) {
		.game-preview-stats {
			gap: 1rem;
		}

		.main-actions {
			flex-direction: column;
		}

		.additional-links {
			flex-direction: column;
			align-items: center;
		}
	}
</style>
