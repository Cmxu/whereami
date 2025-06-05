<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, isAuthenticated, signOut, userStats, userProfile, displayName, loadUserProfile } from '$lib/stores/authStore';
	import { showSuccess, showError } from '$lib/stores/toastStore';
	import AuthButton from '$lib/components/AuthButton.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import ProfileEdit from '$lib/components/ProfileEdit.svelte';

	let showAuthModal = false;
	let showProfileEdit = false;
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

	function openProfileEdit() {
		showProfileEdit = true;
	}

	function closeProfileEdit() {
		showProfileEdit = false;
	}

	async function handleProfileUpdated() {
		// Reload the profile data after update
		await loadUserProfile();
		showSuccess('Profile updated successfully');
	}
</script>

<svelte:head>
	<title>Profile - WhereAmI</title>
</svelte:head>

<div class="profile-page min-h-screen" style="background-color: var(--bg-secondary);">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Header -->
		<div class="flex justify-between items-center mb-8">
			<div>
				<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Profile</h1>
				<p class="mt-1" style="color: var(--text-secondary);">Manage your account and view your stats</p>
			</div>
			<div class="flex items-center gap-4">
				<button on:click={() => goto('/')} class="btn-secondary"> ← Back to Home </button>
			</div>
		</div>

		{#if $isAuthenticated && $user}
			<!-- Profile Header -->
			<div class="rounded-xl shadow-sm p-6 mb-8" style="background-color: var(--bg-primary);">
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-6">
						<!-- Avatar -->
						<div class="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
							{#if $userProfile?.profilePicture}
								<img 
									src={`/api/images/${$userProfile.profilePicture}`} 
									alt="Profile" 
									class="w-full h-full object-cover"
								/>
							{:else}
								<div class="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold">
									{$user.user_metadata?.first_name?.[0] || $user.email?.[0]?.toUpperCase() || '?'}
								</div>
							{/if}
						</div>

						<!-- Profile Info -->
						<div class="flex-1">
							<h1 class="text-2xl font-bold" style="color: var(--text-primary);">
								{$displayName}
							</h1>
							<p class="text-lg" style="color: var(--text-secondary);">{$user.email}</p>
							<p class="text-sm mt-1" style="color: var(--text-tertiary);">
								Member since {new Date($user.created_at).toLocaleDateString()}
							</p>
						</div>
					</div>
					
					<!-- Edit Profile Button -->
					<button
						on:click={openProfileEdit}
						class="btn-secondary"
					>
						✏️ Edit Profile
					</button>
				</div>
			</div>

			<!-- Statistics Grid -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
				<div class="rounded-xl shadow-sm p-6" style="background-color: var(--bg-primary);">
					<div class="text-center">
						<div class="text-3xl font-bold text-blue-600 mb-2">{$userStats.imagesUploaded}</div>
						<div class="text-sm" style="color: var(--text-secondary);">Images Uploaded</div>
					</div>
				</div>
				<div class="rounded-xl shadow-sm p-6" style="background-color: var(--bg-primary);">
					<div class="text-center">
						<div class="text-3xl font-bold text-green-600 mb-2">{$userStats.gamesCreated}</div>
						<div class="text-sm" style="color: var(--text-secondary);">Games Created</div>
					</div>
				</div>
				<div class="rounded-xl shadow-sm p-6" style="background-color: var(--bg-primary);">
					<div class="text-center">
						<div class="text-3xl font-bold text-purple-600 mb-2">{$userStats.gamesPlayed}</div>
						<div class="text-sm" style="color: var(--text-secondary);">Games Played</div>
					</div>
				</div>
				<div class="rounded-xl shadow-sm p-6" style="background-color: var(--bg-primary);">
					<div class="text-center">
						<div class="text-3xl font-bold text-orange-600 mb-2">
							{$userStats.averageScore > 0 ? $userStats.averageScore.toFixed(0) : '0'}
						</div>
						<div class="text-sm" style="color: var(--text-secondary);">Average Score</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="rounded-xl shadow-sm p-6" style="background-color: var(--bg-primary);">
				<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Quick Actions</h3>
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
			<div class="rounded-xl shadow-sm p-6 mt-8 border border-red-200">
				<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Account Actions</h3>
				<button on:click={handleLogout} disabled={loading} class="btn-danger">
					{loading ? 'Signing out...' : 'Sign Out'}
				</button>
			</div>
		{:else}
			<!-- Not authenticated -->
			<div class="rounded-xl shadow-sm p-8 text-center" style="background-color: var(--bg-primary);">
				<div class="text-6xl mb-4">🔐</div>
				<h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">Sign In Required</h2>
				<p class="mb-6" style="color: var(--text-secondary);">You need to sign in to view your profile</p>
				<button on:click={handleLogin} class="btn-primary"> Sign In </button>
			</div>
		{/if}
	</div>
</div>

<!-- Authentication Modal -->
<AuthModal isOpen={showAuthModal} on:close={handleAuthModalClose} />

<!-- Profile Edit Modal -->
<ProfileEdit 
	isOpen={showProfileEdit}
	currentDisplayName={$userProfile?.displayName || $displayName}
	currentProfilePicture={$userProfile?.profilePicture}
	on:close={closeProfileEdit}
	on:updated={handleProfileUpdated}
/>
