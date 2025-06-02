<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, isAuthenticated, signOut, userStats } from '$lib/stores/authStore';
	import { showSuccess, showError } from '$lib/stores/toastStore';
	import AuthButton from '$lib/components/AuthButton.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';

	let showAuthModal = false;
	let loading = false;

	onMount(() => {
		// Redirect to home if not authenticated
		if (!$isAuthenticated) {
			showAuthModal = true;
		}
	});

	async function handleLogout() {
		loading = true;
		const result = await signOut();
		if (result.success) {
			showSuccess('Signed out successfully');
			goto('/');
		} else {
			showError('Failed to sign out');
		}
		loading = false;
	}

	function handleLogin() {
		showAuthModal = true;
	}

	function handleAuthModalClose() {
		showAuthModal = false;
		if (!$isAuthenticated) {
			goto('/');
		}
	}
</script>

<svelte:head>
	<title>Profile - WhereAmI</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<div class="container mx-auto px-4 py-8">
		<!-- Header -->
		<div class="flex justify-between items-center mb-8">
			<div>
				<h1 class="text-3xl font-bold text-gray-900">Profile</h1>
				<p class="text-gray-600 mt-1">Manage your account and view your stats</p>
			</div>
			<div class="flex items-center gap-4">
				<button on:click={() => goto('/')} class="btn-secondary"> ← Back to Home </button>
				{#if $isAuthenticated}
					<AuthButton on:logout={handleLogout} on:login={handleLogin} on:profile={() => {}} />
				{/if}
			</div>
		</div>

		{#if $isAuthenticated && $user}
			<!-- User Info -->
			<div class="bg-white rounded-xl shadow-sm p-6 mb-8">
				<div class="flex items-center gap-4">
					<div
						class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold"
					>
						{$user.user_metadata?.first_name?.[0] || $user.email?.[0]?.toUpperCase() || '?'}
					</div>
					<div>
						<h2 class="text-xl font-semibold text-gray-900">
							{$user.user_metadata?.full_name || $user.user_metadata?.first_name || 'User'}
						</h2>
						<p class="text-gray-600">{$user.email}</p>
						<p class="text-sm text-gray-500">
							Member since {new Date($user.created_at).toLocaleDateString()}
						</p>
					</div>
				</div>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<div class="bg-white rounded-xl shadow-sm p-6">
					<div class="text-2xl font-bold text-blue-600">{$userStats.imagesUploaded}</div>
					<div class="text-gray-600">Images Uploaded</div>
				</div>
				<div class="bg-white rounded-xl shadow-sm p-6">
					<div class="text-2xl font-bold text-green-600">{$userStats.gamesCreated}</div>
					<div class="text-gray-600">Games Created</div>
				</div>
				<div class="bg-white rounded-xl shadow-sm p-6">
					<div class="text-2xl font-bold text-purple-600">{$userStats.gamesPlayed}</div>
					<div class="text-gray-600">Games Played</div>
				</div>
				<div class="bg-white rounded-xl shadow-sm p-6">
					<div class="text-2xl font-bold text-orange-600">
						{$userStats.averageScore > 0 ? $userStats.averageScore.toFixed(0) : '0'}
					</div>
					<div class="text-gray-600">Average Score</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="bg-white rounded-xl shadow-sm p-6">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<button on:click={() => goto('/gallery?tab=upload')} class="btn-primary text-center">
						📸 Upload Photos
					</button>
					<button on:click={() => goto('/create')} class="btn-secondary text-center">
						🎮 Create Game
					</button>
					<button on:click={() => goto('/browse')} class="btn-secondary text-center">
						🌍 Browse Games
					</button>
				</div>
			</div>

			<!-- Danger Zone -->
			<div class="bg-white rounded-xl shadow-sm p-6 mt-8 border border-red-200">
				<h3 class="text-lg font-semibold text-red-900 mb-4">Account Actions</h3>
				<button on:click={handleLogout} disabled={loading} class="btn-danger">
					{loading ? 'Signing out...' : 'Sign Out'}
				</button>
			</div>
		{:else}
			<!-- Not authenticated -->
			<div class="bg-white rounded-xl shadow-sm p-8 text-center">
				<div class="text-6xl mb-4">🔐</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
				<p class="text-gray-600 mb-6">You need to sign in to view your profile</p>
				<button on:click={handleLogin} class="btn-primary"> Sign In </button>
			</div>
		{/if}
	</div>
</div>

<!-- Authentication Modal -->
<AuthModal isOpen={showAuthModal} on:close={handleAuthModalClose} />
