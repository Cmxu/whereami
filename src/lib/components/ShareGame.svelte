<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { CustomGame, SocialShare } from '$lib/types';
	import { api } from '$lib/utils/api';

	export let game: CustomGame;
	export let score: number | undefined = undefined;
	export let showModal: boolean = false;

	const dispatch = createEventDispatcher<{
		close: void;
		shared: { platform: string; success: boolean };
	}>();

	let shareUrl = '';
	let copying = false;
	let shareLink: any = null;
	let generateShareLinkError = '';

	const platforms = [
		{ id: 'twitter', name: 'Twitter', icon: '🐦', color: 'bg-blue-400' },
		{ id: 'facebook', name: 'Facebook', icon: '📘', color: 'bg-blue-600' },
		{ id: 'reddit', name: 'Reddit', icon: '🔴', color: 'bg-orange-500' },
		{ id: 'copy', name: 'Copy Link', icon: '📋', color: 'bg-gray-600' }
	] as const;

	async function generateShareUrl() {
		try {
			shareLink = await api.createShareLink(game.id);
			shareUrl = shareLink.shareUrl;
		} catch (err) {
			generateShareLinkError = err instanceof Error ? err.message : 'Failed to generate share link';
		}
	}

	async function handleShare(platform: SocialShare['platform']) {
		try {
			const share: SocialShare = {
				platform,
				gameId: game.id,
				score
			};

			const content = api.generateSocialShareContent(share);

			if (platform === 'copy') {
				await copyToClipboard(content.text);
				dispatch('shared', { platform, success: true });
			} else {
				window.open(content.url, '_blank', 'width=600,height=400');
				dispatch('shared', { platform, success: true });
			}
		} catch (err) {
			console.error('Share failed:', err);
			dispatch('shared', { platform, success: false });
		}
	}

	async function copyToClipboard(text: string) {
		try {
			copying = true;
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(text);
			} else {
				// Fallback for older browsers
				const textArea = document.createElement('textarea');
				textArea.value = text;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				textArea.style.top = '-999999px';
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				document.execCommand('copy');
				textArea.remove();
			}
		} finally {
			copying = false;
		}
	}

	function closeModal() {
		showModal = false;
		dispatch('close');
	}

	// Generate share URL when modal opens
	$: if (showModal && !shareUrl && !shareLink) {
		generateShareUrl();
	}
</script>

{#if showModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl max-w-md w-full overflow-hidden">
			<div class="share-header p-6 border-b">
				<div class="flex justify-between items-center">
					<h3 class="text-lg font-semibold text-gray-800">Share Game</h3>
					<button class="text-gray-500 hover:text-gray-700" on:click={closeModal}> ✕ </button>
				</div>
				<p class="text-sm text-gray-600 mt-1">
					Share "{game.name}" with friends
					{#if score !== undefined}
						• You scored {score.toLocaleString()} points!
					{/if}
				</p>
			</div>

			<div class="share-content p-6">
				<!-- Game Preview -->
				<div class="game-preview bg-gray-50 rounded-lg p-4 mb-6">
					<h4 class="font-medium text-gray-800 mb-1">{game.name}</h4>
					<p class="text-sm text-gray-600 mb-2">
						{game.description || 'A custom geography game'}
					</p>
					<div class="flex items-center text-xs text-gray-500">
						<span class="mr-3">📸 {game.imageIds.length} photos</span>
						<span class="mr-3">🎮 {game.playCount} plays</span>
						{#if game.rating}
							<span>⭐ {game.rating.toFixed(1)}</span>
						{/if}
					</div>
				</div>

				<!-- Share URL -->
				{#if shareUrl}
					<div class="share-url mb-6">
						<label for="share-url-input" class="block text-sm font-medium text-gray-700 mb-2">
							Share URL
						</label>
						<div class="flex gap-2">
							<input
								id="share-url-input"
								type="text"
								readonly
								value={shareUrl}
								class="input-field flex-1 bg-gray-50"
							/>
							<button
								class="btn-secondary text-sm"
								disabled={copying}
								on:click={() => copyToClipboard(shareUrl)}
								aria-label="Copy share URL to clipboard"
							>
								{copying ? '📋' : '📋'}
							</button>
						</div>
					</div>
				{:else if generateShareLinkError}
					<div class="error-message mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
						<p class="text-sm text-red-600">{generateShareLinkError}</p>
					</div>
				{:else}
					<div class="loading-state mb-6 text-center">
						<div class="loading-spinner mx-auto mb-2"></div>
						<p class="text-sm text-gray-600">Generating share link...</p>
					</div>
				{/if}

				<!-- Platform Buttons -->
				<div class="share-platforms">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Share on social media</h4>
					<div class="grid grid-cols-2 gap-3">
						{#each platforms as platform}
							<button
								class="share-btn flex items-center gap-3 p-3 rounded-lg border hover:shadow-md transition-all duration-200"
								class:opacity-50={!shareUrl && platform.id !== 'copy'}
								disabled={!shareUrl && platform.id !== 'copy'}
								on:click={() => handleShare(platform.id)}
							>
								<div
									class="share-icon w-8 h-8 {platform.color} rounded-lg flex items-center justify-center text-white text-sm"
								>
									{platform.icon}
								</div>
								<span class="text-sm font-medium text-gray-700">{platform.name}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Additional Info -->
				<div class="additional-info mt-6 p-3 bg-blue-50 rounded-lg">
					<p class="text-xs text-blue-700">
						💡 Share links are valid for 30 days and track access for analytics
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.share-btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	.share-icon {
		flex-shrink: 0;
	}

	.loading-spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #f3f4f6;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
