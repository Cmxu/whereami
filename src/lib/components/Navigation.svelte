<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user, isAuthenticated, signOut, userProfile, displayName } from '$lib/stores/authStore';
	import { showSuccess, showError } from '$lib/stores/toastStore';
	import { isGameActive, saveGame } from '$lib/stores/gameStore';
	import AuthModal from './AuthModal.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { onMount } from 'svelte';

	let showAuthModal = false;
	let showUserMenu = false;

	async function handleLogout() {
		const result = await signOut();
		if (result.success) {
			showSuccess('Signed out successfully');
			showUserMenu = false;
		} else {
			showError('Failed to sign out');
		}
	}

	function handleLogin() {
		showAuthModal = true;
	}

	function handleProfileClick() {
		showUserMenu = false;
		goto('/profile');
	}

	function closeUserMenu() {
		showUserMenu = false;
	}

	function handleLogoClick(event: MouseEvent) {
		// If there's an active game, save it and navigate to home
		if ($isGameActive) {
			event.preventDefault();
			saveGame();
			goto('/');
		}
		// Otherwise, let the normal navigation happen
	}

	// Close user menu when clicking outside
	function handleOutsideClick(event: MouseEvent) {
		if (showUserMenu && !(event.target as Element).closest('.user-menu-container')) {
			showUserMenu = false;
		}
	}

	$: currentPath = $page.url.pathname;

	let navElement: HTMLElement;

	onMount(() => {
		// Set the actual navigation height as a CSS custom property
		if (navElement) {
			const updateNavHeight = () => {
				const height = navElement.offsetHeight;
				document.documentElement.style.setProperty('--nav-height', `${height}px`);
			};

			updateNavHeight();

			// Update on resize
			window.addEventListener('resize', updateNavHeight);
			return () => window.removeEventListener('resize', updateNavHeight);
		}
	});
</script>

<svelte:window on:click={handleOutsideClick} />

<nav bind:this={navElement} class="navigation bg-white shadow-sm border-b sticky top-0 z-40">
	<div class="nav-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="nav-content flex justify-between items-center h-16">
			<!-- Logo and primary navigation -->
			<div class="nav-left flex items-center space-x-8">
				<a
					href="/"
					class="nav-logo flex items-center space-x-2 text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
					on:click={handleLogoClick}
				>
					<span class="logo-icon">🌍</span>
					<span>WhereAmI</span>
				</a>

				<!-- Main navigation links -->
				<div class="nav-links hidden md:flex items-center space-x-6">
					<a href="/" class="nav-link {currentPath === '/' ? 'active' : ''}"> 🎮 Play </a>
					<a href="/gallery" class="nav-link {currentPath === '/gallery' ? 'active' : ''}">
						📸 Gallery
					</a>
					<a href="/browse" class="nav-link {currentPath === '/browse' ? 'active' : ''}">
						🔍 Browse
					</a>
					<a href="/create" class="nav-link {currentPath === '/create' ? 'active' : ''}">
						🎯 Create
					</a>
				</div>
			</div>

			<!-- User authentication section -->
			<div class="nav-right flex items-center space-x-4">
				<!-- Theme toggle -->
				<ThemeToggle />

				{#if $isAuthenticated && $user}
					<!-- Authenticated user menu -->
					<div class="user-menu-container relative">
						<button
							class="user-menu-trigger flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
							on:click={() => (showUserMenu = !showUserMenu)}
							aria-expanded={showUserMenu}
							aria-haspopup="true"
						>
							<!-- User Avatar with Profile Picture Support -->
							<div class="user-avatar w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
								{#if $userProfile?.profilePicture}
									<img
										src={`/api/images/${$userProfile.profilePicture}`}
										alt="Profile"
										class="w-full h-full object-cover"
									/>
								{:else}
									<div
										class="w-full h-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold"
									>
										{$user.user_metadata?.first_name?.[0] || $user.email?.[0]?.toUpperCase() || '?'}
									</div>
								{/if}
							</div>
							<span class="user-name hidden sm:block text-sm font-medium">
								{$displayName}
							</span>
							<svg
								class="user-menu-chevron w-4 h-4 transition-transform {showUserMenu
									? 'rotate-180'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{#if showUserMenu}
							<div class="user-menu absolute right-0 mt-2 w-64 rounded-lg shadow-lg py-2 z-50">
								<!-- User info header -->
								<div class="user-menu-header px-4 py-3 border-b">
									<div class="flex items-center space-x-3">
										<!-- User Avatar with Profile Picture Support -->
										<div class="user-avatar w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
											{#if $userProfile?.profilePicture}
												<img
													src={`/api/images/${$userProfile.profilePicture}`}
													alt="Profile"
													class="w-full h-full object-cover"
												/>
											{:else}
												<div
													class="w-full h-full bg-blue-600 flex items-center justify-center text-white font-semibold"
												>
													{$user.user_metadata?.first_name?.[0] ||
														$user.email?.[0]?.toUpperCase() ||
														'?'}
												</div>
											{/if}
										</div>
										<div>
											<div class="font-medium">
												{$displayName}
											</div>
											<div class="text-sm">{$user.email}</div>
										</div>
									</div>
								</div>

								<!-- Menu items -->
								<div class="user-menu-items py-1">
									<button
										class="user-menu-item w-full text-left px-4 py-2 text-sm flex items-center space-x-3"
										on:click={handleProfileClick}
									>
										<span>⚙️</span>
										<span>Profile & Settings</span>
									</button>
								</div>

								<div class="border-t py-1" style="border-color: var(--border-color);">
									<button
										class="user-menu-item w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
										on:click={handleLogout}
									>
										<span>🚪</span>
										<span>Sign Out</span>
									</button>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Sign in button for unauthenticated users -->
					<button
						class="sign-in-btn px-4 py-2 text-sm font-medium rounded-lg transition-colors"
						on:click={handleLogin}
					>
						Sign In
					</button>
				{/if}

				<!-- Mobile menu button (if needed later) -->
				<button
					class="mobile-menu-btn md:hidden p-2 rounded-lg transition-colors"
					aria-label="Open menu"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					</svg>
				</button>
			</div>
		</div>
	</div>
</nav>

<!-- Auth modal -->
<AuthModal bind:isOpen={showAuthModal} on:close={() => (showAuthModal = false)} />

<style>
	.navigation {
		backdrop-filter: blur(8px);
		background-color: var(--bg-primary);
		border-color: var(--border-color);
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
	}

	.nav-link {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		border-radius: 0.5rem;
		transition: all 0.2s ease;
	}

	.nav-link:hover {
		color: var(--text-primary);
		background-color: var(--bg-tertiary);
	}

	.nav-link.active {
		color: var(--btn-primary-bg);
		background-color: var(--blue-50);
	}

	:global(.dark) .nav-link.active {
		color: var(--blue-600);
		background-color: var(--blue-100);
	}

	.user-menu-trigger {
		background-color: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-color);
	}

	.user-menu-trigger:hover {
		background-color: var(--bg-tertiary);
	}

	.user-name {
		color: var(--text-secondary);
	}

	.user-menu-chevron {
		color: var(--text-tertiary);
		transition: transform 0.2s ease;
	}

	.user-menu {
		background-color: var(--bg-primary);
		border-color: var(--border-color);
		box-shadow: var(--shadow-lg);
		animation: fadeInDown 0.15s ease-out;
	}

	.user-menu-header {
		border-color: var(--border-color);
	}

	.user-menu-header .font-medium {
		color: var(--text-primary);
	}

	.user-menu-header .text-sm {
		color: var(--text-secondary);
	}

	.user-menu-item {
		color: var(--text-primary);
	}

	.user-menu-item:hover {
		background-color: var(--bg-tertiary);
	}

	.sign-in-btn {
		background-color: var(--btn-primary-bg);
		color: var(--btn-primary-text);
	}

	.sign-in-btn:hover {
		background-color: var(--btn-primary-hover);
	}

	.mobile-menu-btn {
		color: var(--text-secondary);
	}

	.mobile-menu-btn:hover {
		background-color: var(--bg-tertiary);
	}

	@keyframes fadeInDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 768px) {
		.nav-container {
			padding-left: 1rem;
			padding-right: 1rem;
		}

		.nav-left .nav-links {
			display: none;
		}

		.user-menu {
			right: -1rem;
			width: calc(100vw - 2rem);
			max-width: 16rem;
		}
	}
</style>
