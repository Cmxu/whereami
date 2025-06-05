<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { isAuthenticated } from '$lib/stores/authStore';
	import UserGallery from '$lib/components/UserGallery.svelte';
	import AuthModal from '$lib/components/AuthModal.svelte';
	import Map from '$lib/components/Map.svelte';
	import type { Location } from '$lib/types';
	import { api } from '$lib/utils/api';
	import { showSuccess, showError, showWarning, showInfo } from '$lib/stores/toastStore';
	import { getUserPreferences, saveUserPreferences } from '$lib/utils/localStorage';

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
		customName?: string;
	}

	type TabType = 'gallery' | 'upload';

	let activeTab: TabType = 'gallery';
	let showAuthModal = false;

	// Upload state variables
	let dragActive = false;
	let uploadFiles: UploadFile[] = [];
	let selectedFileIndex: number | null = null;
	let showLocationEditor = false;
	let editingLocation: Location | null = null;
	let isUploading = false;
	let exifr: any = null;
	let fileInputRef: HTMLInputElement;
	let processingFiles = false;

	// Constants
	const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
	const MAX_RETRY_ATTEMPTS = 3;
	const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

	// Computed values
	$: uploadedCount = uploadFiles.filter((f) => f.uploaded).length;
	$: pendingCount = uploadFiles.filter((f) => !f.uploaded && f.location && !f.error).length;
	$: errorCount = uploadFiles.filter((f) => f.error).length;
	$: noLocationCount = uploadFiles.filter((f) => !f.location && !f.uploaded).length;
	$: hasFilesToUpload = pendingCount > 0;
	$: overallProgress = uploadFiles.length > 0 ? (uploadedCount / uploadFiles.length) * 100 : 0;

	// Handle URL parameters
	onMount(async () => {
		// Load EXIF reader library
		await loadExifReader();
		
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

	async function extractGPS(file: File): Promise<Location | null> {
		if (!exifr) {
			console.log(`EXIF reader not available for ${file.name}`);
			return null;
		}

		try {
			console.log(`Starting GPS extraction for ${file.name}...`);
			// Use a more efficient approach - only extract GPS data
			const gps = await exifr.gps(file);
			console.log(`GPS extraction result for ${file.name}:`, gps);
			
			if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
				// Round to 6 decimal places (approximately 0.1m precision)
				const location = {
					lat: Math.round(gps.latitude * 1000000) / 1000000,
					lng: Math.round(gps.longitude * 1000000) / 1000000
				};
				console.log(`Successfully extracted GPS from ${file.name}:`, location);
				return location;
			} else {
				console.log(`No valid GPS coordinates found in ${file.name}`);
				return null;
			}
		} catch (error) {
			console.warn('Failed to extract GPS data from', file.name, ':', error);
			// Don't let GPS extraction errors break the file processing
			return null;
		}
	}

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
		// Check file type
		if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
			return {
				valid: false,
				error: `Unsupported format. Please use: ${SUPPORTED_FORMATS.map((f) => f.split('/')[1].toUpperCase()).join(', ')}`
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

	async function processFiles(files: FileList | File[]) {
		if (files.length === 0) return;

		console.log('=== PROCESSING FILES ===');
		console.log(`Starting to process ${files.length} files:`);
		console.log('Files:', Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })));

		processingFiles = true;
		const newFiles: UploadFile[] = [];
		let validFileCount = 0;
		let gpsExtractedCount = 0;
		let invalidFiles: string[] = [];

		// Enhanced feedback for multiple files
		if (files.length === 1) {
			showInfo(`Processing 1 file...`);
		} else {
			showInfo(`Processing ${files.length} files... 📚`);
		}

		// Process files sequentially to avoid overwhelming the system
		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			console.log(`Processing file ${i + 1}/${files.length}: ${file.name}`);
			
			try {
				// Validate file
				const validation = validateFile(file);
				if (!validation.valid) {
					console.log(`File ${file.name} failed validation:`, validation.error);
					invalidFiles.push(`${file.name}: ${validation.error}`);
					continue;
				}

				validFileCount++;
				console.log(`File ${file.name} passed validation`);

				// Create preview URL
				const preview = URL.createObjectURL(file);
				console.log(`Created preview URL for ${file.name}`);

				// Try to extract GPS data
				console.log(`Extracting GPS data from ${file.name}...`);
				const extractedLocation = await extractGPS(file);
				
				if (extractedLocation) {
					console.log(`GPS data extracted from ${file.name}:`, extractedLocation);
					gpsExtractedCount++;
				} else {
					console.log(`No GPS data found in ${file.name}`);
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
					retryCount: 0,
					customName: file.name.split('.').slice(0, -1).join('.')
				};

				newFiles.push(uploadFile);
				console.log(`Added ${file.name} to processing queue. Queue now has ${newFiles.length} files`);
			} catch (error) {
				console.error(`Error processing file ${file.name}:`, error);
				invalidFiles.push(`${file.name}: Processing error - ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
			
			console.log(`Completed processing file ${i + 1}/${files.length}: ${file.name}`);
		}

		console.log(`Loop completed! Processed all ${files.length} files`);
		console.log(`Processed ${validFileCount} valid files out of ${files.length} total`);

		console.log('Current uploadFiles before adding new ones:', uploadFiles.length);

		// Add valid files to the list
		uploadFiles = [...uploadFiles, ...newFiles];
		
		console.log('New uploadFiles after adding:', uploadFiles.length);
		console.log('All files in uploadFiles:', uploadFiles.map(f => f.file.name));

		processingFiles = false;

		// Enhanced feedback for multiple files
		if (validFileCount > 0) {
			const message = validFileCount === 1 
				? `Added 1 photo${gpsExtractedCount > 0 ? ' (with GPS data)' : ''}` 
				: `Added ${validFileCount} photos${gpsExtractedCount > 0 ? ` (${gpsExtractedCount} with GPS data)` : ''} 🎉`;
			showSuccess(message);
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

		console.log('=== FILE PROCESSING COMPLETE ===');
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		console.log('=== FILE SELECTION EVENT ===');
		console.log('Input files length:', input.files?.length);
		
		if (input.files && input.files.length > 0) {
			console.log(`Selected ${input.files.length} file(s):`);
			for (let i = 0; i < input.files.length; i++) {
				console.log(`  ${i + 1}. ${input.files[i].name} (${input.files[i].size} bytes, ${input.files[i].type})`);
			}
			
			// Check if we're already processing files
			if (processingFiles) {
				console.log('WARNING: Already processing files, skipping this selection');
				return;
			}
			
			// CRITICAL FIX: Copy FileList to Array before clearing input
			// This prevents the FileList from being corrupted when we clear input.value
			const filesArray = Array.from(input.files);
			
			// Clear the input value to allow selecting the same files again
			input.value = '';
			
			// Process the file array instead of the original FileList
			processFiles(filesArray);
		} else {
			console.log('No files selected or input.files is null');
		}
		
		console.log('=== FILE SELECTION EVENT COMPLETE ===');
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

			// Upload the image with custom name if provided
			const imageId = await api.uploadImage(
				file.file, 
				file.location, 
				file.customName || undefined
			);

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

		// Enhanced feedback for multiple file uploads
		if (filesToUpload.length === 1) {
			showInfo('Starting upload...');
		} else {
			showInfo(`Starting batch upload of ${filesToUpload.length} photos... 🚀`);
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

		// Enhanced completion feedback
		if (completed > 0 && failed === 0) {
			const message = completed === 1 
				? 'Successfully uploaded 1 photo! 🎉'
				: `Successfully uploaded all ${completed} photos! 🎉`;
			showSuccess(message);
		} else if (completed > 0 && failed > 0) {
			showSuccess(`Successfully uploaded ${completed} photo${completed !== 1 ? 's' : ''}! 🎉`);
			showError(`${failed} upload${failed !== 1 ? 's' : ''} failed. Check errors and retry.`);
		} else if (failed > 0) {
			showError(`All ${failed} upload${failed !== 1 ? 's' : ''} failed. Check errors and retry.`);
		}
	}

	function clearAllFiles() {
		uploadFiles.forEach(file => URL.revokeObjectURL(file.preview));
		uploadFiles = [];
		selectedFileIndex = null;
		showLocationEditor = false;
		showInfo('All photos cleared');
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
			// CRITICAL FIX: Copy FileList to Array to prevent corruption
			const filesArray = Array.from(files);
			processFiles(filesArray);
		}
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.ctrlKey || event.metaKey) {
			switch (event.key) {
				case 'u':
					event.preventDefault();
					if ($isAuthenticated && !processingFiles && activeTab === 'upload') {
						triggerFileSelect();
					}
					break;
				case 'Enter':
					if (hasFilesToUpload && !isUploading && activeTab === 'upload') {
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
	<title>Gallery - WhereAmI</title>
	<meta name="description" content="View and manage your uploaded photos for geography games." />
</svelte:head>

<svelte:window on:keydown={handleKeydown} />

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
					<!-- Upload Statistics -->
					{#if uploadFiles.length > 0}
						<div class="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" transition:fly={{ y: -20, duration: 300 }}>
							<div class="stat-card rounded-xl p-6 text-center shadow-sm border" style="background-color: var(--bg-primary); border-color: var(--border-color);">
								<div class="text-3xl font-bold text-blue-600 mb-2">{uploadFiles.length}</div>
								<div class="text-sm font-medium" style="color: var(--text-secondary);">Total Photos</div>
							</div>
							<div class="stat-card rounded-xl p-6 text-center shadow-sm border" style="background-color: var(--bg-primary); border-color: var(--border-color);">
								<div class="text-3xl font-bold text-green-600 mb-2">{uploadedCount}</div>
								<div class="text-sm font-medium" style="color: var(--text-secondary);">Uploaded</div>
								{#if overallProgress > 0}
									<div class="mt-2 bg-gray-200 rounded-full h-2">
										<div 
											class="bg-green-500 h-2 rounded-full transition-all duration-500"
											style="width: {overallProgress}%"
										></div>
									</div>
								{/if}
							</div>
							<div class="stat-card rounded-xl p-6 text-center shadow-sm border" style="background-color: var(--bg-primary); border-color: var(--border-color);">
								<div class="text-3xl font-bold text-amber-600 mb-2">{noLocationCount}</div>
								<div class="text-sm font-medium" style="color: var(--text-secondary);">Need Location</div>
							</div>
							<div class="stat-card rounded-xl p-6 text-center shadow-sm border" style="background-color: var(--bg-primary); border-color: var(--border-color);">
								<div class="text-3xl font-bold text-red-600 mb-2">{errorCount}</div>
								<div class="text-sm font-medium" style="color: var(--text-secondary);">Errors</div>
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
						<!-- Upload Area -->
						<div class="xl:col-span-1 space-y-6">
							<!-- Drag & Drop Zone -->
							<div
								class="upload-area relative border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 shadow-sm"
								class:border-blue-400={dragActive}
								class:bg-blue-50={dragActive}
								class:border-gray-300={!dragActive}
								class:scale-105={dragActive}
								style="background-color: var(--bg-primary); border-color: {dragActive ? '#60a5fa' : 'var(--border-color)'};  min-height: 220px;"
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
										<div class="animate-spin text-3xl mb-3">⚙️</div>
										<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">Processing Files...</h3>
										<p class="text-sm" style="color: var(--text-secondary);">Extracting GPS data and creating previews</p>
										<div class="mt-3 bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm">
											✨ Multiple files processing
										</div>
									</div>
								{:else}
									<div class="upload-content">
										<div class="text-4xl mb-4 transition-transform duration-300" class:scale-110={dragActive}>
											{dragActive ? '⬇️' : '📸'}
										</div>
										<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">
											{dragActive ? 'Drop your photos here!' : 'Upload Travel Photos'}
										</h3>
										<p class="mb-4 text-sm" style="color: var(--text-secondary);">
											{dragActive ? 'Drop multiple photos at once!' : 'Drag and drop photos or click to browse'}
										</p>
										
										<div class="space-y-2">
											<button
												class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
												on:click|stopPropagation={triggerFileSelect}
											>
												Choose Photos
											</button>
											<div class="text-xs" style="color: var(--text-secondary);">
												<p class="font-medium">✨ Multi-select: Ctrl+Click, Shift+Click, or Ctrl+A</p>
												<p class="mt-1">JPG, PNG, WebP, HEIC • Max {MAX_FILE_SIZE / 1024 / 1024}MB • Ctrl+U to upload</p>
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

							<!-- Upload Actions -->
							{#if hasFilesToUpload}
								<div class="upload-actions rounded-2xl p-6 shadow-sm border" style="background-color: var(--bg-primary); border-color: var(--border-color);" transition:fly={{ y: 20, duration: 300 }}>
									<div class="flex justify-between items-center mb-4">
										<h4 class="text-lg font-semibold" style="color: var(--text-primary);">Ready to Upload</h4>
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

							<!-- Clear All Button -->
							{#if uploadFiles.length > 0}
								<button 
									class="w-full bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
									on:click={clearAllFiles}
								>
									Clear All Photos
								</button>
							{/if}
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
										Upload photos with GPS data to start creating geography games
									</p>
									<p class="text-sm mb-6" style="color: var(--text-secondary);">
										💡 <strong>Tip:</strong> Hold Ctrl (or Cmd) and click to select multiple photos at once
									</p>
									<button 
										class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
										on:click={triggerFileSelect}
									>
										Choose Photos
									</button>
								</div>
							{:else}
								<div class="photo-list space-y-4">
									{#each uploadFiles as file, index (file.id)}
										<div
											class="photo-item rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
											style="background-color: var(--bg-primary); border-color: var(--border-color);"
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
														<h4 class="font-semibold truncate pr-4 text-lg" title={file.file.name} style="color: var(--text-primary);">
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

													<!-- Custom Name Input -->
													<div class="custom-name-input mb-4">
														<label class="block text-sm font-medium mb-2" style="color: var(--text-primary);">
															Photo Name
														</label>
														<input
															type="text"
															class="input-field w-full"
															placeholder="Enter custom name..."
															bind:value={file.customName}
															on:input={() => uploadFiles = [...uploadFiles]}
														/>
														<p class="text-xs mt-1" style="color: var(--text-secondary);">
															Leave empty to use original filename
														</p>
													</div>
													
													<div class="text-sm mb-3" style="color: var(--text-secondary);">
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
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Location Editor Modal -->
{#if showLocationEditor}
	<div 
		class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		transition:fade={{ duration: 200 }}
	>
		<div 
			class="rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
			style="background-color: var(--bg-primary);"
			transition:fly={{ y: 50, duration: 300 }}
		>
			<div class="modal-header p-6 border-b" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
				<h3 class="text-xl font-bold mb-2" style="color: var(--text-primary);">Set Photo Location</h3>
				<p style="color: var(--text-secondary);">Click on the map to mark where this photo was taken</p>
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
								<div class="photo-details rounded-xl p-4" style="background-color: var(--bg-secondary);">
									<h4 class="font-semibold mb-2" style="color: var(--text-primary);">
										{uploadFiles[selectedFileIndex].file.name}
									</h4>
									<div class="text-sm space-y-1" style="color: var(--text-secondary);">
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
						<div class="mt-4 text-sm bg-blue-50 rounded-lg p-3" style="color: var(--text-secondary);">
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
			
			<div class="modal-footer p-6 border-t flex justify-end gap-4" style="background-color: var(--bg-secondary); border-color: var(--border-color);">
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

	/* Upload-specific styles */
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

	/* Animation improvements */
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
</style>
