<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import Map from '$lib/components/Map.svelte';
	import AuthButton from '$lib/components/AuthButton.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import type { Location, ImageMetadata } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { getUserPreferences, saveUserPreferences } from '$lib/utils/localStorage';
	import { showSuccess, showError, showWarning, showInfo } from '$lib/stores/toastStore';
	import { isAuthenticated, canUpload, signOut } from '$lib/stores/authStore';

	const dispatch = createEventDispatcher();

	interface UploadFile {
		id: string;
		file: File;
		preview: string;
		location?: Location;
		extractedLocation?: Location;
		metadata?: any;
		uploaded: boolean;
		uploading: boolean;
		progress: number;
		error?: string;
		retryCount: number;
	}

	// State variables
	let dragActive = false;
	let uploadFiles: UploadFile[] = [];
	let selectedFileIndex: number | null = null;
	let showLocationEditor = false;
	let editingLocation: Location | null = null;
	let isUploading = false;
	let exifr: any = null;
	let preferences = getUserPreferences();
	let showAuthModal = false;
	let processingFiles = false;

	// Tutorial state
	let showTutorial = preferences.showUploadTutorial !== false; // Show by default
	let tutorialStep = 0;

	// File input reference
	let fileInputRef: HTMLInputElement;

	// Constants
	const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
	const MAX_RETRY_ATTEMPTS = 3;
	const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

	const tutorialSteps = [
		{
			title: 'Welcome to Photo Upload! 📸',
			description: 'Upload your travel photos with GPS data to create geography games for the community.',
			icon: '🌍'
		},
		{
			title: 'Sign In Required 🔐',
			description: 'Authentication helps us organize your content and track your contributions.',
			icon: '👤'
		},
		{
			title: 'Easy Upload Process ⬆️',
			description: 'Drag photos directly into the upload zone or click to browse your files.',
			icon: '📁'
		},
		{
			title: 'Smart GPS Detection 🛰️',
			description: 'We automatically extract GPS coordinates from your photo metadata when available.',
			icon: '📍'
		},
		{
			title: 'Location Editing ✏️',
			description: 'Add or edit locations manually using our interactive map for photos without GPS data.',
			icon: '🗺️'
		}
	];

	// Computed values
	$: uploadedCount = uploadFiles.filter(f => f.uploaded).length;
	$: pendingCount = uploadFiles.filter(f => !f.uploaded && f.location && !f.error).length;
	$: errorCount = uploadFiles.filter(f => f.error).length;
	$: noLocationCount = uploadFiles.filter(f => !f.location && !f.uploaded).length;
	$: hasFilesToUpload = pendingCount > 0;
	$: overallProgress = uploadFiles.length > 0 ? (uploadedCount / uploadFiles.length) * 100 : 0;

	onMount(async () => {
		// Load EXIF reader library
		await loadExifReader();
		
		// Show welcome message for authenticated users
		if ($isAuthenticated && !showTutorial) {
			showInfo('Ready to upload! Drag photos here or click to browse.');
		}
	});

	async function loadExifReader() {
		try {
			const exifrModule = await import('exifr');
			exifr = exifrModule.default || exifrModule;
			console.log('EXIF reader loaded successfully');
		} catch (error) {
			console.warn('Failed to load EXIF reader:', error);
			if ($isAuthenticated) {
				showWarning('GPS extraction not available - you can still add locations manually');
			}
		}
	}

	function handleLogin() {
		showAuthModal = true;
	}

	async function handleLogout() {
		const result = await signOut();
		if (result.success) {
			showSuccess('Signed out successfully');
			clearAllFiles();
		} else {
			showError('Failed to sign out');
		}
	}

	function handleProfile() {
		goto('/profile');
	}

	function handleAuthModalClose() {
		showAuthModal = false;
	}

	function generateId(): string {
		return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
	}

	async function extractGPS(file: File): Promise<Location | null> {
		if (!exifr) return null;

		try {
			// Use a more efficient approach - only extract GPS data
			const gps = await exifr.gps(file);
			if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
				// Round to 6 decimal places (approximately 0.1m precision)
				return {
					lat: Math.round(gps.latitude * 1000000) / 1000000,
					lng: Math.round(gps.longitude * 1000000) / 1000000
				};
			}
		} catch (error) {
			console.warn('Failed to extract GPS data from', file.name, ':', error);
		}

		return null;
	}

	function validateFile(file: File): { valid: boolean; error?: string } {
		// Check file type
		if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
			return {
				valid: false,
				error: `Unsupported format. Please use: ${SUPPORTED_FORMATS.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
			};
		}

		// Check file size
		if (file.size > MAX_FILE_SIZE) {
			return {
				valid: false,
				error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
			};
		}

		// Check for empty file
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

		processingFiles = true;
		const newFiles: UploadFile[] = [];
		let validFileCount = 0;
		let gpsExtractedCount = 0;
		let invalidFiles: string[] = [];

		showInfo(`Processing ${files.length} file${files.length !== 1 ? 's' : ''}...`);

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			
			// Validate file
			const validation = validateFile(file);
			if (!validation.valid) {
				invalidFiles.push(`${file.name}: ${validation.error}`);
				continue;
			}

			validFileCount++;

			// Create preview URL
			const preview = URL.createObjectURL(file);

			// Try to extract GPS data
			const extractedLocation = await extractGPS(file);
			if (extractedLocation) {
				gpsExtractedCount++;
			}

			const uploadFile: UploadFile = {
				id: generateId(),
				file,
				preview,
				extractedLocation: extractedLocation || undefined,
				location: extractedLocation || undefined,
				uploaded: false,
				uploading: false,
				progress: 0,
				retryCount: 0
			};

			newFiles.push(uploadFile);
		}

		// Add valid files to the list
		uploadFiles = [...uploadFiles, ...newFiles];

		processingFiles = false;

		// Show feedback
		if (validFileCount > 0) {
			showSuccess(
				`Added ${validFileCount} photo${validFileCount !== 1 ? 's' : ''}` +
				(gpsExtractedCount > 0 ? ` (${gpsExtractedCount} with GPS data)` : '')
			);
		}

		// Show warnings for invalid files
		if (invalidFiles.length > 0) {
			const message = invalidFiles.length === 1 
				? invalidFiles[0] 
				: `${invalidFiles.length} files were skipped. Check console for details.`;
			showWarning(message);
			if (invalidFiles.length > 1) {
				console.warn('Invalid files:', invalidFiles);
			}
		}

		// Auto-focus first file without location
		const firstNoLocation = uploadFiles.findIndex(f => !f.location && !f.uploaded);
		if (firstNoLocation >= 0) {
			setTimeout(() => {
				showInfo('💡 Tip: Click "Add Location" on photos without GPS data');
			}, 1000);
		}
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
		
		// Only set dragActive to false if we're leaving the dropzone entirely
		const rect = (event.currentTarget as HTMLElement)?.getBoundingClientRect();
		if (rect) {
			const { clientX, clientY } = event;
			if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
				dragActive = false;
			}
		}
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

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			processFiles(input.files);
		}
		// Reset input value to allow selecting the same files again
		input.value = '';
	}

	function triggerFileSelect() {
		fileInputRef?.click();
	}

	function removeFile(index: number) {
		const file = uploadFiles[index];
		
		// Revoke the object URL to free memory
		URL.revokeObjectURL(file.preview);
		
		// Remove from list
		uploadFiles = uploadFiles.filter((_, i) => i !== index);

		// Update selected index
		if (selectedFileIndex === index) {
			selectedFileIndex = null;
			showLocationEditor = false;
		} else if (selectedFileIndex !== null && selectedFileIndex > index) {
			selectedFileIndex--;
		}

		showInfo(`Removed ${file.file.name}`);
	}

	function editLocation(index: number) {
		selectedFileIndex = index;
		const file = uploadFiles[index];
		editingLocation = file.location || { lat: 0, lng: 0 };
		showLocationEditor = true;
	}

	function handleMapClick(event: CustomEvent<Location>) {
		editingLocation = event.detail;
	}

	function saveLocation() {
		if (selectedFileIndex !== null && editingLocation) {
			uploadFiles[selectedFileIndex].location = { ...editingLocation };
			uploadFiles[selectedFileIndex].error = undefined; // Clear any location errors
			uploadFiles = [...uploadFiles];
			showSuccess('Location saved');
		}
		showLocationEditor = false;
		editingLocation = null;
	}

	function cancelLocationEdit() {
		showLocationEditor = false;
		editingLocation = null;
	}

	async function uploadFile(file: UploadFile): Promise<boolean> {
		if (!file.location) {
			file.error = 'Location required - click "Add Location" to set';
			return false;
		}

		try {
			file.uploading = true;
			file.progress = 10;
			file.error = undefined;

			// Simulate progress during upload
			const progressInterval = setInterval(() => {
				if (file.progress < 90) {
					file.progress += Math.random() * 10;
					uploadFiles = [...uploadFiles];
				}
			}, 200);

			// Upload the image
			const imageId = await api.uploadImage(file.file, file.location);

			clearInterval(progressInterval);
			file.progress = 100;
			file.uploaded = true;
			file.uploading = false;
			uploadFiles = [...uploadFiles];

			return true;
		} catch (error) {
			file.uploading = false;
			file.retryCount++;
			
			// Provide specific error messages
			let errorMessage = 'Upload failed';
			if (error instanceof Error) {
				if (error.message.includes('sign in')) {
					errorMessage = 'Please sign in to upload';
				} else if (error.message.includes('network') || error.message.includes('fetch')) {
					errorMessage = 'Network error - check connection';
				} else {
					errorMessage = error.message;
				}
			}
			
			file.error = errorMessage;
			uploadFiles = [...uploadFiles];
			
			return false;
		}
	}

	async function retryUpload(index: number) {
		const file = uploadFiles[index];
		if (file.retryCount >= MAX_RETRY_ATTEMPTS) {
			showError(`Maximum retry attempts reached for ${file.file.name}`);
			return;
		}

		showInfo(`Retrying upload for ${file.file.name}...`);
		await uploadFile(file);
	}

	async function uploadAll() {
		const filesToUpload = uploadFiles.filter(f => !f.uploaded && f.location && !f.error);
		
		if (filesToUpload.length === 0) {
			if (noLocationCount > 0) {
				showWarning('Some photos need locations. Click "Add Location" to set them.');
			} else {
				showWarning('No photos ready to upload.');
			}
			return;
		}

		isUploading = true;
		let completed = 0;
		let failed = 0;

		// Upload files with a maximum concurrency of 3
		const maxConcurrent = 3;
		for (let i = 0; i < filesToUpload.length; i += maxConcurrent) {
			const batch = filesToUpload.slice(i, i + maxConcurrent);
			const promises = batch.map(file => uploadFile(file));
			const results = await Promise.all(promises);
			
			results.forEach(success => {
				if (success) completed++;
				else failed++;
			});
		}

		isUploading = false;

		// Show completion feedback
		if (completed > 0) {
			showSuccess(`Successfully uploaded ${completed} photo${completed !== 1 ? 's' : ''}! 🎉`);
		}
		if (failed > 0) {
			showError(`${failed} upload${failed !== 1 ? 's' : ''} failed. Check errors and retry.`);
		}
	}

	function clearAllFiles() {
		uploadFiles.forEach(file => URL.revokeObjectURL(file.preview));
		uploadFiles = [];
		selectedFileIndex = null;
		showLocationEditor = false;
		showInfo('All photos cleared');
	}

	// Tutorial functions
	function nextTutorialStep() {
		if (tutorialStep < tutorialSteps.length - 1) {
			tutorialStep++;
		} else {
			closeTutorial();
		}
	}

	function closeTutorial() {
		showTutorial = false;
		saveUserPreferences({ ...preferences, showUploadTutorial: false });
		if ($isAuthenticated) {
			showInfo('Ready to upload! Drag photos here or click to browse.');
		}
	}

	function skipTutorial() {
		showTutorial = false;
		saveUserPreferences({ ...preferences, showUploadTutorial: false });
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'u':
					event.preventDefault();
					if ($isAuthenticated && !processingFiles) {
						triggerFileSelect();
					}
					break;
				case 'Enter':
					if (hasFilesToUpload && !isUploading) {
						event.preventDefault();
						uploadAll();
					}
					break;
			}
		}
		
		if (event.key === 'Escape' && showLocationEditor) {
			cancelLocationEdit();
		}
	}
</script>

<svelte:head>
	<title>Upload Photos - WhereAmI</title>
	<meta name="description" content="Upload your travel photos with GPS data to create custom geography games and share them with the community." />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

<!-- Tutorial Modal -->
{#if showTutorial}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" transition:fade={{ duration: 200 }}>
		<div class="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl" transition:fly={{ y: 50, duration: 300 }}>
			<div class="text-5xl mb-4" role="img" aria-label="Tutorial step icon">
				{tutorialSteps[tutorialStep].icon}
			</div>
			<h3 class="text-xl font-bold text-gray-800 mb-3">{tutorialSteps[tutorialStep].title}</h3>
			<p class="text-gray-600 mb-6 leading-relaxed">{tutorialSteps[tutorialStep].description}</p>
			
			<div class="flex justify-between items-center">
				<button 
					class="text-sm text-gray-500 hover:text-gray-700 transition-colors"
					on:click={skipTutorial}
				>
					Skip Tutorial
				</button>
				
				<div class="flex gap-2">
					{#each tutorialSteps as _, index}
						<div 
							class="w-2 h-2 rounded-full transition-colors duration-200" 
							class:bg-blue-600={index === tutorialStep} 
							class:bg-gray-300={index !== tutorialStep}
						></div>
					{/each}
				</div>
				
				<button 
					class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
					on:click={nextTutorialStep}
				>
					{tutorialStep === tutorialSteps.length - 1 ? 'Get Started' : 'Next'}
				</button>
			</div>
		</div>
	</div>
{/if}

<div class="upload-page min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
	<!-- Header -->
	<header class="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
			<div class="flex justify-between items-center">
				<div>
					<h1 class="text-3xl font-bold text-gray-900">Upload Photos</h1>
					<p class="text-gray-600 mt-1">
						{#if $isAuthenticated}
							Share your travel photos to create geography games
						{:else}
							Sign in to upload photos and create custom geography games
						{/if}
					</p>
				</div>
				
				<div class="flex items-center gap-3">
					<AuthButton 
						on:login={handleLogin}
						on:logout={handleLogout}
						on:profile={handleProfile}
					/>
					<button 
						class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
						on:click={() => goto('/')}
					>
						← Back
					</button>
					{#if uploadFiles.length > 0}
						<button 
							class="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
							on:click={clearAllFiles}
						>
							Clear All
						</button>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		{#if !$isAuthenticated}
			<!-- Authentication Required -->
			<div class="auth-notice bg-white rounded-2xl shadow-lg p-8 text-center max-w-2xl mx-auto">
				<div class="text-6xl mb-6">🔐</div>
				<h2 class="text-2xl font-bold text-gray-800 mb-4">Sign In Required</h2>
				<p class="text-gray-600 mb-6 text-lg leading-relaxed">
					Authentication helps us organize your uploads and lets you manage your content across devices.
				</p>
				
				<AuthButton 
					size="lg"
					on:login={handleLogin}
					on:logout={handleLogout}
					on:profile={handleProfile}
				/>
				
				<div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
					<div class="flex items-center justify-center gap-2">
						<span class="text-green-600">✓</span>
						<span>Track your uploads</span>
					</div>
					<div class="flex items-center justify-center gap-2">
						<span class="text-green-600">✓</span>
						<span>Create custom games</span>
					</div>
					<div class="flex items-center justify-center gap-2">
						<span class="text-green-600">✓</span>
						<span>Access from anywhere</span>
					</div>
				</div>
			</div>
		{:else}
			<!-- Upload Statistics -->
			{#if uploadFiles.length > 0}
				<div class="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" transition:fly={{ y: -20, duration: 300 }}>
					<div class="stat-card bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
						<div class="text-3xl font-bold text-blue-600 mb-2">{uploadFiles.length}</div>
						<div class="text-sm font-medium text-gray-600">Total Photos</div>
					</div>
					<div class="stat-card bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
						<div class="text-3xl font-bold text-green-600 mb-2">{uploadedCount}</div>
						<div class="text-sm font-medium text-gray-600">Uploaded</div>
						{#if overallProgress > 0}
							<div class="mt-2 bg-gray-200 rounded-full h-2">
								<div 
									class="bg-green-500 h-2 rounded-full transition-all duration-500"
									style="width: {overallProgress}%"
								></div>
							</div>
						{/if}
					</div>
					<div class="stat-card bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
						<div class="text-3xl font-bold text-amber-600 mb-2">{noLocationCount}</div>
						<div class="text-sm font-medium text-gray-600">Need Location</div>
					</div>
					<div class="stat-card bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
						<div class="text-3xl font-bold text-red-600 mb-2">{errorCount}</div>
						<div class="text-sm font-medium text-gray-600">Errors</div>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
				<!-- Upload Area -->
				<div class="xl:col-span-1 space-y-6">
					<!-- Drag & Drop Zone -->
					<div class="upload-section">
						<div
							class="upload-area relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 bg-white shadow-sm"
							class:border-blue-400={dragActive}
							class:bg-blue-50={dragActive}
							class:border-gray-300={!dragActive}
							class:scale-105={dragActive}
							on:dragover={handleDragOver}
							on:dragleave={handleDragLeave}
							on:drop={handleDrop}
							role="button"
							tabindex="0"
							on:click={triggerFileSelect}
							on:keydown={(e) => e.key === 'Enter' && triggerFileSelect()}
						>
							{#if processingFiles}
								<div class="processing-indicator">
									<div class="animate-spin text-4xl mb-4">⚙️</div>
									<h3 class="text-lg font-semibold text-gray-800 mb-2">Processing Files...</h3>
									<p class="text-gray-600">Extracting GPS data and creating previews</p>
								</div>
							{:else}
								<div class="upload-content">
									<div class="text-6xl mb-6 transition-transform duration-300" class:scale-110={dragActive}>
										{dragActive ? '⬇️' : '📸'}
									</div>
									<h3 class="text-xl font-semibold text-gray-800 mb-3">
										{dragActive ? 'Drop your photos here!' : 'Upload Travel Photos'}
									</h3>
									<p class="text-gray-600 mb-6">
										Drag and drop photos or click to browse your files
									</p>
									
									<div class="space-y-3">
										<button 
											class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105"
											on:click|stopPropagation={triggerFileSelect}
										>
											Choose Photos
										</button>
										<div class="text-sm text-gray-500">
											<p class="font-medium">Supported: JPG, PNG, WebP, HEIC</p>
											<p>Max size: {MAX_FILE_SIZE / 1024 / 1024}MB per file</p>
											<p class="mt-2 text-xs">💡 Press Ctrl+U (Cmd+U) to quick upload</p>
										</div>
									</div>
								</div>
							{/if}
							
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

					<!-- Upload Actions -->
					{#if hasFilesToUpload}
						<div class="upload-actions bg-white rounded-2xl p-6 shadow-sm border border-gray-100" transition:fly={{ y: 20, duration: 300 }}>
							<div class="flex justify-between items-center mb-4">
								<h4 class="text-lg font-semibold text-gray-800">Ready to Upload</h4>
								<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
									{pendingCount} photo{pendingCount !== 1 ? 's' : ''}
								</span>
							</div>
							
							<button 
								class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
								disabled={isUploading || pendingCount === 0}
								on:click={uploadAll}
							>
								{#if isUploading}
									<div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
									Uploading...
								{:else}
									<span>🚀</span>
									Upload {pendingCount} Photo{pendingCount !== 1 ? 's' : ''}
								{/if}
							</button>
							
							{#if pendingCount === 0 && noLocationCount > 0}
								<p class="text-amber-600 text-sm mt-3 text-center">
									⚠️ Add locations to photos before uploading
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Photo List -->
				<div class="xl:col-span-2">
					{#if uploadFiles.length === 0}
						<div class="empty-state bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
							<div class="text-6xl mb-6">🌍</div>
							<h3 class="text-xl font-semibold text-gray-800 mb-3">No photos yet</h3>
							<p class="text-gray-600 mb-6">
								Upload photos with GPS data to start creating geography games
							</p>
							<button 
								class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
								on:click={triggerFileSelect}
							>
								Get Started
							</button>
						</div>
					{:else}
						<div class="photo-list space-y-4">
							{#each uploadFiles as file, index (file.id)}
								<div 
									class="photo-item bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
									transition:fly={{ x: -50, duration: 300, delay: index * 50 }}
								>
									<div class="flex flex-col sm:flex-row">
										<!-- Photo Preview -->
										<div class="photo-preview w-full sm:w-32 h-32 bg-gray-100 flex-shrink-0 relative">
											<img 
												src={file.preview} 
												alt="Upload preview"
												class="w-full h-full object-cover"
												loading="lazy"
											/>
											{#if file.uploaded}
												<div class="absolute top-2 right-2 bg-green-600 text-white rounded-full p-1">
													<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
													</svg>
												</div>
											{/if}
										</div>

										<!-- Photo Info -->
										<div class="photo-info flex-1 p-4 sm:p-6">
											<div class="flex justify-between items-start mb-3">
												<h4 class="font-semibold text-gray-800 truncate pr-4 text-lg" title={file.file.name}>
													{file.file.name}
												</h4>
												<button 
													class="text-gray-400 hover:text-red-500 transition-colors p-1"
													on:click={() => removeFile(index)}
													aria-label="Remove photo"
												>
													<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
													</svg>
												</button>
											</div>
											
											<div class="text-sm text-gray-600 mb-3">
												{(file.file.size / 1024 / 1024).toFixed(1)} MB
											</div>
											
											<!-- Location Status -->
											<div class="location-status mb-4">
												{#if file.location}
													<div class="flex items-center text-green-600 text-sm bg-green-50 rounded-lg p-3">
														<span class="mr-2">📍</span>
														<div class="flex-1">
															<div class="font-medium">
																{file.location.lat.toFixed(4)}, {file.location.lng.toFixed(4)}
															</div>
															{#if file.extractedLocation}
																<div class="text-xs text-green-700 mt-1">
																	✨ Extracted from GPS data
																</div>
															{:else}
																<div class="text-xs text-green-700 mt-1">
																	📍 Manually added
																</div>
															{/if}
														</div>
													</div>
												{:else}
													<div class="flex items-center text-amber-600 text-sm bg-amber-50 rounded-lg p-3">
														<span class="mr-2">⚠️</span>
														<span class="flex-1">No location data - click "Add Location" to set</span>
													</div>
												{/if}
											</div>

											<!-- Upload Status & Actions -->
											<div class="status-actions">
												{#if file.uploaded}
													<div class="flex items-center text-green-600 font-medium">
														<span class="mr-2">✅</span>
														<span>Successfully uploaded</span>
													</div>
												{:else if file.uploading}
													<div class="upload-progress">
														<div class="flex justify-between text-sm text-blue-600 mb-2">
															<span>Uploading...</span>
															<span>{Math.round(file.progress)}%</span>
														</div>
														<div class="bg-gray-200 rounded-full h-2 overflow-hidden">
															<div 
																class="bg-blue-600 h-2 rounded-full transition-all duration-300"
																style="width: {file.progress}%"
															></div>
														</div>
													</div>
												{:else if file.error}
													<div class="error-state">
														<div class="text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-3">
															<div class="flex items-center mb-1">
																<span class="mr-2">❌</span>
																<span class="font-medium">Upload failed</span>
															</div>
															<div class="text-xs">{file.error}</div>
														</div>
														{#if file.retryCount < MAX_RETRY_ATTEMPTS}
															<button 
																class="bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
																on:click={() => retryUpload(index)}
															>
																🔄 Retry Upload ({file.retryCount + 1}/{MAX_RETRY_ATTEMPTS})
															</button>
														{:else}
															<div class="text-xs text-gray-500">Maximum retry attempts reached</div>
														{/if}
													</div>
												{:else}
													<div class="actions flex gap-3">
														<button 
															class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
															on:click={() => editLocation(index)}
														>
															<span>{file.location ? '✏️' : '📍'}</span>
															{file.location ? 'Edit Location' : 'Add Location'}
														</button>
														{#if file.location}
															<button 
																class="bg-green-100 hover:bg-green-200 text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
																on:click={() => uploadFile(file)}
																disabled={isUploading}
															>
																🚀 Upload Now
															</button>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Location Editor Modal -->
{#if showLocationEditor}
	<div 
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		transition:fade={{ duration: 200 }}
	>
		<div 
			class="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
			transition:fly={{ y: 50, duration: 300 }}
		>
			<div class="modal-header p-6 border-b border-gray-200 bg-gray-50">
				<h3 class="text-xl font-bold text-gray-800 mb-2">Set Photo Location</h3>
				<p class="text-gray-600">Click on the map to mark where this photo was taken</p>
			</div>
			
			<div class="modal-content p-6">
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<!-- Photo Preview -->
					<div class="photo-section">
						{#if selectedFileIndex !== null}
							<div class="space-y-4">
								<div class="photo-preview-large">
									<img 
										src={uploadFiles[selectedFileIndex].preview}
										alt="Photo preview"
										class="w-full h-64 sm:h-80 object-cover rounded-xl shadow-lg"
									/>
								</div>
								<div class="photo-details bg-gray-50 rounded-xl p-4">
									<h4 class="font-semibold text-gray-800 mb-2">
										{uploadFiles[selectedFileIndex].file.name}
									</h4>
									<div class="text-sm text-gray-600 space-y-1">
										<p>Size: {(uploadFiles[selectedFileIndex].file.size / 1024 / 1024).toFixed(1)} MB</p>
										{#if editingLocation}
											<p class="font-medium text-blue-600">
												📍 {editingLocation.lat.toFixed(6)}, {editingLocation.lng.toFixed(6)}
											</p>
										{:else}
											<p class="text-amber-600">⚠️ Click on the map to set location</p>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					</div>
					
					<!-- Map -->
					<div class="map-section">
						<div class="bg-gray-100 rounded-xl overflow-hidden shadow-inner">
							<Map
								height="400px"
								center={editingLocation || { lat: 20, lng: 0 }}
								zoom={editingLocation ? 10 : 2}
								clickable={true}
								markers={editingLocation ? [{ 
									location: editingLocation, 
									popup: 'Photo location' 
								}] : []}
								on:mapClick={handleMapClick}
							/>
						</div>
						<div class="mt-4 text-sm text-gray-600 bg-blue-50 rounded-lg p-3">
							<p class="font-medium text-blue-800 mb-1">💡 Tips:</p>
							<ul class="text-blue-700 space-y-1">
								<li>• Zoom in for more precise location</li>
								<li>• Use satellite view to identify landmarks</li>
								<li>• Double-click to zoom in quickly</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
			
			<div class="modal-footer p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-4">
				<button 
					class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors"
					on:click={cancelLocationEdit}
				>
					Cancel
				</button>
				<button 
					class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-xl font-medium transition-colors"
					disabled={!editingLocation}
					on:click={saveLocation}
				>
					Save Location
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Authentication Modal -->
<AuthModal isOpen={showAuthModal} on:close={handleAuthModalClose} />

<style>
	.upload-area {
		min-height: 280px;
		cursor: pointer;
	}

	.photo-list {
		max-height: calc(100vh - 300px);
		overflow-y: auto;
	}

	/* Custom scrollbar */
	.photo-list::-webkit-scrollbar {
		width: 8px;
	}

	.photo-list::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 4px;
	}

	.photo-list::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 4px;
	}

	.photo-list::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}

	/* Responsive adjustments */
	@media (max-width: 1280px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (max-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		
		.photo-item .flex {
			flex-direction: column;
		}
		
		.photo-preview {
			width: 100% !important;
		}
	}

	@media (max-width: 640px) {
		.modal-content {
			padding: 1rem;
		}
		
		.modal-header,
		.modal-footer {
			padding: 1rem;
		}
		
		.actions {
			flex-direction: column;
		}
		
		.actions button {
			width: 100%;
		}
	}

	/* Animation improvements */
	.upload-area:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.photo-item:hover {
		transform: translateY(-1px);
	}

	.processing-indicator .animate-spin {
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
