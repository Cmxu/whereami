<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { showSuccess, showError } from '$lib/stores/toastStore';
	import { user } from '$lib/stores/authStore';

	const dispatch = createEventDispatcher();

	export let isOpen = false;
	export let currentDisplayName = '';
	export let currentProfilePicture: string | null = null;

	let displayName = currentDisplayName;
	let profilePictureFile: File | null = null;
	let profilePicturePreview: string | null = null;
	let isLoading = false;

	// Reset form when modal opens
	$: if (isOpen) {
		displayName = currentDisplayName;
		profilePictureFile = null;
		profilePicturePreview = null;
	}

	async function handleProfilePictureSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file) {
			// Validate file type and size
			if (!file.type.startsWith('image/')) {
				showError('Please select an image file');
				return;
			}

			if (file.size > 5 * 1024 * 1024) {
				showError('Image must be smaller than 5MB');
				return;
			}

			profilePictureFile = file;

			// Create preview
			const reader = new FileReader();
			reader.onload = (e) => {
				profilePicturePreview = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		}
	}

	async function updateProfile() {
		if (!$user) return;

		isLoading = true;

		try {
			const token = (await import('$lib/supabase')).supabase.auth
				.getSession()
				.then(({ data }) => data.session?.access_token);
			const accessToken = await token;

			if (!accessToken) {
				showError('Authentication required');
				return;
			}

			// Update display name if changed
			if (displayName !== currentDisplayName) {
				const response = await fetch('/api/user/profile', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`
					},
					body: JSON.stringify({ username: displayName })
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to update display name');
				}
			}

			// Upload profile picture if selected
			if (profilePictureFile) {
				const formData = new FormData();
				formData.append('profilePicture', profilePictureFile);

				const response = await fetch('/api/user/profile', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${accessToken}`
					},
					body: formData
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to upload profile picture');
				}
			}

			showSuccess('Profile updated successfully');
			dispatch('updated');
			close();
		} catch (error) {
			console.error('Profile update error:', error);
			showError(error instanceof Error ? error.message : 'Failed to update profile');
		} finally {
			isLoading = false;
		}
	}

	function close() {
		isOpen = false;
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
		on:click={close}
		on:keydown={handleKeydown}
		role="button"
		tabindex="0"
	>
		<!-- Modal Content -->
		<div
			class="rounded-xl shadow-xl max-w-md w-full p-6"
			style="background-color: var(--bg-primary);"
			on:click={(e) => e.stopPropagation()}
			on:keydown={() => {}}
			role="dialog"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex justify-between items-center mb-6">
				<h2 class="text-xl font-bold" style="color: var(--text-primary);">Edit Profile</h2>
				<button
					on:click={close}
					class="text-2xl font-bold hover:opacity-70 transition-opacity"
					style="color: var(--text-secondary);"
					aria-label="Close modal"
				>
					&times;
				</button>
			</div>

			<!-- Form -->
			<div class="space-y-4">
				<!-- Display Name -->
				<div>
					<label
						for="displayName"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-secondary);"
					>
						Display Name
					</label>
					<input
						id="displayName"
						type="text"
						bind:value={displayName}
						placeholder="Enter your display name"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						style="background-color: var(--bg-secondary); color: var(--text-primary); border-color: var(--border-color);"
						disabled={isLoading}
					/>
					<p class="text-xs mt-1" style="color: var(--text-tertiary);">
						This is the name other users will see
					</p>
				</div>

				<!-- Profile Picture -->
				<div>
					<label
						for="profilePictureInput"
						class="block text-sm font-medium mb-2"
						style="color: var(--text-secondary);"
					>
						Profile Picture
					</label>

					<!-- Current/Preview Image -->
					<div class="flex items-center space-x-4 mb-3">
						<div class="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
							{#if profilePicturePreview}
								<img
									src={profilePicturePreview}
									alt="Profile preview"
									class="w-full h-full object-cover"
								/>
							{:else if currentProfilePicture}
								<img
									src={`/api/images/${currentProfilePicture}`}
									alt="Current profile"
									class="w-full h-full object-cover"
								/>
							{:else}
								<div
									class="w-full h-full bg-blue-600 flex items-center justify-center text-white text-xl font-semibold"
								>
									{$user?.user_metadata?.first_name?.[0] || $user?.email?.[0]?.toUpperCase() || '?'}
								</div>
							{/if}
						</div>

						<div class="flex-1">
							<input
								type="file"
								accept="image/*"
								on:change={handleProfilePictureSelect}
								class="hidden"
								id="profilePictureInput"
								disabled={isLoading}
							/>
							<label for="profilePictureInput" class="btn-secondary cursor-pointer inline-block">
								{profilePictureFile ? 'Change Image' : 'Choose Image'}
							</label>
						</div>
					</div>

					<p class="text-xs" style="color: var(--text-tertiary);">
						Max size: 5MB. Supported formats: JPG, PNG, GIF
					</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end space-x-3 mt-6">
				<button on:click={close} disabled={isLoading} class="btn-secondary"> Cancel </button>
				<button
					on:click={updateProfile}
					disabled={isLoading || (!displayName.trim() && !profilePictureFile)}
					class="btn-primary"
				>
					{isLoading ? 'Updating...' : 'Update Profile'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Additional styles for better appearance */
	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
