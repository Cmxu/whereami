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

	// MAINTENANCE MODE - Set to true to enable maintenance mode
	const MAINTENANCE_MODE = false;

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
	<!-- Maintenance Mode Overlay -->
	{#if MAINTENANCE_MODE}
		<div class="maintenance-overlay">
			<div class="maintenance-content">
				<div class="maintenance-icon">🚧</div>
				<h1 class="maintenance-title">Currently Down for Development</h1>
				<p class="maintenance-message">
					We're working on some exciting updates to make WhereAmI even better!
					<br />
					Please check back soon.
				</p>
				<div class="maintenance-footer">
					<p class="maintenance-eta">Expected back online shortly</p>
				</div>
			</div>
		</div>
	{:else}
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
	{/if}
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
		--nav-height: 68px; /* Default fallback */
	}

	:global(body.game-active-no-scroll) {
		overflow: hidden;
		height: 100vh;
	}

	/* Game-specific layout adjustments */
	:global(body.game-active-no-scroll) .app-layout {
		height: 100vh;
		overflow: hidden;
	}

	:global(body.game-active-no-scroll) .main-content {
		height: calc(100vh - var(--nav-height, 68px));
		overflow: hidden;
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

	/* Maintenance Mode Styles */
	.maintenance-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 2rem;
	}

	.maintenance-content {
		text-align: center;
		color: white;
		max-width: 500px;
		width: 100%;
		animation: fadeInUp 0.8s ease-out;
	}

	.maintenance-icon {
		font-size: 4rem;
		margin-bottom: 1.5rem;
		animation: bounce 2s infinite;
	}

	.maintenance-title {
		font-size: 2.5rem;
		font-weight: bold;
		margin-bottom: 1.5rem;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.maintenance-message {
		font-size: 1.2rem;
		line-height: 1.6;
		margin-bottom: 2rem;
		opacity: 0.9;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.maintenance-footer {
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		padding-top: 1.5rem;
	}

	.maintenance-eta {
		font-size: 0.9rem;
		opacity: 0.8;
		font-style: italic;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes bounce {
		0%, 20%, 53%, 80%, 100% {
			transform: translate3d(0, 0, 0);
		}
		40%, 43% {
			transform: translate3d(0, -10px, 0);
		}
		70% {
			transform: translate3d(0, -5px, 0);
		}
		90% {
			transform: translate3d(0, -2px, 0);
		}
	}

	/* Mobile responsiveness for maintenance mode */
	@media (max-width: 768px) {
		.maintenance-title {
			font-size: 2rem;
		}
		
		.maintenance-message {
			font-size: 1.1rem;
		}
		
		.maintenance-icon {
			font-size: 3rem;
		}
	}
</style>
