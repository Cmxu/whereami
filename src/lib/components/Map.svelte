<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import type { Location } from '$lib/types';
	import {
		calculateGeodesicPath,
		normalizeLongitude,
		findOptimalActualLocation
	} from '$lib/utils/gameLogic';

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
	let currentBasemapLayer: any = null;
	let isSatelliteMode = false;
	let esriLeaflet: any;
	let esriVector: any;
	let apiKey: string;
	let mapLanguage: string;
	let webglCapabilities: any;

	function createClickHandler() {
		return (e: any) => {
			const location: Location = {
				lat: Math.round(e.latlng.lat * 1000000) / 1000000, // Round to 6 decimal places
				lng: Math.round(e.latlng.lng * 1000000) / 1000000 // Keep original longitude (don't normalize for UX)
			};
			dispatch('mapClick', location);
		};
	}

	/**
	 * Normalize marker positions to handle antimeridian crossing
	 * This ensures markers are placed on the correct world copy for optimal distance display
	 */
	function normalizeMarkersForDisplay(
		inputMarkers: Array<{
			location: Location;
			popup?: string;
			type?: 'guess' | 'actual' | 'custom';
		}>
	): Array<{
		location: Location;
		popup?: string;
		type?: 'guess' | 'actual' | 'custom';
	}> {
		if (inputMarkers.length < 2) return inputMarkers;

		// Find guess and actual markers
		const guessMarker = inputMarkers.find((m: any) => m.type === 'guess');
		const actualMarker = inputMarkers.find((m: any) => m.type === 'actual');

		if (!guessMarker || !actualMarker) return inputMarkers;

		// Find optimal actual location relative to guess for distance calculation
		const optimalActual = findOptimalActualLocation(guessMarker.location, actualMarker.location);

		// Return markers with proper positioning
		return inputMarkers.map((marker: any) => {
			if (marker.type === 'actual') {
				// Place actual marker in optimal location for shortest distance display
				return {
					...marker,
					location: optimalActual
				};
			} else if (marker.type === 'guess') {
				// During results display (when showDistanceLine is true), move guess pin to optimal location
				// During guessing phase, keep pin where user clicked for better UX
				if (showDistanceLine) {
					// Results phase: position both pins optimally for best distance line visualization
					const optimalGuess = findOptimalActualLocation(optimalActual, guessMarker.location);
					return {
						...marker,
						location: optimalGuess
					};
				} else {
					// Guessing phase: keep guess marker where user actually clicked
					return marker;
				}
			} else {
				// For other markers, normalize to prevent edge cases
				return {
					...marker,
					location: {
						lat: marker.location.lat,
						lng: normalizeLongitude(marker.location.lng)
					}
				};
			}
		});
	}

	// Function to check WebGL capabilities and limitations
	function checkWebGLCapabilities(): {
		hasWebGL: boolean;
		maxVertexAttribs: number;
		supportsComplexVectors: boolean;
		supportsUint32Indices: boolean;
		maxTextureSize: number;
	} {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

			if (!gl) {
				return {
					hasWebGL: false,
					maxVertexAttribs: 0,
					supportsComplexVectors: false,
					supportsUint32Indices: false,
					maxTextureSize: 0
				};
			}

			// Type assertion for WebGL context
			const webglContext = gl as WebGLRenderingContext;
			const maxVertexAttribs = webglContext.getParameter(webglContext.MAX_VERTEX_ATTRIBS);
			const maxTextureSize = webglContext.getParameter(webglContext.MAX_TEXTURE_SIZE);

			// Check for OES_element_index_uint extension (allows 32-bit indices up to 4.3 billion)
			const uintExtension = webglContext.getExtension('OES_element_index_uint');
			const supportsUint32Indices = !!uintExtension;

			// Consider complex vectors safe if we have decent WebGL support AND 32-bit indices
			const supportsComplexVectors = maxVertexAttribs >= 16 && supportsUint32Indices;

			// Only log WebGL extension details in development
			if (import.meta.env.DEV) {
				console.log('WebGL Extensions Available:', {
					OES_element_index_uint: supportsUint32Indices,
					maxVertexAttribs,
					maxTextureSize
				});
			}

			canvas.remove();
			return {
				hasWebGL: true,
				maxVertexAttribs,
				supportsComplexVectors,
				supportsUint32Indices,
				maxTextureSize
			};
		} catch (error) {
			console.warn('WebGL capability check failed:', error);
			return {
				hasWebGL: false,
				maxVertexAttribs: 0,
				supportsComplexVectors: false,
				supportsUint32Indices: false,
				maxTextureSize: 0
			};
		}
	}

	// Function to switch between outdoor and satellite basemaps
	function toggleBasemapMode() {
		if (!map || !isMapReady) return;

		isSatelliteMode = !isSatelliteMode;

		// Remove current basemap layer
		if (currentBasemapLayer && map.hasLayer(currentBasemapLayer)) {
			map.removeLayer(currentBasemapLayer);
		}

		// Add new basemap based on mode
		loadBasemap(isSatelliteMode ? 'satellite' : 'outdoor');
	}

	// Function to load a specific basemap type
	function loadBasemap(basemapType: 'outdoor' | 'satellite') {
		if (!map || !esriLeaflet || !esriVector) return;

		const useVectorBasemap = webglCapabilities.supportsComplexVectors;
		const basemapStyle = basemapType === 'satellite' ? 'arcgis/imagery' : 'arcgis/outdoor';
		const rasterBasemap = basemapType === 'satellite' ? 'Imagery' : 'Streets';

		try {
			if (useVectorBasemap) {
				// Use vector basemap with optimizations
				const layerOptions: any = {
					token: apiKey,
					language: mapLanguage,
					maxNativeZoom: 15,
					tileSize: 512,
					updateWhenIdle: true,
					keepBuffer: 2
				};

				currentBasemapLayer = esriVector.vectorBasemapLayer(basemapStyle, layerOptions);

				// Add error handling for WebGL issues
				currentBasemapLayer.on('error', (e: any) => {
					const errorMessage = e.toString().toLowerCase();
					const isVertexLimitError =
						errorMessage.includes('vertex') ||
						errorMessage.includes('vertices') ||
						errorMessage.includes('65535') ||
						errorMessage.includes('buffer');

					if (!isVertexLimitError && import.meta.env.DEV) {
						console.warn('Vector basemap error detected, falling back to raster basemap:', e);
					}

					if (map.hasLayer(currentBasemapLayer)) {
						map.removeLayer(currentBasemapLayer);
					}

					// Fallback to raster basemap
					try {
						currentBasemapLayer = esriLeaflet.basemapLayer(rasterBasemap, {
							token: apiKey
						});
						currentBasemapLayer.addTo(map);

						if (import.meta.env.DEV) {
							console.log(
								`Switched to raster ${basemapType} basemap due to vector rendering issues`
							);
						}
					} catch (rasterError) {
						if (import.meta.env.DEV) {
							console.warn('Raster basemap also failed:', rasterError);
						}
					}
				});

				currentBasemapLayer.addTo(map);

				if (import.meta.env.DEV) {
					console.log(`Loaded vector ${basemapType} basemap with language: ${mapLanguage}`);
				}
			} else {
				// Use raster basemap for devices with limited WebGL capabilities
				currentBasemapLayer = esriLeaflet.basemapLayer(rasterBasemap, {
					token: apiKey
				});
				currentBasemapLayer.addTo(map);

				if (import.meta.env.DEV) {
					console.log(`Loaded raster ${basemapType} basemap due to limited WebGL capabilities`);
				}
			}
		} catch (error) {
			if (import.meta.env.DEV) {
				console.warn(`Failed to load ${basemapType} basemap:`, error);
			}
		}
	}

	// Function to detect browser language and map to supported Esri language codes
	function getMapLanguage(): string {
		// Get browser language
		const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
		const langCode = browserLang.toLowerCase().split('-')[0];

		// Map of common browser language codes to Esri supported language codes
		const supportedLanguages: Record<string, string> = {
			ar: 'ar', // Arabic
			bg: 'bg', // Bulgarian
			bs: 'bs', // Bosnian
			ca: 'ca', // Catalan
			cs: 'cs', // Czech
			da: 'da', // Danish
			de: 'de', // German
			el: 'el', // Greek
			en: 'en', // English
			es: 'es', // Spanish
			et: 'et', // Estonian
			fi: 'fi', // Finnish
			fr: 'fr', // French
			he: 'he', // Hebrew
			hr: 'hr', // Croatian
			hu: 'hu', // Hungarian
			id: 'id', // Indonesian
			it: 'it', // Italian
			ja: 'ja', // Japanese
			ko: 'ko', // Korean
			lt: 'lt', // Lithuanian
			lv: 'lv', // Latvian
			nb: 'nb', // Norwegian Bokmål
			nl: 'nl', // Dutch
			pl: 'pl', // Polish
			pt: 'pt', // Portuguese
			ro: 'ro', // Romanian
			ru: 'ru', // Russian
			sk: 'sk', // Slovak
			sl: 'sl', // Slovenian
			sr: 'sr', // Serbian
			sv: 'sv', // Swedish
			th: 'th', // Thai
			tr: 'tr', // Turkish
			uk: 'uk', // Ukrainian
			vi: 'vi', // Vietnamese
			zh: 'zh' // Chinese
		};

		// Return supported language or default to English
		return supportedLanguages[langCode] || 'en';
	}

	onMount(async () => {
		try {
			// Suppress common WebGL warnings in production
			if (!import.meta.env.DEV) {
				const originalWarn = console.warn;
				console.warn = (...args) => {
					const message = args.join(' ').toLowerCase();
					// Suppress known WebGL vertex limit warnings that we handle gracefully
					if (
						message.includes('vertex') &&
						(message.includes('65535') || message.includes('buffer'))
					) {
						return; // Suppress the warning
					}
					if (message.includes('webgl') && message.includes('performance')) {
						return; // Suppress WebGL performance warnings
					}
					originalWarn.apply(console, args);
				};
			}

			// Dynamically import Leaflet and Esri Leaflet to avoid SSR issues
			const leaflet = await import('leaflet');
			esriLeaflet = await import('esri-leaflet');
			esriVector = await import('esri-leaflet-vector');
			L = leaflet.default;

			// Import Leaflet CSS
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
			document.head.appendChild(link);

			// Set up RTL language support for Arabic and Hebrew
			try {
				// RTL text plugin support for Arabic and Hebrew
				const esriVectorAny = esriVector as any;
				if (esriVectorAny.setRTLTextPlugin) {
					esriVectorAny.setRTLTextPlugin(
						'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.js'
					);
				}
			} catch (error) {
				console.warn('RTL text plugin not available:', error);
			}

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

			// Initialize global variables for basemap management
			apiKey = import.meta.env.VITE_ESRI_API_KEY;
			mapLanguage = getMapLanguage();
			webglCapabilities = checkWebGLCapabilities();

			// Only log detailed WebGL info in development
			if (import.meta.env.DEV) {
				console.log('WebGL capabilities:', webglCapabilities);

				if (webglCapabilities.supportsUint32Indices) {
					console.log(
						'✅ Device supports 32-bit indices (up to 4.3 billion vertices via OES_element_index_uint)'
					);
				} else {
					console.log('⚠️  Device limited to 16-bit indices (max 65,535 vertices per segment)');
				}
			}

			// Load initial outdoor basemap
			loadBasemap('outdoor');

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

		// Normalize markers for proper antimeridian handling
		const normalizedMarkers = normalizeMarkersForDisplay(markers);

		let guessMarker: any = null;
		let actualMarker: any = null;

		// Add new markers
		normalizedMarkers.forEach((marker) => {
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

			// With worldCopyJump enabled, Leaflet should handle antimeridian crossing automatically
			distanceLine = L.polyline([guessLatLng, actualLatLng], {
				color: '#f59e0b',
				weight: 3,
				opacity: 0.8,
				dashArray: '10, 5'
			}).addTo(map);

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

	<!-- Satellite mode toggle button -->
	{#if isMapReady}
		<button
			class="satellite-toggle-btn"
			on:click={toggleBasemapMode}
			title={isSatelliteMode ? 'Switch to street view' : 'Switch to satellite view'}
		>
			{#if isSatelliteMode}
				<!-- Map icon for street view -->
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
				</svg>
			{:else}
				<!-- Mountain icon for satellite view -->
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="m8 3 4 8 5-5 5 15H2L8 3z"></path>
				</svg>
			{/if}
		</button>
	{/if}
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

	/* Satellite toggle button */
	.satellite-toggle-btn {
		position: absolute;
		top: 84px; /* Position below zoom controls */
		right: 12px; /* Align with zoom controls */
		z-index: 1000;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 4px;
		padding: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		color: #374151;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		user-select: none;
	}

	.satellite-toggle-btn:hover {
		background: rgba(255, 255, 255, 1);
		transform: translateY(-1px);
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15);
	}

	.satellite-toggle-btn:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.satellite-toggle-btn svg {
		flex-shrink: 0;
	}

	/* Dark mode support for toggle button */
	@media (prefers-color-scheme: dark) {
		.satellite-toggle-btn {
			background: rgba(31, 41, 55, 0.95);
			color: #f3f4f6;
			border-color: rgba(255, 255, 255, 0.1);
		}

		.satellite-toggle-btn:hover {
			background: rgba(31, 41, 55, 1);
		}
	}

	/* Mobile optimizations for toggle button */
	@media (max-width: 768px) {
		.satellite-toggle-btn {
			top: 80px; /* Adjust for mobile spacing */
			right: 8px;
			width: 30px;
			height: 30px;
			padding: 5px;
		}

		.satellite-toggle-btn svg {
			width: 14px;
			height: 14px;
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
