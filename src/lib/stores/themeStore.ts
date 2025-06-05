import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

// Get the stored theme preference or default to system preference
function getStoredTheme(): Theme {
	if (!browser) return 'light';
	try {
		const stored = localStorage.getItem('theme');
		if (stored === 'light' || stored === 'dark') {
			return stored;
		}
	} catch (e) {
		console.warn('Failed to read theme from localStorage:', e);
	}
	// Default to system preference on first visit
	return getSystemTheme();
}

// Check if the system prefers dark mode
function getSystemTheme(): Theme {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Create the theme store
function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>(getStoredTheme());

	// Apply theme to document
	function applyTheme(theme: Theme) {
		if (!browser) return;

		const htmlElement = document.documentElement;

		if (theme === 'dark') {
			htmlElement.classList.add('dark');
		} else {
			htmlElement.classList.remove('dark');
		}

		// Store the preference
		try {
			localStorage.setItem('theme', theme);
		} catch (e) {
			console.warn('Failed to save theme to localStorage:', e);
		}
	}

	return {
		subscribe,
		setTheme: (theme: Theme) => {
			applyTheme(theme);
			set(theme);
		},
		toggleTheme: () => {
			update((currentTheme) => {
				const newTheme = currentTheme === 'light' ? 'dark' : 'light';
				applyTheme(newTheme);
				return newTheme;
			});
		},
		// Initialize theme on app start
		init: () => {
			const currentTheme = getStoredTheme();
			applyTheme(currentTheme);
			set(currentTheme);

			// Listen for system theme changes only if no preference is stored
			if (browser && !localStorage.getItem('theme')) {
				const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
				const handleSystemThemeChange = () => {
					// Only update if user hasn't manually set a preference
					if (!localStorage.getItem('theme')) {
						const systemTheme = getSystemTheme();
						applyTheme(systemTheme);
						set(systemTheme);
					}
				};

				mediaQuery.addEventListener('change', handleSystemThemeChange);

				// Return cleanup function
				return () => {
					mediaQuery.removeEventListener('change', handleSystemThemeChange);
				};
			}
		}
	};
}

export const theme = createThemeStore();
