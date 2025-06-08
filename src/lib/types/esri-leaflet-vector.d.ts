declare module 'esri-leaflet-vector' {
	export function vectorBasemapLayer(
		style: string,
		options?: { apikey?: string; token?: string }
	): any;
}
