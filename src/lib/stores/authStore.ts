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
let authInitPromise: Promise<void> | null = null;

export async function initAuth() {
	if (initialized) return authInitPromise;
	if (authInitPromise) return authInitPromise;

	authInitPromise = (async () => {
		try {
			setAuthLoading(true);

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
					try {
						await loadUserProfile();
					} catch (profileError) {
						console.warn('Failed to load user profile:', profileError);
						// Don't fail auth if profile loading fails
					}
				} else {
					// No session, ensure we're not loading
					setAuthLoading(false);
				}
			}

			// Listen for auth changes
			supabase.auth.onAuthStateChange(async (event, session) => {
				console.log('Auth state change:', event, !!session?.user);

				setUser(session?.user || null);

				if (event === 'SIGNED_OUT') {
					clearAuth();
				} else if (event === 'SIGNED_IN' && session?.user) {
					try {
						await loadUserProfile();
					} catch (profileError) {
						console.warn('Failed to load user profile on sign in:', profileError);
					}
				} else if (event === 'TOKEN_REFRESHED' && session?.user) {
					// Token was refreshed, ensure we have the latest user data
					setUser(session.user);
				}
			});

			initialized = true;
		} catch (error) {
			console.error('Auth initialization error:', error);
			setAuthError('Failed to initialize authentication');
		}
	})();

	return authInitPromise;
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
	try {
		setAuthLoading(true);
		setAuthError(null);

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
			try {
				await loadUserProfile();
			} catch (profileError) {
				console.warn('Failed to load user profile after sign in:', profileError);
				// Don't fail sign in if profile loading fails
			}
		}
		return { success: true, user: data.user };
	} catch (error) {
		console.error('Sign in error:', error);
		setAuthError('An unexpected error occurred during sign in');
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function signUpWithEmail(
	email: string,
	password: string,
	options?: {
		firstName?: string;
		lastName?: string;
	}
) {
	try {
		setAuthLoading(true);
		setAuthError(null);

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

		// Clear loading state for sign up (don't wait for email confirmation)
		setAuthLoading(false);
		return { success: true, user: data.user };
	} catch (error) {
		console.error('Sign up error:', error);
		setAuthError('An unexpected error occurred during sign up');
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function signOut() {
	try {
		setAuthLoading(true);
		setAuthError(null);

		const { error } = await supabase.auth.signOut();

		if (error) {
			setAuthError(error.message);
			return { success: false, error: error.message };
		}

		clearAuth();
		return { success: true };
	} catch (error) {
		console.error('Sign out error:', error);
		setAuthError('An unexpected error occurred during sign out');
		return { success: false, error: 'An unexpected error occurred' };
	}
}

export async function resetPassword(email: string) {
	try {
		setAuthLoading(true);
		setAuthError(null);

		const { error } = await supabase.auth.resetPasswordForEmail(email);

		if (error) {
			setAuthError(error.message);
			return { success: false, error: error.message };
		}

		setAuthLoading(false);
		return { success: true };
	} catch (error) {
		console.error('Password reset error:', error);
		setAuthError('An unexpected error occurred during password reset');
		return { success: false, error: 'An unexpected error occurred' };
	}
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

// Utility function to check current authentication status
export async function checkAuthStatus(): Promise<boolean> {
	try {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return !!session?.user;
	} catch (error) {
		console.error('Error checking auth status:', error);
		return false;
	}
}

// Force refresh authentication state
export async function refreshAuth(): Promise<void> {
	try {
		const {
			data: { session },
			error
		} = await supabase.auth.refreshSession();
		if (error) {
			console.error('Error refreshing session:', error);
			clearAuth();
		} else {
			setUser(session?.user || null);
			if (session?.user) {
				await loadUserProfile();
			}
		}
	} catch (error) {
		console.error('Error refreshing auth:', error);
		clearAuth();
	}
}
