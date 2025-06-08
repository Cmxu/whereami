import type { Location, GuessResult } from '$lib/types';

// Game constants
const MAX_SCORE = 10000; // Maximum score per round
const MIN_DISTANCE = 0.025; // 10 meters (in km) - full points threshold
const MAX_DISTANCE = 5000; // 5000 km - zero points threshold

/**
 * Normalize longitude to [-180, 180] range
 */
export const normalizeLongitude = (lng: number): number => {
	while (lng > 180) lng -= 360;
	while (lng < -180) lng += 360;
	return lng;
};

/**
 * Calculate shortest longitude difference considering antimeridian crossing
 */
export const calculateLongitudeDifference = (lng1: number, lng2: number): number => {
	const diff = lng2 - lng1;
	
	// If difference is greater than 180°, the shortest path crosses the antimeridian
	if (Math.abs(diff) > 180) {
		return diff > 0 ? diff - 360 : diff + 360;
	}
	
	return diff;
};

/**
 * Find the optimal actual location that minimizes distance to the guess
 * This handles antimeridian crossing edge cases by considering both possible locations
 */
export const findOptimalActualLocation = (guess: Location, actual: Location): Location => {
	// Normalize both coordinates
	const normalizedGuess: Location = {
		lat: guess.lat,
		lng: normalizeLongitude(guess.lng)
	};
	
	const normalizedActual: Location = {
		lat: actual.lat,
		lng: normalizeLongitude(actual.lng)
	};
	
	// For antimeridian crossing cases, check both possible actual locations
	const actualEast: Location = {
		lat: normalizedActual.lat,
		lng: normalizedActual.lng >= 0 ? normalizedActual.lng : normalizedActual.lng + 360
	};
	
	const actualWest: Location = {
		lat: normalizedActual.lat,
		lng: normalizedActual.lng < 0 ? normalizedActual.lng : normalizedActual.lng - 360
	};
	
	// Calculate distances to both versions
	const distanceToNormal = calculateDistance(normalizedGuess, normalizedActual);
	const distanceToEast = calculateDistance(normalizedGuess, actualEast);
	const distanceToWest = calculateDistance(normalizedGuess, actualWest);
	
	// Return the actual location that gives the shortest distance
	if (distanceToEast <= distanceToNormal && distanceToEast <= distanceToWest) {
		return { lat: actualEast.lat, lng: normalizeLongitude(actualEast.lng) };
	} else if (distanceToWest <= distanceToNormal && distanceToWest <= distanceToEast) {
		return { lat: actualWest.lat, lng: normalizeLongitude(actualWest.lng) };
	} else {
		return normalizedActual;
	}
};

/**
 * Calculate distance between two points using Haversine formula
 * This calculates the great-circle distance between two points on a sphere
 */
export const calculateDistance = (point1: Location, point2: Location): number => {
	// Convert latitude and longitude from degrees to radians
	const toRad = (value: number) => (value * Math.PI) / 180;

	// Earth's radius in kilometers
	const R = 6371;

	// Normalize coordinates and handle antimeridian crossing
	const normalizedPoint1: Location = {
		lat: point1.lat,
		lng: normalizeLongitude(point1.lng)
	};
	
	const normalizedPoint2: Location = {
		lat: point2.lat,
		lng: normalizeLongitude(point2.lng)
	};

	// Calculate differences in coordinates
	const dLat = toRad(normalizedPoint2.lat - normalizedPoint1.lat);
	
	// Use the optimized longitude difference that considers antimeridian crossing
	const lngDiff = calculateLongitudeDifference(normalizedPoint1.lng, normalizedPoint2.lng);
	const dLng = toRad(lngDiff);

	// Haversine formula
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(normalizedPoint1.lat)) *
			Math.cos(toRad(normalizedPoint2.lat)) *
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
    
    // Composite exponential decay
    const fast = Math.exp(-distance / 40);
    const slow = Math.exp(-distance / 600);
    const blend = 0.80 * fast + 0.20 * slow;
    return Math.round(MAX_SCORE * blend);
};

/**
 * Format distance for display (meters if < 500m, km otherwise)
 */
export const formatDistance = (distance: number): [number, string] => {
	if (distance < 0.5) {
		// Less than 500 meters (0.5 km)
		// Convert to meters and round to nearest meter
		const meters = Math.round(distance * 1000);
		return [meters, 'm'];
	} else {
		// Keep in kilometers with 2 decimal precision
		return [distance, 'km'];
	}
};

/**
 * Process a user's guess and return the result with optimal actual location
 */
export const processGuessWithOptimalLocation = (
	userGuess: Location,
	actualLocation: Location,
	isLastRound: boolean
): { result: GuessResult; optimalActualLocation: Location } => {
	// Find the optimal actual location that minimizes distance (handles antimeridian crossing)
	const optimalActualLocation = findOptimalActualLocation(userGuess, actualLocation);
	
	const distance = calculateDistance(userGuess, optimalActualLocation);
	const score = calculateScore(distance);
	const formattedDistanceResult = formatDistance(distance);
	const formattedDistance = formattedDistanceResult[0];
	const formattedDistanceUnit = formattedDistanceResult[1];

	const result: GuessResult = {
		// Keep the user's original guess location for display (don't normalize for UX)
		// This ensures the pin appears where the user actually clicked
		userGuess: userGuess,
		score,
		distance,
		formattedDistance,
		formattedDistanceUnit,
		isLastRound
	};

	return { result, optimalActualLocation };
};

/**
 * Process a user's guess and return the result
 */
export const processGuess = (
	userGuess: Location,
	actualLocation: Location,
	isLastRound: boolean
): GuessResult => {
	const { result } = processGuessWithOptimalLocation(userGuess, actualLocation, isLastRound);
	return result;
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

	// Normalize coordinates and find optimal actual location for proper path calculation
	const normalizedPoint1: Location = {
		lat: point1.lat,
		lng: normalizeLongitude(point1.lng)
	};
	
	const optimalPoint2 = findOptimalActualLocation(normalizedPoint1, point2);

	const toRad = (value: number) => (value * Math.PI) / 180;
	const toDeg = (value: number) => (value * 180) / Math.PI;

	const lat1 = toRad(normalizedPoint1.lat);
	const lng1 = toRad(normalizedPoint1.lng);
	const lat2 = toRad(optimalPoint2.lat);
	const lng2 = toRad(optimalPoint2.lng);

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
		return [normalizedPoint1, optimalPoint2];
	}

	for (let i = 0; i <= numPoints; i++) {
		const f = i / numPoints;

		if (f === 0) {
			points.push(normalizedPoint1);
			continue;
		}
		if (f === 1) {
			points.push(optimalPoint2);
			continue;
		}

		// Use proper great circle interpolation with normalized coordinates
		// The longitude difference is already optimized from findOptimalActualLocation
		const lngDiff = calculateLongitudeDifference(normalizedPoint1.lng, optimalPoint2.lng);
		const dLng2 = toRad(lngDiff);

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
			lng: normalizeLongitude(toDeg(lng))
		});
	}

	console.log('Returning geodesic path with', points.length, 'points');
	console.log(
		'Sample points:',
		points.slice(0, 5).map((p) => `(${p.lat.toFixed(2)}, ${p.lng.toFixed(2)})`)
	);

	return points;
};
