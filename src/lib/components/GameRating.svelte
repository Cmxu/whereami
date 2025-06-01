<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { CustomGame } from '$lib/types';
	import { api } from '$lib/utils/api';

	export let game: CustomGame;
	export let readonly: boolean = false;
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const dispatch = createEventDispatcher<{
		rated: { rating: number; success: boolean };
	}>();

	let userRating = 0;
	let hoverRating = 0;
	let loading = false;
	let error = '';

	const sizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
		lg: 'w-6 h-6'
	};

	onMount(() => {
		loadUserRating();
	});

	async function loadUserRating() {
		try {
			const rating = await api.getUserRating(game.id);
			if (rating) {
				userRating = rating.rating;
			}
		} catch (err) {
			// User hasn't rated yet, or error loading
			console.warn('Could not load user rating:', err);
		}
	}

	async function submitRating(rating: number) {
		if (readonly || loading) return;

		try {
			loading = true;
			error = '';
			await api.rateGame(game.id, rating);
			userRating = rating;
			dispatch('rated', { rating, success: true });
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to submit rating';
			dispatch('rated', { rating, success: false });
		} finally {
			loading = false;
		}
	}

	function handleStarClick(rating: number) {
		if (!readonly) {
			submitRating(rating);
		}
	}

	function handleStarHover(rating: number) {
		if (!readonly) {
			hoverRating = rating;
		}
	}

	function handleStarLeave() {
		if (!readonly) {
			hoverRating = 0;
		}
	}

	function getStarClass(starIndex: number): string {
		const rating = hoverRating || userRating || 0;
		const baseClass = `star ${sizeClasses[size]} cursor-pointer transition-all duration-150`;
		
		if (starIndex <= rating) {
			return `${baseClass} text-yellow-400`;
		} else {
			return `${baseClass} text-gray-300`;
		}
	}

	$: displayRating = game.rating || 0;
	$: ratingCount = game.ratingCount || 0;
</script>

<div class="game-rating">
	{#if readonly}
		<!-- Display-only mode -->
		<div class="rating-display flex items-center gap-2">
			<div class="stars flex items-center gap-1">
				{#each Array(5) as _, i}
					<span class="star {sizeClasses[size]} {i < displayRating ? 'text-yellow-400' : 'text-gray-300'}">
						⭐
					</span>
				{/each}
			</div>
			<div class="rating-info text-sm text-gray-600">
				{#if displayRating > 0}
					<span class="rating-value font-medium">{displayRating.toFixed(1)}</span>
					{#if ratingCount > 0}
						<span class="rating-count">({ratingCount})</span>
					{/if}
				{:else}
					<span class="no-rating">No ratings</span>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Interactive rating mode -->
		<div class="rating-interactive">
			<div class="rating-label mb-2">
				<span class="text-sm font-medium text-gray-700">Rate this game</span>
				{#if userRating > 0}
					<span class="text-xs text-gray-500 ml-2">You rated: {userRating} star{userRating !== 1 ? 's' : ''}</span>
				{/if}
			</div>
			
			<div class="stars-container flex items-center gap-1 mb-2">
				{#each Array(5) as _, i}
					<button
						class={getStarClass(i + 1)}
						class:opacity-50={loading}
						disabled={loading}
						on:click={() => handleStarClick(i + 1)}
						on:mouseenter={() => handleStarHover(i + 1)}
						on:mouseleave={handleStarLeave}
						aria-label="Rate {i + 1} star{i + 1 !== 1 ? 's' : ''}"
					>
						⭐
					</button>
				{/each}
				{#if loading}
					<div class="loading-spinner ml-2"></div>
				{/if}
			</div>

			{#if error}
				<div class="error-message text-xs text-red-600 mb-2">
					{error}
				</div>
			{/if}

			{#if displayRating > 0}
				<div class="community-rating text-xs text-gray-500">
					Community rating: {displayRating.toFixed(1)}/5 ({ratingCount} rating{ratingCount !== 1 ? 's' : ''})
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.star {
		display: inline-block;
		text-decoration: none;
		user-select: none;
	}

	.star:hover {
		transform: scale(1.1);
	}

	.star:active {
		transform: scale(0.95);
	}

	.loading-spinner {
		width: 12px;
		height: 12px;
		border: 1px solid #f3f4f6;
		border-top: 1px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.rating-interactive button:disabled {
		cursor: not-allowed;
	}

	.rating-interactive button:not(:disabled):hover {
		filter: brightness(1.1);
	}
</style> 