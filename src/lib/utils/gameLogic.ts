import type { Location, GuessResult } from '$lib/types';

// Game constants
const MAX_SCORE = 10000; // Maximum score per round
const MIN_DISTANCE = 0.01; // 10 meters (in km) - full points threshold
const MAX_DISTANCE = 5000; // 5000 km - zero points threshold

/**
 * Calculate distance between two points using Haversine formula
 * This calculates the great-circle distance between two points on a sphere
 */
export const calculateDistance = (point1: Location, point2: Location): number => {
	// Convert latitude and longitude from degrees to radians
	const toRad = (value: number) => (value * Math.PI) / 180;

	// Earth's radius in kilometers
	const R = 6371;

	// Calculate differences in coordinates
	const dLat = toRad(point2.lat - point1.lat);
	const dLng = toRad(point2.lng - point1.lng);

	// Haversine formula
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(point1.lat)) *
			Math.cos(toRad(point2.lat)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	// Distance in kilometers, rounded to 2 decimal places
	return Math.round(R * c * 100) / 100;
};

/**
 * Optimized score calculation with steep drop-off curve
 */
export const calculateScore = (distance: number): number => {
	if (distance <= MIN_DISTANCE) return MAX_SCORE;
	if (distance >= MAX_DISTANCE) return 0;

	// Simplified exponential decay for better performance
	const normalizedDistance = distance / MAX_DISTANCE;
	return Math.round(MAX_SCORE * Math.exp(-5 * normalizedDistance));
};

/**
 * Format distance for display (meters if < 500m, km otherwise)
 */
export const formatDistance = (distance: number): string => {
	if (distance < 0.5) {
		// Less than 500 meters (0.5 km)
		// Convert to meters and round to nearest meter
		const meters = Math.round(distance * 1000);
		return `${meters} m`;
	} else {
		// Keep in kilometers with 2 decimal precision
		return `${distance.toFixed(2)} km`;
	}
};

/**
 * Process a user's guess and return the result
 */
export const processGuess = (
	userGuess: Location,
	actualLocation: Location,
	isLastRound: boolean
): GuessResult => {
	const distance = calculateDistance(userGuess, actualLocation);
	const score = calculateScore(distance);
	const formattedDistance = formatDistance(distance);

	return {
		userGuess,
		score,
		distance,
		formattedDistance,
		isLastRound
	};
};

/**
 * Generate a random game ID
 */
export const generateGameId = (): string => {
	return Math.random().toString(36).substr(2, 9);
};

/**
 * Generate a random session ID
 */
export const generateSessionId = (): string => {
	return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Calculate total score from rounds
 */
export const calculateTotalScore = (rounds: { score: number }[]): number => {
	return rounds.reduce((sum, round) => sum + round.score, 0);
};

/**
 * Get performance rating based on score
 */
export const getPerformanceRating = (score: number, maxPossible: number): string => {
	const percentage = (score / maxPossible) * 100;

	if (percentage >= 90) return 'Excellent';
	if (percentage >= 75) return 'Great';
	if (percentage >= 60) return 'Good';
	if (percentage >= 40) return 'Fair';
	return 'Keep trying!';
};

/**
 * Calculate intermediate points along the great-circle path between two locations
 * This creates a geodesic line that matches the shortest distance calculation
 */
export const calculateGeodesicPath = (
	point1: Location,
	point2: Location,
	numPoints: number = 50
): Location[] => {
	console.log('calculateGeodesicPath called with:', point1, point2, numPoints);

	const toRad = (value: number) => (value * Math.PI) / 180;
	const toDeg = (value: number) => (value * 180) / Math.PI;

	const lat1 = toRad(point1.lat);
	const lng1 = toRad(point1.lng);
	const lat2 = toRad(point2.lat);
	const lng2 = toRad(point2.lng);

	// Calculate the angular distance using the same formula as calculateDistance
	const dLat = lat2 - lat1;
	const dLng = lng2 - lng1;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	console.log('Angular distance (d):', d, 'radians');

	const points: Location[] = [];

	// Handle edge case: if points are very close or identical
	if (d < 0.0001) {
		console.log('Points too close, returning simple line');
		return [point1, point2];
	}

	for (let i = 0; i <= numPoints; i++) {
		const f = i / numPoints;

		if (f === 0) {
			points.push(point1);
			continue;
		}
		if (f === 1) {
			points.push(point2);
			continue;
		}

		// Use proper great circle interpolation
		// For trans-Pacific routes, we need to handle the shorter path over the Pacific
		let dLng2 = lng2 - lng1;

		// Handle crossing the antimeridian (date line)
		if (Math.abs(dLng2) > Math.PI) {
			if (dLng2 > 0) {
				dLng2 = dLng2 - 2 * Math.PI;
			} else {
				dLng2 = dLng2 + 2 * Math.PI;
			}
		}

		// Calculate intermediate point using bearing and distance
		const bearing = Math.atan2(
			Math.sin(dLng2) * Math.cos(lat2),
			Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng2)
		);

		const intermediateDistance = d * f;

		// Calculate intermediate point
		const lat = Math.asin(
			Math.sin(lat1) * Math.cos(intermediateDistance) +
				Math.cos(lat1) * Math.sin(intermediateDistance) * Math.cos(bearing)
		);

		let lng =
			lng1 +
			Math.atan2(
				Math.sin(bearing) * Math.sin(intermediateDistance) * Math.cos(lat1),
				Math.cos(intermediateDistance) - Math.sin(lat1) * Math.sin(lat)
			);

		// Normalize longitude
		lng = ((lng + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

		points.push({
			lat: toDeg(lat),
			lng: toDeg(lng)
		});
	}

	console.log('Returning geodesic path with', points.length, 'points');
	console.log(
		'Sample points:',
		points.slice(0, 5).map((p) => `(${p.lat.toFixed(2)}, ${p.lng.toFixed(2)})`)
	);

	return points;
};
