<script lang="ts">
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { initAuth, authLoading } from '$lib/stores/authStore';
	import { api } from '$lib/utils/api';
	import { user } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabase';
	import { theme } from '$lib/stores/themeStore';
	import { onMount } from 'svelte';

	let authInitialized = false;

	// Initialize Supabase auth when the app loads
	onMount(async () => {
		try {
			// Initialize auth first and wait for it to complete
			await initAuth();
			authInitialized = true;

			// Initialize theme
			theme.init();
		} catch (error) {
			console.error('Failed to initialize app:', error);
			authInitialized = true; // Still show the app even if auth fails
		}
	});

	// Set up automatic auth token management
	user.subscribe(async ($user) => {
		if ($user) {
			try {
				// Get the current session token from Supabase
				const {
					data: { session }
				} = await supabase.auth.getSession();
				if (session?.access_token) {
					api.setAuthToken(session.access_token);
				} else {
					// Try to refresh the session if no token
					const { data: refreshData } = await supabase.auth.refreshSession();
					if (refreshData.session?.access_token) {
						api.setAuthToken(refreshData.session.access_token);
					}
				}
			} catch (error) {
				console.error('Error setting auth token:', error);
				// Clear the token on error
				api.setAuthToken(null);
			}
		} else {
			api.setAuthToken(null);
		}
	});
</script>

{#if authInitialized}
	<div class="app-layout">
		<!-- Global Navigation -->
		<Navigation />

		<!-- Main content -->
		<main class="main-content">
			<slot />
		</main>
	</div>

	<!-- Global Toast Container -->
	<ToastContainer />
{:else}
	<!-- Loading screen while auth initializes -->
	<div class="app-loading">
		<div class="loading-content">
			<div class="loading-spinner"></div>
			<p>Loading WhereAmI...</p>
		</div>
	</div>
{/if}

<style>
	:global(html, body) {
		height: 100%;
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	:global(*) {
		box-sizing: border-box;
	}

	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.main-content {
		flex: 1;
		background-color: var(--bg-secondary);
		transition: background-color 0.2s ease;
	}

	/* Leaflet map styles */
	:global(.leaflet-container) {
		height: 100%;
		width: 100%;
	}

	:global(.leaflet-popup-content-wrapper) {
		border-radius: 8px;
	}

	/* Custom game styling */
	:global(.game-container) {
		display: flex;
		flex-direction: column;
	}

	:global(.game-image) {
		object-fit: cover;
		border-radius: 8px;
	}

	/* Loading animations */
	:global(.fade-in) {
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.app-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background-color: var(--bg-primary, #ffffff);
	}

	.loading-content {
		text-align: center;
		color: var(--text-primary, #1f2937);
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--border-color, #e5e7eb);
		border-top: 3px solid var(--btn-primary-bg, #3b82f6);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 768px) {
		:global(.mobile-stack) {
			flex-direction: column;
		}
	}
</style>
