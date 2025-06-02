<script lang="ts">
	import { isAuthenticated, userName, user } from '$lib/stores/authStore';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		login: void;
		logout: void;
		profile: void;
	}>();

	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let variant: 'primary' | 'secondary' | 'outline' = 'primary';

	const sizeClasses = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2 text-base',
		lg: 'px-6 py-3 text-lg'
	};

	const variantClasses = {
		primary: 'bg-blue-600 hover:bg-blue-700 text-white',
		secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
		outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white'
	};

	function handleLogin() {
		dispatch('login');
	}

	function handleLogout() {
		dispatch('logout');
	}

	function handleProfile() {
		dispatch('profile');
	}
</script>

{#if $isAuthenticated}
	<div class="flex items-center gap-2">
		<div class="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
			<!-- User Avatar -->
			<div
				class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold"
			>
				{$user?.user_metadata?.first_name?.[0] || $user?.email?.[0]?.toUpperCase() || '?'}
			</div>
			<span class="text-sm font-medium text-gray-700 hidden sm:inline">
				{$userName}
			</span>
		</div>

		<button
			on:click={handleProfile}
			class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
			title="Profile"
		>
			⚙️
		</button>

		<button
			on:click={handleLogout}
			class="{sizeClasses[
				size
			]} rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-700 text-white"
		>
			Sign Out
		</button>
	</div>
{:else}
	<button
		on:click={handleLogin}
		class="{sizeClasses[size]} {variantClasses[variant]} rounded-lg font-medium transition-colors"
	>
		Sign In
	</button>
{/if}
