import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	message: string;
	duration?: number;
	position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
	dismissible?: boolean;
}

export const toasts = writable<Toast[]>([]);

let toastId = 0;

function generateId(): string {
	return `toast-${++toastId}-${Date.now()}`;
}

export function addToast(toast: Omit<Toast, 'id'>): string {
	const id = generateId();
	const newToast: Toast = {
		id,
		duration: 5000,
		position: 'top-right',
		dismissible: true,
		...toast
	};

	toasts.update(current => [...current, newToast]);
	return id;
}

export function removeToast(id: string): void {
	toasts.update(current => current.filter(toast => toast.id !== id));
}

export function clearAllToasts(): void {
	toasts.set([]);
}

// Convenience methods
export function showSuccess(message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>): string {
	return addToast({ type: 'success', message, ...options });
}

export function showError(message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>): string {
	return addToast({ type: 'error', message, duration: 7000, ...options });
}

export function showWarning(message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>): string {
	return addToast({ type: 'warning', message, duration: 6000, ...options });
}

export function showInfo(message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>): string {
	return addToast({ type: 'info', message, ...options });
}

// Auto-cleanup old toasts (prevent memory leaks)
const MAX_TOASTS = 5;

toasts.subscribe(current => {
	if (current.length > MAX_TOASTS) {
		const excess = current.length - MAX_TOASTS;
		const toRemove = current.slice(0, excess);
		toRemove.forEach(toast => removeToast(toast.id));
	}
}); 