<script lang="ts">
	import { theme, type Theme } from '$lib/stores/themeStore';
	import { onMount } from 'svelte';

	let currentTheme: Theme;

	// Subscribe to theme changes
	theme.subscribe((value) => {
		currentTheme = value;
	});

	onMount(() => {
		// Initialize theme
		const cleanup = theme.init();
		return cleanup;
	});

	function toggleTheme() {
		theme.toggleTheme();
	}
</script>

<button
	class="theme-toggle-btn flex items-center justify-center p-2 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
	on:click={toggleTheme}
	aria-label="Toggle {currentTheme === 'light' ? 'dark' : 'light'} mode"
	title={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
	{#if currentTheme === 'light'}
		<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	{:else}
		<svg class="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
			<path
				d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"
			/>
		</svg>
	{/if}
</button>

<style>
	.theme-toggle-btn {
		background-color: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.theme-toggle-btn:hover {
		background-color: var(--bg-tertiary);
	}
</style>
