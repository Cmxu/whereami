<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { CustomGame } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';
	import ShareGame from '$lib/components/ShareGame.svelte';
	import GameLeaderboard from '$lib/components/GameLeaderboard.svelte';

	let game: CustomGame | null = null;
	let loading = true;
	let error = '';
	let creatorGameCount: number | null = null;

	let showShareModal = false;

	$: gameId = $page.params.gameId;

	onMount(() => {
		loadGameDetails();
	});

	async function loadGameDetails() {
		try {
			loading = true;
			error = '';
			game = await api.getCustomGame(gameId);
			
			// Load creator's game count
			if (game?.createdByUserId) {
				loadCreatorGameCount(game.createdByUserId);
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load game';
		} finally {
			loading = false;
		}
	}

	async function loadCreatorGameCount(creatorId: string) {
		try {
			// Use the existing API to get user games
			const creatorGames = await api.getUserGames(creatorId);
			creatorGameCount = creatorGames.length;
		} catch (err) {
			console.warn('Failed to load creator game count:', err);
			creatorGameCount = null;
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
			goto('/play');
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to start game');
		}
	}



	function handleShared(event: any) {
		if (event.detail.success) {
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
	<title>{game?.name || 'Game'} - WhereAmI</title>
	<meta
		name="description"
		content={game?.description || 'Play this custom geography game on WhereAmI'}
	/>
	<meta property="og:title" content="{game?.name || 'Custom Game'} - WhereAmI" />
	<meta
		property="og:description"
		content={game?.description || 'Play this custom geography game on WhereAmI'}
	/>
	<meta property="og:type" content="website" />
</svelte:head>

<div class="game-detail-page min-h-screen" style="background-color: var(--bg-secondary);">
	<!-- Loading State -->
	{#if loading}
		<div class="loading-container flex items-center justify-center min-h-screen">
			<div class="text-center">
				<div class="loading-spinner mx-auto mb-4"></div>
				<p style="color: var(--text-secondary);">Loading game details...</p>
			</div>
		</div>
	{/if}

	<!-- Error State -->
	{#if error && !loading}
		<div class="error-container flex items-center justify-center min-h-screen">
			<div class="text-center">
				<div class="text-red-500 text-6xl mb-4">⚠️</div>
				<h1 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">Game Not Found</h1>
				<p class="mb-6" style="color: var(--text-secondary);">{error}</p>
				<div class="flex gap-3 justify-center">
					<button class="btn-secondary" on:click={() => goto('/browse')}> ← Browse Games </button>
					<button class="btn-primary" on:click={() => goto('/play')}> Play Random Game </button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Game Content -->
	{#if game && !loading}
		<div class="game-content">
			<!-- Header -->
			<div class="game-header shadow-sm" style="background-color: var(--bg-primary);">
				<div class="max-w-4xl mx-auto p-6">
					<div class="flex justify-between items-start mb-4">
						<div class="flex-1">
							<h1 class="text-3xl font-bold mb-2" style="color: var(--text-primary);">{game.name}</h1>
							<p class="text-lg mb-4" style="color: var(--text-secondary);">
								{game.description || 'A custom geography game'}
							</p>

							<!-- Game Meta -->
							<div class="game-meta flex flex-wrap items-center gap-4 text-sm" style="color: var(--text-tertiary);">
								<div class="flex items-center gap-1">
									<span>📸</span>
									<span>{game.imageIds.length} photos</span>
								</div>
								<div class="flex items-center gap-1">
									<span>🎮</span>
									<span>{formatPlayCount(game.playCount)} plays</span>
								</div>
								<div class="flex items-center gap-1">
									<span>👤</span>
									<span>by {game.createdBy}</span>
								</div>
								<div class="flex items-center gap-1">
									<span>📅</span>
									<span>{formatDate(game.createdAt)}</span>
								</div>
								{#if game.difficulty}
									<div class="flex items-center gap-1">
										<span>⚡</span>
										<span class="capitalize">{game.difficulty}</span>
									</div>
								{/if}
							</div>

							<!-- Tags -->
							{#if game.tags && game.tags.length > 0}
								<div class="game-tags mt-3 flex flex-wrap gap-2">
									{#each game.tags as tag}
										<span class="tag px-2 py-1 text-xs rounded-full bg-blue-100-theme text-blue-700-theme">
											{tag}
										</span>
									{/each}
								</div>
							{/if}
						</div>

						<div class="game-actions flex gap-3 ml-6">
							<button class="btn-secondary" on:click={() => goto('/browse')}> ← Browse </button>
							<button class="btn-secondary" on:click={() => (showShareModal = true)}>
								🔗 Share
							</button>
							<button class="btn-primary text-lg px-6" on:click={playGame}> 🎮 Play Game </button>
						</div>
					</div>


				</div>
			</div>

			<!-- Main Content -->
			<div class="main-content max-w-6xl mx-auto p-6">
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Left Column: Game Info -->
					<div class="game-info-column">
						<!-- About This Game -->
						<div class="card p-6 mb-6">
							<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">About This Game</h2>

							{#if game.description}
								<p class="mb-6" style="color: var(--text-secondary);">{game.description}</p>
							{/if}

							<div class="game-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
								<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
									<div class="stat-value text-2xl font-bold text-blue-600">
										{game.imageIds.length}
									</div>
									<div class="stat-label text-sm" style="color: var(--text-secondary);">Locations</div>
								</div>
								<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
									<div class="stat-value text-2xl font-bold text-green-600">
										{formatPlayCount(game.playCount)}
									</div>
									<div class="stat-label text-sm" style="color: var(--text-secondary);">Plays</div>
								</div>
								<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
									<div class="stat-value text-2xl font-bold text-yellow-500">
										{game.rating ? game.rating.toFixed(1) : '—'}
									</div>
									<div class="stat-label text-sm" style="color: var(--text-secondary);">Rating</div>
								</div>
								<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
									<div class="stat-value text-2xl font-bold text-purple-600">
										{game.ratingCount || 0}
									</div>
									<div class="stat-label text-sm" style="color: var(--text-secondary);">Reviews</div>
								</div>
							</div>
						</div>

						<!-- Game Creator -->
						<div class="card p-6 mb-6">
							<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Game Creator</h3>
							<div class="creator-info flex items-center gap-4 mb-4">
								<div
									class="creator-avatar w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg"
								>
									{game.createdBy.charAt(0).toUpperCase()}
								</div>
								<div class="flex-1">
									<div class="creator-name font-semibold text-lg" style="color: var(--text-primary);">{game.createdBy}</div>
									<div class="creator-date text-sm" style="color: var(--text-tertiary);">Created {formatDate(game.createdAt)}</div>
								</div>
							</div>
							
							<!-- Creator Stats -->
							<div class="creator-stats grid grid-cols-2 gap-3 pt-3 border-t" style="border-color: var(--border-color);">
								<div class="stat text-center">
									<div class="stat-value text-xl font-bold text-blue-600">{creatorGameCount || '...'}</div>
									<div class="stat-label text-xs" style="color: var(--text-tertiary);">Games</div>
								</div>
								<div class="stat text-center">
									<div class="stat-value text-xl font-bold text-green-600">{formatPlayCount(game.playCount)}</div>
									<div class="stat-label text-xs" style="color: var(--text-tertiary);">Plays</div>
								</div>
							</div>
						</div>

						<!-- Game Details -->
						<div class="card p-6">
							<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Game Details</h3>
							
							<!-- Game Info Grid -->
							<div class="game-details-grid space-y-3">
								<div class="detail-row flex justify-between items-center py-2 border-b" style="border-color: var(--border-color);">
									<span class="detail-label text-sm" style="color: var(--text-secondary);">Difficulty</span>
									<span class="detail-value font-medium capitalize" style="color: var(--text-primary);">
										{game.difficulty || 'Not specified'}
									</span>
								</div>
								
								<div class="detail-row flex justify-between items-center py-2 border-b" style="border-color: var(--border-color);">
									<span class="detail-label text-sm" style="color: var(--text-secondary);">Locations</span>
									<span class="detail-value font-medium" style="color: var(--text-primary);">
										{game.imageIds.length} photos
									</span>
								</div>
								
								<div class="detail-row flex justify-between items-center py-2 border-b" style="border-color: var(--border-color);">
									<span class="detail-label text-sm" style="color: var(--text-secondary);">Rating</span>
									<span class="detail-value font-medium" style="color: var(--text-primary);">
										{game.rating ? `${game.rating.toFixed(1)} ⭐` : 'No ratings yet'}
									</span>
								</div>
								
								<div class="detail-row flex justify-between items-center py-2">
									<span class="detail-label text-sm" style="color: var(--text-secondary);">Total Plays</span>
									<span class="detail-value font-medium" style="color: var(--text-primary);">
										{formatPlayCount(game.playCount)}
									</span>
								</div>
							</div>

							<!-- Tags Section -->
							{#if game.tags && game.tags.length > 0}
								<div class="tags-section mt-4 pt-4 border-t" style="border-color: var(--border-color);">
									<div class="text-sm font-medium mb-2" style="color: var(--text-secondary);">Tags</div>
									<div class="flex flex-wrap gap-2">
										{#each game.tags as tag}
											<span class="tag px-2 py-1 text-xs rounded-full bg-blue-100-theme text-blue-700-theme">
												{tag}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Right Column: Leaderboard -->
					<div class="leaderboard-column">
						<GameLeaderboard gameId={game.id} />
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Share Modal -->
{#if game}
	<ShareGame
		{game}
		bind:showModal={showShareModal}
		on:shared={handleShared}
		on:close={() => (showShareModal = false)}
	/>
{/if}

<style>
	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--border-color);
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

	.tag {
		font-weight: 500;
	}

	.btn-secondary,
	.btn-primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	@media (max-width: 1024px) {
		.game-header .flex {
			flex-direction: column;
			gap: 1rem;
		}

		.game-actions {
			margin-left: 0;
			width: 100%;
			justify-content: flex-start;
		}

		.main-content .grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.game-actions {
			flex-direction: column;
		}

		.game-stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
