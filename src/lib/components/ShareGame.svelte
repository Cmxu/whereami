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

	let copying = false;
	let shareUrl = '';

	function generateShareUrl() {
		// Generate direct game URL instead of using share tokens
		const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
		shareUrl = `${baseUrl}/games/${game.id}`;
	}

	async function copyShareUrl() {
		try {
			await copyToClipboard(shareUrl);
			dispatch('shared', { platform: 'copy', success: true });
		} catch (err) {
			console.error('Copy failed:', err);
			dispatch('shared', { platform: 'copy', success: false });
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
	$: if (showModal && !shareUrl) {
		generateShareUrl();
	}
</script>

{#if showModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="card rounded-xl max-w-md w-full overflow-hidden">
			<div class="share-header p-6" style="border-bottom: 1px solid var(--border-color);">
				<div class="flex justify-between items-center">
					<h3 class="text-lg font-semibold" style="color: var(--text-primary);">Share Game</h3>
					<button class="hover-opacity" style="color: var(--text-secondary);" on:click={closeModal}>
						✕
					</button>
				</div>
				{#if score !== undefined}
					<p class="text-sm mt-1" style="color: var(--text-secondary);">
						You scored {score.toLocaleString()} points!
					</p>
				{/if}
			</div>

			<div class="share-content p-6">
				<!-- Game Preview -->
				<div class="game-preview rounded-lg p-4 mb-6" style="background-color: var(--bg-tertiary);">
					<h4 class="font-medium mb-1" style="color: var(--text-primary);">{game.name}</h4>
					<p class="text-sm mb-2" style="color: var(--text-secondary);">
						{game.description || 'A custom geography game'}
					</p>
					<div class="flex items-center text-xs" style="color: var(--text-tertiary);">
						<span class="mr-3">📸 {game.imageIds.length} photos</span>
						<span class="mr-3">🎮 {game.playCount} plays</span>
						{#if game.rating}
							<span>⭐ {game.rating.toFixed(1)}</span>
						{/if}
					</div>
				</div>

				<!-- Share URL -->
				{#if shareUrl}
					<div class="share-url">
						<label
							for="share-url-input"
							class="block text-sm font-medium mb-2"
							style="color: var(--text-primary);"
						>
							Share URL
						</label>
						<div class="flex gap-2">
							<input
								id="share-url-input"
								type="text"
								readonly
								value={shareUrl}
								class="input-field flex-1"
								style="background-color: var(--bg-tertiary); color: var(--text-primary); border-color: var(--border-color);"
							/>
							<button
								class="btn-secondary text-sm flex items-center gap-1"
								disabled={copying}
								on:click={copyShareUrl}
								aria-label="Copy share URL to clipboard"
							>
								{#if copying}
									<span class="text-green-600">✓</span>
									<span>Copied</span>
								{:else}
									<span>🔗</span>
									<span>Copy</span>
								{/if}
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
