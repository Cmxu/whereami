<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { isAuthenticated } from '$lib/stores/authStore';
	import UserGallery from '$lib/components/UserGallery.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import type { Location } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { showSuccess, showError, showWarning, showInfo } from '$lib/stores/toastStore';

	const dispatch = createEventDispatcher();

	interface UploadFile {
		id: string;
		file: File;
		preview: string;
		location?: Location;
		extractedLocation?: Location;
		uploaded: boolean;
		uploading: boolean;
		progress: number;
		error?: string;
		retryCount: number;
	}

	type TabType = 'gallery' | 'upload';

	let activeTab: TabType = 'gallery';
	let showAuthModal = false;

	// Upload state variables
	let dragActive = false;
	let uploadFiles: UploadFile[] = [];
	let isUploading = false;
	let fileInputRef: HTMLInputElement;

	// Constants
	const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
	const MAX_RETRY_ATTEMPTS = 3;
	const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

	// Computed values
	$: uploadedCount = uploadFiles.filter((f) => f.uploaded).length;
	$: pendingCount = uploadFiles.filter((f) => !f.uploaded && f.location && !f.error).length;
	$: errorCount = uploadFiles.filter((f) => f.error).length;
	$: noLocationCount = uploadFiles.filter((f) => !f.location && !f.uploaded).length;

	// Handle URL parameters
	onMount(async () => {
		// Show sign in prompt for unauthenticated users
		if (!$isAuthenticated) {
			showInfo('Sign in to view and upload your photos');
		}
		
		// Initialize tab from URL on mount
		const urlParams = new URLSearchParams($page.url.search);
		const tabParam = urlParams.get('tab');
		if (tabParam === 'upload') {
			activeTab = 'upload';
		} else {
			activeTab = 'gallery';
		}
	});

	// Handle browser navigation (back/forward buttons)
	$: {
		const urlParams = new URLSearchParams($page.url.search);
		const tabParam = urlParams.get('tab');
		
		// Only update if URL doesn't match current tab (avoid infinite loops)
		if (tabParam === 'upload' && activeTab !== 'upload') {
			activeTab = 'upload';
		} else if (!tabParam && activeTab !== 'gallery') {
			activeTab = 'gallery';
		}
	}

	function handleLogin() {
		showAuthModal = true;
	}

	function handleCreateGame() {
		// Navigate to create page
		goto('/create');
	}

	function handleSwitchToUpload() {
		goto('/gallery?tab=upload');
	}

	function handleSwitchToGallery() {
		goto('/gallery');
	}

	// Basic upload functionality
	function generateId(): string {
		return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
	}

	function validateFile(file: File): { valid: boolean; error?: string } {
		if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
			return {
				valid: false,
				error: `Unsupported format. Please use: ${SUPPORTED_FORMATS.map((f) => f.split('/')[1].toUpperCase()).join(', ')}`
			};
		}

		if (file.size > MAX_FILE_SIZE) {
			return {
				valid: false,
				error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
			};
		}

		if (file.size === 0) {
			return {
				valid: false,
				error: 'File appears to be empty'
			};
		}

		return { valid: true };
	}

	async function processFiles(files: FileList) {
		if (files.length === 0) return;

		const newFiles: UploadFile[] = [];
		let validFileCount = 0;
		let invalidFiles: string[] = [];

		showInfo(`Processing ${files.length} file${files.length !== 1 ? 's' : ''}...`);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];

			const validation = validateFile(file);
			if (!validation.valid) {
				invalidFiles.push(`${file.name}: ${validation.error}`);
				continue;
			}

			validFileCount++;

			const preview = URL.createObjectURL(file);

			const uploadFile: UploadFile = {
				id: generateId(),
				file,
				preview,
				uploaded: false,
				uploading: false,
				progress: 0,
				retryCount: 0
			};

			newFiles.push(uploadFile);
		}

		uploadFiles = [...uploadFiles, ...newFiles];

		if (validFileCount > 0) {
			showSuccess(`Added ${validFileCount} photo${validFileCount !== 1 ? 's' : ''}`);
		}

		if (invalidFiles.length > 0) {
			const message = invalidFiles.length === 1 ? invalidFiles[0] : `${invalidFiles.length} files were skipped.`;
			showWarning(message);
		}
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			processFiles(input.files);
		}
		input.value = '';
	}

	function triggerFileSelect() {
		fileInputRef?.click();
	}

	function removeFile(index: number) {
		const file = uploadFiles[index];
		URL.revokeObjectURL(file.preview);
		uploadFiles = uploadFiles.filter((_, i) => i !== index);
		showInfo(`Removed ${file.file.name}`);
	}

	// Drag and drop handlers
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragActive = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragActive = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		dragActive = false;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			processFiles(files);
		}
	}
</script>

<svelte:head>
	<title>Gallery - WhereAmI</title>
	<meta name="description" content="View and manage your uploaded photos for geography games." />
</svelte:head>

{#if !$isAuthenticated}
	<!-- Unauthenticated state -->
	<div class="min-h-screen flex items-center justify-center p-4">
		<div class="card max-w-md w-full text-center">
			<div class="text-blue-500 text-6xl mb-6">📸</div>
			<h1 class="text-3xl font-bold text-gray-800 mb-4">Your Photo Gallery</h1>
			<p class="text-gray-600 mb-6">
				Sign in to view your uploaded photos and manage your image collection for creating geography
				games.
			</p>
			<button class="btn-primary w-full" on:click={handleLogin}> Sign In to Continue </button>
		</div>
	</div>
{:else}
	<!-- Authenticated state -->
	<div class="gallery-container min-h-screen">
		<!-- Header -->
		<div class="gallery-header border-b" style="background-color: var(--bg-primary); border-color: var(--border-color);">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="header-content py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
					<!-- Page title and toggle button -->
					<div class="flex items-center justify-between w-full">
						<div class="header-text">
							<h1 class="text-3xl font-bold" style="color: var(--text-primary);">Your Photo Gallery</h1>
							<p class="text-lg mt-2" style="color: var(--text-secondary);">
								Manage your uploaded photos and create custom geography games
							</p>
						</div>

						<!-- Toggle Button -->
						<div class="flex bg-gray-100 rounded-lg p-1" style="background-color: var(--bg-tertiary);">
							<button
								class="tab-button {activeTab === 'gallery' ? 'active' : ''}"
								on:click={() => goto('/gallery')}
							>
								🖼️ My Photos
							</button>
							<button
								class="tab-button {activeTab === 'upload' ? 'active' : ''}"
								on:click={() => goto('/gallery?tab=upload')}
								disabled={!$isAuthenticated}
							>
								📤 Upload
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="gallery-content">
			{#if activeTab === 'gallery'}
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<UserGallery 
						on:createGame={handleCreateGame} 
						on:switchToUpload={handleSwitchToUpload} 
						on:switchToGallery={handleSwitchToGallery}
					/>
				</div>
			{:else if activeTab === 'upload'}
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
						<!-- Upload Area -->
						<div class="xl:col-span-1 space-y-6">
							<!-- Drag & Drop Zone -->
							<div
								class="upload-area relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 shadow-sm min-h-80"
								class:border-blue-400={dragActive}
								class:bg-blue-50={dragActive}
								class:border-gray-300={!dragActive}
								style="background-color: var(--bg-primary); border-color: {dragActive ? '#60a5fa' : 'var(--border-color)'};"
								on:dragover={handleDragOver}
								on:dragleave={handleDragLeave}
								on:drop={handleDrop}
								role="button"
								tabindex="0"
								on:click={triggerFileSelect}
								on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
							>
								<div class="upload-content">
									<div class="text-6xl mb-6">
										{dragActive ? '⬇️' : '📤'}
									</div>
									<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">
										{dragActive ? 'Drop your photos here!' : 'Upload Travel Photos'}
									</h3>
									<p class="mb-6" style="color: var(--text-secondary);">
										Drag and drop photos or click to browse your files
									</p>
									<button
										class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
										on:click|stopPropagation={triggerFileSelect}
									>
										Choose Photos
									</button>
								</div>

								<input
									bind:this={fileInputRef}
									type="file"
									multiple
									accept={SUPPORTED_FORMATS.join(',')}
									class="hidden"
									on:change={handleFileSelect}
									aria-label="Select photos to upload"
								/>
							</div>
						</div>

						<!-- Photo List -->
						<div class="xl:col-span-2">
							{#if uploadFiles.length === 0}
								<div
									class="empty-state rounded-2xl p-12 text-center shadow-sm border"
									style="background-color: var(--bg-primary); border-color: var(--border-color);"
								>
									<div class="text-6xl mb-6">🌍</div>
									<h3 class="text-xl font-semibold mb-3" style="color: var(--text-primary);">No photos yet</h3>
									<p class="mb-6" style="color: var(--text-secondary);">
										Select photos to get started
									</p>
								</div>
							{:else}
								<div class="photo-list space-y-4">
									{#each uploadFiles as file, index (file.id)}
										<div
											class="photo-item rounded-xl border overflow-hidden shadow-sm"
											style="background-color: var(--bg-primary); border-color: var(--border-color);"
										>
											<div class="flex flex-col sm:flex-row">
												<div class="photo-preview w-full sm:w-32 h-32 bg-gray-100 flex-shrink-0">
													<img
														src={file.preview}
														alt="Upload preview"
														class="w-full h-full object-cover"
														loading="lazy"
													/>
												</div>
												<div class="photo-info flex-1 p-4">
													<div class="flex justify-between items-start mb-3">
														<h4 class="font-semibold truncate pr-4" title={file.file.name}>
															{file.file.name}
														</h4>
														<button
															class="text-gray-400 hover:text-red-500 transition-colors"
															on:click={() => removeFile(index)}
														>
															×
														</button>
													</div>
													<div class="text-sm text-gray-600">
														{(file.file.size / 1024 / 1024).toFixed(1)} MB
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Auth modal -->
<AuthModal bind:isOpen={showAuthModal} on:close={() => (showAuthModal = false)} />

<style>
	.gallery-container {
		min-height: calc(100vh - 64px); /* Account for navigation height */
		background-color: var(--bg-secondary);
	}

	.tab-button {
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 0.375rem;
		transition: all 0.2s;
		color: var(--text-secondary);
		background: transparent;
		border: none;
		cursor: pointer;
		position: relative;
	}

	.tab-button:hover:not(:disabled) {
		color: var(--text-primary);
		background: var(--bg-secondary);
	}

	.tab-button.active {
		color: var(--text-primary);
		background: var(--bg-primary);
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.tab-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.upload-area {
		cursor: pointer;
	}

	.upload-area:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.photo-item:hover {
		transform: translateY(-1px);
	}

	@media (max-width: 640px) {
		.header-content {
			flex-direction: column;
			align-items: stretch;
		}

		.header-content > div {
			flex-direction: column;
			align-items: center;
			gap: 1rem;
		}

		.tab-button {
			flex: 1;
			text-align: center;
		}
	}
</style>
