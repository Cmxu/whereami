<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { gameState, gameSettings } from '$lib/stores/gameStore';
	import { isAuthenticated } from '$lib/stores/authStore';
	import { showSuccess, showError } from '$lib/stores/toastStore';
	import AuthModal from './AuthModal.svelte';
	
	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	export let visible = false;

	let showAuthModal = false;
	let saving = false;
	let wasAuthenticated = false;

	$: score = $gameState.totalScore;
	$: maxPossible = $gameState.rounds.length * 10000;
	$: percentage = Math.round((score / maxPossible) * 100);

	function handleCreateAccount() {
		wasAuthenticated = $isAuthenticated;
		showAuthModal = true;
	}

	function handleSkip() {
		dispatch('close');
	}

	async function handleAuthModalClose() {
		showAuthModal = false;
		
		// Check if user became authenticated during the modal
		if (!wasAuthenticated && $isAuthenticated) {
			// User successfully signed up/in
			saving = true;
			
			try {
				// Import the API dynamically to avoid circular dependencies
				const { api } = await import('$lib/utils/api');
				
				if (api.isAuthenticated && $gameSettings.gameMode === 'custom' && $gameSettings.gameId) {
					// Prepare round data for score submission
					const roundData = $gameState.rounds.map((round, index) => ({
						id: index + 1,
						imageId: round.image.id,
						imageLocation: round.image.location,
						userGuess: round.userGuess,
						score: round.score,
						distance: round.distance,
						formattedDistance: round.formattedDistance,
						formattedDistanceUnit: round.formattedDistanceUnit
					}));

					await api.submitScore(
						$gameSettings.gameId,
						score,
						maxPossible,
						$gameState.rounds.length,
						roundData
					);

					showSuccess('Account created and score saved to leaderboard!');
				} else {
					showSuccess('Account created successfully!');
				}
			} catch (error) {
				console.error('Error saving score after account creation:', error);
				showError('Account created, but failed to save score. You can play again to save your score.');
			} finally {
				saving = false;
				dispatch('close');
			}
		}
	}
</script>

{#if visible}
	<div
		class="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background-color: rgba(0, 0, 0, 0.5);"
	>
		<div
			class="modal bg-white rounded-lg shadow-xl max-w-md w-full p-6"
			style="background-color: var(--bg-primary); border: 1px solid var(--border-color);"
		>
			<!-- Header -->
			<div class="text-center mb-6">
				<div class="text-5xl mb-4">🎯</div>
				<h2 class="text-2xl font-bold mb-2" style="color: var(--text-primary);">
					Great Score!
				</h2>
				<p class="text-lg font-semibold" style="color: var(--text-secondary);">
					You scored {score.toLocaleString()} points ({percentage}%)
				</p>
			</div>

			<!-- Benefits -->
			<div class="mb-6">
				<p class="text-center mb-4" style="color: var(--text-secondary);">
					Create an account to save this score to the leaderboard and:
				</p>
				<ul class="space-y-2" style="color: var(--text-secondary);">
					<li class="flex items-center gap-3">
						<span class="text-green-500">✓</span>
						<span>Save your score to the game leaderboard</span>
					</li>
					<li class="flex items-center gap-3">
						<span class="text-green-500">✓</span>
						<span>Track your progress across games</span>
					</li>
					<li class="flex items-center gap-3">
						<span class="text-green-500">✓</span>
						<span>Create and share your own games</span>
					</li>
					<li class="flex items-center gap-3">
						<span class="text-green-500">✓</span>
						<span>Rate and comment on games</span>
					</li>
				</ul>
			</div>

			<!-- Actions -->
			<div class="flex flex-col gap-3">
				<button 
					class="btn-primary w-full" 
					on:click={handleCreateAccount}
					disabled={saving}
				>
					{saving ? 'Saving Score...' : 'Create Account & Save Score'}
				</button>
				<button 
					class="btn-secondary w-full" 
					on:click={handleSkip}
					disabled={saving}
				>
					Maybe Later
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Auth Modal -->
<AuthModal 
	bind:isOpen={showAuthModal} 
	on:close={handleAuthModalClose}
/>

<style>
	.modal-overlay {
		animation: fadeIn 0.2s ease-out;
	}

	.modal {
		animation: slideInUp 0.3s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style> 