<script lang="ts">
	import {
		signInWithEmail,
		signUpWithEmail,
		resetPassword,
		authLoading,
		authError
	} from '$lib/stores/authStore';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	export let isOpen = false;

	let mode: 'signin' | 'signup' | 'reset' = 'signin';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let firstName = '';
	let lastName = '';
	let loading = false;
	let error = '';
	let success = '';

	async function handleSubmit() {
		error = '';
		success = '';
		loading = true;

		try {
			if (mode === 'signin') {
				const result = await signInWithEmail(email, password);
				if (result.success) {
					dispatch('close');
				} else {
					error = result.error || 'Sign in failed';
				}
			} else if (mode === 'signup') {
				if (password !== confirmPassword) {
					error = 'Passwords do not match';
					loading = false;
					return;
				}

				const result = await signUpWithEmail(email, password, { firstName, lastName });
				if (result.success) {
					success = 'Account created! Please check your email to verify your account.';
					// Don't close modal yet, show success message
				} else {
					error = result.error || 'Sign up failed';
				}
			} else if (mode === 'reset') {
				const result = await resetPassword(email);
				if (result.success) {
					success = 'Password reset email sent! Check your inbox.';
				} else {
					error = result.error || 'Password reset failed';
				}
			}
		} catch (err) {
			error = 'An unexpected error occurred';
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		if (!loading) {
			dispatch('close');
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		// Only close if clicking on the backdrop itself, not on the modal content
		if (event.target === event.currentTarget && !loading) {
			dispatch('close');
		}
	}

	function switchMode(newMode: typeof mode) {
		mode = newMode;
		error = '';
		success = '';
		password = '';
		confirmPassword = '';
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<div class="bg-white rounded-lg p-6 w-full max-w-md mx-4" role="document">
			<div class="flex justify-between items-center mb-6">
				<h2 id="modal-title" class="text-2xl font-bold text-gray-900">
					{#if mode === 'signin'}
						Sign In
					{:else if mode === 'signup'}
						Create Account
					{:else}
						Reset Password
					{/if}
				</h2>
				<button
					on:click={handleClose}
					class="text-gray-400 hover:text-gray-600 text-2xl"
					disabled={loading}
					aria-label="Close modal"
				>
					×
				</button>
			</div>

			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				{#if error}
					<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
						{error}
					</div>
				{/if}

				{#if success}
					<div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
						{success}
					</div>
				{/if}

				{#if mode === 'signup'}
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">
								First Name
							</label>
							<input
								id="firstName"
								type="text"
								bind:value={firstName}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="John"
								disabled={loading}
							/>
						</div>
						<div>
							<label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">
								Last Name
							</label>
							<input
								id="lastName"
								type="text"
								bind:value={lastName}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Doe"
								disabled={loading}
							/>
						</div>
					</div>
				{/if}

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-1"> Email </label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="your@email.com"
						disabled={loading}
					/>
				</div>

				{#if mode !== 'reset'}
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
							Password
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="••••••••"
							disabled={loading}
						/>
					</div>
				{/if}

				{#if mode === 'signup'}
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
							Confirm Password
						</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							required
							class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="••••••••"
							disabled={loading}
						/>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
				>
					{#if loading}
						<span class="inline-flex items-center">
							<svg
								class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Processing...
						</span>
					{:else if mode === 'signin'}
						Sign In
					{:else if mode === 'signup'}
						Create Account
					{:else}
						Send Reset Email
					{/if}
				</button>
			</form>

			<div class="mt-6 text-center text-sm">
				{#if mode === 'signin'}
					<p class="text-gray-600">
						Don't have an account?
						<button
							on:click={() => switchMode('signup')}
							class="text-blue-600 hover:text-blue-800 font-medium"
							disabled={loading}
						>
							Sign up
						</button>
					</p>
					<p class="text-gray-600 mt-2">
						<button
							on:click={() => switchMode('reset')}
							class="text-blue-600 hover:text-blue-800 font-medium"
							disabled={loading}
						>
							Forgot password?
						</button>
					</p>
				{:else if mode === 'signup'}
					<p class="text-gray-600">
						Already have an account?
						<button
							on:click={() => switchMode('signin')}
							class="text-blue-600 hover:text-blue-800 font-medium"
							disabled={loading}
						>
							Sign in
						</button>
					</p>
				{:else}
					<p class="text-gray-600">
						Remember your password?
						<button
							on:click={() => switchMode('signin')}
							class="text-blue-600 hover:text-blue-800 font-medium"
							disabled={loading}
						>
							Sign in
						</button>
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
