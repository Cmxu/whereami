<script lang="ts">
	import type { CustomGame } from '$lib/types';

	export let game: CustomGame;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let style: 'compact' | 'badge' | 'inline' = 'compact';

	$: displayRating = game.rating || 0;
	$: ratingCount = game.ratingCount || 0;

	const sizeConfig = {
		sm: {
			starSize: 'w-3 h-3 text-xs',
			textSize: 'text-xs',
			padding: 'px-2 py-1'
		},
		md: {
			starSize: 'w-4 h-4 text-sm',
			textSize: 'text-sm',
			padding: 'px-3 py-2'
		},
		lg: {
			starSize: 'w-5 h-5 text-base',
			textSize: 'text-base',
			padding: 'px-4 py-2'
		}
	};

	function getStarDisplay(rating: number): string {
		const fullStars = Math.floor(rating);
		const hasHalfStar = rating % 1 >= 0.5;
		const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

		return '★'.repeat(fullStars) + (hasHalfStar ? '☆' : '') + '☆'.repeat(emptyStars);
	}
</script>

{#if style === 'badge'}
	<!-- Badge style for right-aligned placement -->
	<div
		class="rating-badge inline-flex items-center gap-1 {sizeConfig[size]
			.padding} rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/30"
	>
		{#if displayRating > 0}
			<div class="flex items-center gap-1">
				<span class="text-amber-500 {sizeConfig[size].starSize} leading-none">★</span>
				<span class="font-semibold text-amber-700 dark:text-amber-300 {sizeConfig[size].textSize}">
					{displayRating.toFixed(1)}
				</span>
				{#if ratingCount > 0}
					<span class="text-amber-600/70 dark:text-amber-400/70 {sizeConfig[size].textSize}">
						({ratingCount})
					</span>
				{/if}
			</div>
		{:else}
			<span class="text-gray-500 dark:text-gray-400 {sizeConfig[size].textSize}">No ratings</span>
		{/if}
	</div>
{:else if style === 'inline'}
	<!-- Inline style for horizontal layout -->
	<div class="rating-inline flex items-center gap-2">
		{#if displayRating > 0}
			<div class="flex items-center gap-1">
				{#each Array(5) as _, i}
					<span class="text-amber-400 {sizeConfig[size].starSize} leading-none">
						{i < displayRating ? '★' : '☆'}
					</span>
				{/each}
			</div>
			<div class="rating-text {sizeConfig[size].textSize} text-gray-600 dark:text-gray-300">
				<span class="font-medium">{displayRating.toFixed(1)}</span>
				{#if ratingCount > 0}
					<span class="text-gray-500 dark:text-gray-400">({ratingCount})</span>
				{/if}
			</div>
		{:else}
			<span class="text-gray-500 dark:text-gray-400 {sizeConfig[size].textSize}"
				>No ratings yet</span
			>
		{/if}
	</div>
{:else}
	<!-- Compact style (default) -->
	<div class="rating-compact">
		{#if displayRating > 0}
			<div class="flex items-center gap-1">
				<div class="flex items-center">
					<span class="text-amber-400 {sizeConfig[size].starSize} leading-none">★</span>
				</div>
				<span class="font-medium text-gray-700 dark:text-gray-200 {sizeConfig[size].textSize}">
					{displayRating.toFixed(1)}
				</span>
				{#if ratingCount > 0 && size !== 'sm'}
					<span class="text-gray-500 dark:text-gray-400 {sizeConfig[size].textSize}">
						({ratingCount})
					</span>
				{/if}
			</div>
		{:else}
			<span class="text-gray-500 dark:text-gray-400 {sizeConfig[size].textSize}">No ratings</span>
		{/if}
	</div>
{/if}

<style>
	.rating-badge {
		backdrop-filter: blur(8px);
		transition: all 0.2s ease;
	}

	.rating-badge:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(245, 158, 11, 0.15);
	}

	:global(.dark) .rating-badge {
		background: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.2);
	}
</style>
