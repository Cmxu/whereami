import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Vendor chunks - separate large libraries
					if (id.includes('node_modules')) {
						if (id.includes('leaflet') || id.includes('esri-leaflet')) {
							return 'leaflet';
						}
						if (id.includes('@supabase')) {
							return 'supabase';
						}
						if (id.includes('svelte')) {
							return 'svelte';
						}
						return 'vendor';
					}
					
					// Component chunks - group related components
					if (id.includes('GameRound.svelte') || 
						id.includes('GameResults.svelte') || 
						id.includes('GameRating.svelte') || 
						id.includes('GameLeaderboard.svelte')) {
						return 'gameComponents';
					}
					
					if (id.includes('Map.svelte')) {
						return 'mapComponents';
					}
					
					if (id.includes('AuthButton.svelte') || id.includes('AuthModal.svelte')) {
						return 'authComponents';
					}
					
					if (id.includes('UserGallery.svelte')) {
						return 'galleryComponents';
					}
				}
			}
		},
		chunkSizeWarningLimit: 1000 // Increase warning limit for large Leaflet bundle
	}
});
