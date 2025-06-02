<script lang="ts">
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { initAuth } from '$lib/stores/authStore';
	import { api } from '$lib/utils/api';
	import { user } from '$lib/stores/authStore';
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';

	// Initialize Supabase auth when the app loads
	onMount(() => {
		initAuth();
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
				}
			} catch (error) {
				console.error('Error setting auth token:', error);
			}
		} else {
			api.setAuthToken(null);
		}
	});
</script>

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
		background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
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

	@media (max-width: 768px) {
		:global(.mobile-stack) {
			flex-direction: column;
		}
	}
</style>
