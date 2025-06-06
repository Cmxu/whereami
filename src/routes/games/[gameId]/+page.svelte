<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { CustomGame, GameComment } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { initializeGame } from '$lib/stores/gameStore';
	import ShareGame from '$lib/components/ShareGame.svelte';
	import GameRating from '$lib/components/GameRating.svelte';

	let game: CustomGame | null = null;
	let loading = true;
	let error = '';
	let comments: GameComment[] = [];
	let loadingComments = false;
	let commentsError = '';
	let newComment = '';
	let submittingComment = false;
	let showShareModal = false;

	$: gameId = $page.params.gameId;

	onMount(() => {
		loadGameDetails();
		loadComments();
	});

	async function loadGameDetails() {
		try {
			loading = true;
			error = '';
			game = await api.getCustomGame(gameId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load game';
		} finally {
			loading = false;
		}
	}

	async function loadComments() {
		try {
			loadingComments = true;
			commentsError = '';
			comments = await api.getGameComments(gameId);
		} catch (err) {
			commentsError = err instanceof Error ? err.message : 'Failed to load comments';
		} finally {
			loadingComments = false;
		}
	}

	async function submitComment() {
		if (!newComment.trim() || submittingComment) return;

		try {
			submittingComment = true;
			const comment = await api.addComment(gameId, newComment.trim());
			comments = [comment, ...comments];
			newComment = '';
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to submit comment');
		} finally {
			submittingComment = false;
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

	function handleRated(event: any) {
		if (event.detail.success && game) {
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

<div class="game-detail-page min-h-screen bg-gray-50">
	<!-- Loading State -->
	{#if loading}
		<div class="loading-container flex items-center justify-center min-h-screen">
			<div class="text-center">
				<div class="loading-spinner mx-auto mb-4"></div>
				<p class="text-gray-600">Loading game details...</p>
			</div>
		</div>
	{/if}

	<!-- Error State -->
	{#if error && !loading}
		<div class="error-container flex items-center justify-center min-h-screen">
			<div class="text-center">
				<div class="text-red-500 text-6xl mb-4">⚠️</div>
				<h1 class="text-2xl font-bold text-gray-800 mb-2">Game Not Found</h1>
				<p class="text-gray-600 mb-6">{error}</p>
				<div class="flex gap-3 justify-center">
					<button class="btn-secondary" on:click={() => goto('/browse')}> ← Browse Games </button>
					<button class="btn-primary" on:click={() => goto('/')}> Play Random Game </button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Game Content -->
	{#if game && !loading}
		<div class="game-content">
			<!-- Header -->
			<div class="game-header bg-white shadow-sm">
				<div class="max-w-4xl mx-auto p-6">
					<div class="flex justify-between items-start mb-4">
						<div class="flex-1">
							<h1 class="text-3xl font-bold text-gray-800 mb-2">{game.name}</h1>
							<p class="text-gray-600 text-lg mb-4">
								{game.description || 'A custom geography game'}
							</p>

							<!-- Game Meta -->
							<div class="game-meta flex flex-wrap items-center gap-4 text-sm text-gray-500">
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
										<span class="tag px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
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

					<!-- Rating -->
					<div class="rating-section">
						<GameRating {game} readonly={false} size="md" on:rated={handleRated} />
					</div>
				</div>
			</div>

			<!-- Main Content -->
			<div class="main-content max-w-4xl mx-auto p-6">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<!-- Game Info -->
					<div class="game-info lg:col-span-2">
						<div class="card p-6">
							<h2 class="text-xl font-semibold text-gray-800 mb-4">About This Game</h2>

							{#if game.description}
								<p class="text-gray-700 mb-6">{game.description}</p>
							{/if}

							<div class="game-stats grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
								<div class="stat-item text-center p-3 bg-gray-50 rounded-lg">
									<div class="stat-value text-2xl font-bold text-blue-600">
										{game.imageIds.length}
									</div>
									<div class="stat-label text-sm text-gray-600">Locations</div>
								</div>
								<div class="stat-item text-center p-3 bg-gray-50 rounded-lg">
									<div class="stat-value text-2xl font-bold text-green-600">
										{formatPlayCount(game.playCount)}
									</div>
									<div class="stat-label text-sm text-gray-600">Plays</div>
								</div>
								<div class="stat-item text-center p-3 bg-gray-50 rounded-lg">
									<div class="stat-value text-2xl font-bold text-yellow-500">
										{game.rating ? game.rating.toFixed(1) : '—'}
									</div>
									<div class="stat-label text-sm text-gray-600">Rating</div>
								</div>
								<div class="stat-item text-center p-3 bg-gray-50 rounded-lg">
									<div class="stat-value text-2xl font-bold text-purple-600">
										{game.ratingCount || 0}
									</div>
									<div class="stat-label text-sm text-gray-600">Reviews</div>
								</div>
							</div>

							<div class="play-section">
								<h3 class="text-lg font-semibold text-gray-800 mb-3">Ready to Play?</h3>
								<p class="text-gray-600 mb-4">
									Test your geography knowledge with {game.imageIds.length} carefully selected locations.
									Can you guess where each photo was taken?
								</p>
								<button class="btn-primary w-full text-lg py-3" on:click={playGame}>
									🌍 Start Playing Now
								</button>
							</div>
						</div>
					</div>

					<!-- Sidebar -->
					<div class="sidebar">
						<!-- Creator Info -->
						<div class="card p-6 mb-6">
							<h3 class="text-lg font-semibold text-gray-800 mb-3">Created by</h3>
							<div class="creator-info flex items-center gap-3">
								<div
									class="creator-avatar w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold"
								>
									{game.createdBy.charAt(0).toUpperCase()}
								</div>
								<div>
									<div class="creator-name font-medium text-gray-800">{game.createdBy}</div>
									<div class="creator-date text-sm text-gray-500">{formatDate(game.createdAt)}</div>
								</div>
							</div>
						</div>

						<!-- Quick Actions -->
						<div class="card p-6">
							<h3 class="text-lg font-semibold text-gray-800 mb-3">Quick Actions</h3>
							<div class="actions-list space-y-3">
								<button class="btn-secondary w-full justify-center" on:click={playGame}>
									🎮 Play Game
								</button>
								<button
									class="btn-secondary w-full justify-center"
									on:click={() => (showShareModal = true)}
								>
									🔗 Share with Friends
								</button>
								<button
									class="btn-secondary w-full justify-center"
									on:click={() => goto('/browse')}
								>
									🌍 Browse More Games
								</button>
							</div>
						</div>
					</div>
				</div>

				<!-- Comments Section -->
				<div class="comments-section mt-12">
					<div class="card p-6">
						<h2 class="text-xl font-semibold text-gray-800 mb-6">Comments</h2>

						<!-- Add Comment Form -->
						<div class="add-comment mb-8">
							<div class="flex gap-3">
								<textarea
									class="input-field flex-1"
									rows="3"
									placeholder="Share your thoughts about this game..."
									bind:value={newComment}
									maxlength="500"
								></textarea>
								<button
									class="btn-primary self-start"
									disabled={!newComment.trim() || submittingComment}
									on:click={submitComment}
								>
									{submittingComment ? '...' : 'Post'}
								</button>
							</div>
							<div class="character-count text-xs text-gray-500 mt-1 text-right">
								{newComment.length}/500
							</div>
						</div>

						<!-- Comments List -->
						{#if loadingComments}
							<div class="loading-state text-center py-8">
								<div class="loading-spinner mx-auto mb-4"></div>
								<p class="text-gray-600">Loading comments...</p>
							</div>
						{:else if commentsError}
							<div class="error-state text-center py-8">
								<p class="text-red-600">{commentsError}</p>
								<button class="btn-secondary text-sm mt-2" on:click={loadComments}>
									Try Again
								</button>
							</div>
						{:else if comments.length === 0}
							<div class="empty-comments text-center py-8">
								<div class="text-4xl mb-4">💬</div>
								<h3 class="text-lg font-semibold text-gray-800 mb-2">No comments yet</h3>
								<p class="text-gray-600">Be the first to share your thoughts!</p>
							</div>
						{:else}
							<div class="comments-list space-y-4">
								{#each comments as comment}
									<div class="comment bg-gray-50 rounded-lg p-4">
										<div class="comment-header flex items-center gap-3 mb-2">
											<div
												class="commenter-avatar w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold"
											>
												{comment.username.charAt(0).toUpperCase()}
											</div>
											<div class="flex-1">
												<div class="commenter-name font-medium text-gray-800">
													{comment.username}
												</div>
												<div class="comment-date text-xs text-gray-500">
													{formatDate(comment.createdAt)}
												</div>
											</div>
										</div>
										<div class="comment-content text-gray-700">
											{comment.comment}
										</div>
									</div>
								{/each}
							</div>
						{/if}
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
