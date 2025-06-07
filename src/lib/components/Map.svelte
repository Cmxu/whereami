<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Location } from '$lib/types';
	import { calculateGeodesicPath } from '$lib/utils/gameLogic';

	export let center: Location = { lat: 10, lng: 0 };
	export let zoom: number = 2;
	export let clickable: boolean = true;
	export let markers: Array<{
		location: Location;
		popup?: string;
		type?: 'guess' | 'actual' | 'custom';
	}> = [];
	export let height: string = '400px';
	export let showDistanceLine: boolean = false;
	export let isLoading: boolean = false;
	export let forceSquare: boolean = false;

	const dispatch = createEventDispatcher<{
		mapClick: Location;
		mapReady: void;
	}>();

	let mapContainer: HTMLDivElement;
	let map: any;
	let L: any;
	let markerLayer: any;
	let distanceLine: any;
	let isMapReady = false;
	let clickHandler: any = null;

	function createClickHandler() {
		return (e: any) => {
			const location: Location = {
				lat: Math.round(e.latlng.lat * 1000000) / 1000000, // Round to 6 decimal places
				lng: Math.round(e.latlng.lng * 1000000) / 1000000
			};
			dispatch('mapClick', location);
		};
	}

	onMount(async () => {
		try {
			// Dynamically import Leaflet to avoid SSR issues
			const leaflet = await import('leaflet');
			L = leaflet.default;

			// Import Leaflet CSS
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);

			// Initialize the map
			map = L.map(mapContainer, {
				center: [center.lat, center.lng],
				zoom: zoom,
				minZoom: 1, // Prevent excessive zoom out
				zoomControl: false, // Disable default zoom control
				attributionControl: false,
				preferCanvas: true, // Better performance on mobile
				worldCopyJump: true // Handle antimeridian crossing automatically
			});

			// Add custom zoom control positioned at top right
			L.control
				.zoom({
					position: 'topright'
				})
				.addTo(map);

			// Add tile layer (OpenStreetMap)
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 18,
				tileSize: 256,
				zoomOffset: 0
			}).addTo(map);

			// Create a layer group for markers
			markerLayer = L.layerGroup().addTo(map);

			// Create the click handler
			clickHandler = createClickHandler();

			// Map ready event
			map.whenReady(() => {
				isMapReady = true;
				dispatch('mapReady');
				updateMarkers();
			});
		} catch (error) {
			console.error('Failed to initialize map:', error);
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
		}
	});

	function createCustomMarkerIcon(type: string = 'custom', color: string = '#3b82f6') {
		if (!L) return null;

		const iconHtml =
			type === 'guess'
				? `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`
				: type === 'actual'
					? `<div style="background-color: ${color}; width: 25px; height: 25px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">✓</div>`
					: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>`;

		// Different anchor points for different marker types
		const iconAnchor =
			type === 'guess'
				? [12, 22] // For guess markers (teardrop), anchor at the tip (bottom point)
				: [12, 12]; // For other markers (circles), anchor at center

		const popupAnchor =
			type === 'guess'
				? [0, -22] // Position popup above the tip for guess markers
				: [0, -12]; // Position popup above center for other markers

		return L.divIcon({
			html: iconHtml,
			className: 'custom-marker-icon',
			iconSize: [25, 25],
			iconAnchor: iconAnchor,
			popupAnchor: popupAnchor
		});
	}

	function updateMarkers() {
		if (!map || !L || !markerLayer || !isMapReady) return;

		// Clear existing markers
		markerLayer.clearLayers();

		// Clear existing distance line
		if (distanceLine) {
			map.removeLayer(distanceLine);
			distanceLine = null;
		}

		let guessMarker: any = null;
		let actualMarker: any = null;

		// Add new markers
		markers.forEach((marker) => {
			const markerType = marker.type || 'custom';
			const color =
				markerType === 'guess' ? '#ef4444' : markerType === 'actual' ? '#22c55e' : '#3b82f6';
			const icon = createCustomMarkerIcon(markerType, color);

			const leafletMarker = L.marker([marker.location.lat, marker.location.lng], {
				icon: icon,
				riseOnHover: true
			}).addTo(markerLayer);

			if (marker.popup) {
				leafletMarker.bindPopup(marker.popup, {
					offset: [0, -12],
					className: 'custom-popup'
				});
			}

			// Store markers for distance line
			if (markerType === 'guess') {
				guessMarker = leafletMarker;
			} else if (markerType === 'actual') {
				actualMarker = leafletMarker;
			}
		});

		// Draw distance line if both markers exist and showDistanceLine is true
		if (showDistanceLine && guessMarker && actualMarker) {
			const guessLatLng = guessMarker.getLatLng();
			const actualLatLng = actualMarker.getLatLng();

			console.log(
				'Drawing line with worldCopyJump enabled:',
				'Guess:',
				{ lat: guessLatLng.lat, lng: guessLatLng.lng },
				'Actual:',
				{ lat: actualLatLng.lat, lng: actualLatLng.lng }
			);

			// With worldCopyJump enabled, Leaflet should handle antimeridian crossing automatically
			distanceLine = L.polyline([guessLatLng, actualLatLng], {
				color: '#f59e0b',
				weight: 3,
				opacity: 0.8,
				dashArray: '10, 5'
			}).addTo(map);

			console.log('Polyline created with worldCopyJump handling');

			// Fit bounds to show both markers and the line
			const group = L.featureGroup([guessMarker, actualMarker, distanceLine]);
			map.fitBounds(group.getBounds(), { padding: [20, 20] });
		}
	}

	// React to prop changes
	$: if (map && center && isMapReady) {
		map.setView([center.lat, center.lng], zoom);
	}

	$: if (map && markers && isMapReady) {
		updateMarkers();
	}

	// Handle clickable prop changes
	$: if (map && clickHandler && isMapReady) {
		// Remove existing click handler
		map.off('click', clickHandler);

		// Add click handler if clickable
		if (clickable) {
			map.on('click', clickHandler);
		}
	}

	// Function to reset map view to initial position
	export function resetMapView() {
		if (map) {
			map.setView([center.lat, center.lng], zoom);
		}
	}

	// Function to invalidate map size (for dynamic resizing)
	export function invalidateSize() {
		if (map) {
			setTimeout(() => {
				map.invalidateSize();
			}, 100);
		}
	}

	// Function to get current map view state
	export function getCurrentView() {
		if (map) {
			const center = map.getCenter();
			const zoom = map.getZoom();
			return {
				center: { lat: center.lat, lng: center.lng },
				zoom: zoom
			};
		}
		return null;
	}

	// Function to set map view state
	export function setView(center: Location, zoom: number) {
		if (map) {
			map.setView([center.lat, center.lng], zoom);
		}
	}
</script>

<div
	class="map-wrapper"
	style={forceSquare ? `width: ${height}; height: ${height};` : `height: ${height};`}
>
	{#if isLoading}
		<div class="map-loading">
			<div class="loading-spinner"></div>
			<p class="loading-text">Loading map...</p>
		</div>
	{/if}
	<div bind:this={mapContainer} class="map-container" class:map-hidden={isLoading}></div>
</div>

<style>
	.map-wrapper {
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		position: relative;
		background: rgba(255, 255, 255, 0.1); /* Much more transparent */
	}

	.map-container {
		width: 100%;
		height: 100%;
		transition: opacity 0.3s ease;
		min-width: 300px; /* Ensure minimum width for small maps */
		min-height: 250px; /* Ensure minimum height for small maps */
		background: transparent; /* Ensure container is transparent */
	}

	.map-hidden {
		opacity: 0;
	}

	.map-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: rgba(248, 250, 252, 0.3); /* Much more transparent loading background */
		z-index: 1000;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #e2e8f0;
		border-top: 4px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 12px;
	}

	.loading-text {
		color: #64748b;
		font-size: 14px;
		font-weight: 500;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Custom marker styles */
	:global(.custom-marker-icon) {
		background: none !important;
		border: none !important;
	}

	:global(.custom-popup .leaflet-popup-content-wrapper) {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 8px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	:global(.custom-popup .leaflet-popup-content) {
		margin: 12px 16px;
		font-size: 14px;
		line-height: 1.4;
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.map-wrapper {
			border-radius: 0;
			box-shadow: none;
		}

		:global(.leaflet-control-zoom) {
			transform: scale(1.2);
		}

		:global(.leaflet-popup-content-wrapper) {
			max-width: 250px;
		}
	}

	/* Touch improvements for mobile */
	@media (hover: none) and (pointer: coarse) {
		.map-container {
			touch-action: pan-x pan-y;
		}
	}

	/* Ensure leaflet containers are transparent */
	:global(.leaflet-container) {
		background: rgba(255, 255, 255, 0.05) !important; /* Very transparent background */
	}

	:global(.leaflet-tile-pane) {
		opacity: 0.95; /* Slightly transparent tiles */
	}
</style>
