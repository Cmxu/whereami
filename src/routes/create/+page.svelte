<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		// Redirect to browse page with create tab
		goto('/browse#create');
	});
</script>

<svelte:head>
	<title>Create Game - WhereAmI</title>
	<meta name="description" content="Create custom geography games with your photos." />
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4">
	<div class="card max-w-md w-full text-center">
		<div class="text-blue-500 text-4xl mb-4">🎯</div>
		<h1 class="text-2xl font-bold text-gray-800 mb-4">Create Custom Game</h1>
		<p class="text-gray-600 mb-6">
			Redirecting to the game creation interface...
		</p>
		<div class="loading-spinner mx-auto mb-4"></div>
		<p class="text-sm text-gray-500">
			If you're not redirected automatically, <a href="/browse" class="text-blue-600 hover:text-blue-800">click here</a>
		</p>
	</div>
</div>
