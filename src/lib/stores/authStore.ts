import { writable, derived } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

// User store from Supabase
export const user = writable<User | null>(null);

// Derived stores for convenience
export const isAuthenticated = derived(user, ($user) => !!$user);
export const userId = derived(user, ($user) => $user?.id || null);
export const userEmail = derived(user, ($user) => $user?.email || null);
export const userName = derived(
	user,
	($user) =>
		$user?.user_metadata?.full_name || $user?.user_metadata?.name || $user?.email || 'Anonymous'
);

// Extended profile data
export const userProfile = writable<{
	id?: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	displayName?: string;
	profilePicture?: string | null;
	createdAt?: string;
	updatedAt?: string;
} | null>(null);

// Derived display name from profile or user metadata
export const displayName = derived(
	[userProfile, user],
	([$userProfile, $user]) =>
		$userProfile?.displayName ||
		$user?.user_metadata?.full_name ||
		$user?.user_metadata?.name ||
		$user?.email ||
		'Anonymous'
);

// Loading states
export const authLoading = writable(true);
export const authError = writable<string | null>(null);

// Check if user has permission to upload
export const canUpload = derived(isAuthenticated, ($isAuthenticated) => $isAuthenticated);

// User stats (will be populated from API)
export const userStats = writable({
	gamesCreated: 0,
	gamesPlayed: 0,
	imagesUploaded: 0,
	totalScore: 0,
	averageScore: 0
});

// Initialize auth state
let initialized = false;

export async function initAuth() {
	if (initialized) return;
	initialized = true;

	try {
		// Get initial session
		const {
			data: { session },
			error
		} = await supabase.auth.getSession();
		if (error) {
			console.error('Error getting session:', error);
			setAuthError(error.message);
		} else {
			setUser(session?.user || null);
			if (session?.user) {
				await loadUserProfile();
			}
		}

		// Listen for auth changes
		supabase.auth.onAuthStateChange(async (event, session) => {
			setUser(session?.user || null);
			if (event === 'SIGNED_OUT') {
				clearAuth();
			} else if (session?.user) {
				await loadUserProfile();
			}
		});
	} catch (error) {
		console.error('Auth initialization error:', error);
		setAuthError('Failed to initialize authentication');
	}
}

// Load user profile data
export async function loadUserProfile() {
	try {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			return;
		}

		const response = await fetch('/api/user/profile', {
			headers: {
				Authorization: `Bearer ${session.access_token}`
			}
		});

		if (response.ok) {
			const { profile } = await response.json();
			userProfile.set(profile);
			
			// Also update user stats from the profile data
			if (profile) {
				userStats.set({
					gamesCreated: profile.gamesCreated || 0,
					gamesPlayed: profile.gamesPlayed || 0,
					imagesUploaded: profile.imagesUploaded || 0,
					totalScore: profile.totalScore || 0,
					averageScore: profile.averageScore || 0
				});
			}
		}
	} catch (error) {
		console.error('Failed to load user profile:', error);
	}
}

// Load user stats separately (can be called to refresh stats)
export async function loadUserStats() {
	try {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session?.access_token) {
			return;
		}

		const response = await fetch('/api/user/profile', {
			headers: {
				Authorization: `Bearer ${session.access_token}`
			}
		});

		if (response.ok) {
			const { profile } = await response.json();
			if (profile) {
				userStats.set({
					gamesCreated: profile.gamesCreated || 0,
					gamesPlayed: profile.gamesPlayed || 0,
					imagesUploaded: profile.imagesUploaded || 0,
					totalScore: profile.totalScore || 0,
					averageScore: profile.averageScore || 0
				});
			}
		}
	} catch (error) {
		console.error('Failed to load user stats:', error);
	}
}

// Authentication functions
export async function signInWithEmail(email: string, password: string) {
	setAuthLoading(true);
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password
	});

	if (error) {
		setAuthError(error.message);
		return { success: false, error: error.message };
	}

	setUser(data.user);
	if (data.user) {
		await loadUserProfile();
	}
	return { success: true, user: data.user };
}

export async function signUpWithEmail(
	email: string,
	password: string,
	options?: {
		firstName?: string;
		lastName?: string;
	}
) {
	setAuthLoading(true);
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				full_name:
					options?.firstName && options?.lastName
						? `${options.firstName} ${options.lastName}`
						: undefined,
				first_name: options?.firstName,
				last_name: options?.lastName
			}
		}
	});

	if (error) {
		setAuthError(error.message);
		return { success: false, error: error.message };
	}

	return { success: true, user: data.user };
}

export async function signOut() {
	setAuthLoading(true);
	const { error } = await supabase.auth.signOut();

	if (error) {
		setAuthError(error.message);
		return { success: false, error: error.message };
	}

	clearAuth();
	return { success: true };
}

export async function resetPassword(email: string) {
	setAuthLoading(true);
	const { error } = await supabase.auth.resetPasswordForEmail(email);

	if (error) {
		setAuthError(error.message);
		return { success: false, error: error.message };
	}

	setAuthLoading(false);
	return { success: true };
}

// Functions to update user data
export function setUser(newUser: User | null) {
	user.set(newUser);
	authLoading.set(false);
	authError.set(null);
}

export function setAuthLoading(loading: boolean) {
	authLoading.set(loading);
}

export function setAuthError(error: string | null) {
	authError.set(error);
	authLoading.set(false);
}

export function clearAuth() {
	user.set(null);
	userProfile.set(null);
	authLoading.set(false);
	authError.set(null);
	userStats.set({
		gamesCreated: 0,
		gamesPlayed: 0,
		imagesUploaded: 0,
		totalScore: 0,
		averageScore: 0
	});
}
