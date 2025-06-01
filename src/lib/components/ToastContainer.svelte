<script lang="ts">
	import { toasts, removeToast } from '$lib/stores/toastStore';
	import Toast from './Toast.svelte';

	function handleDismiss(event: CustomEvent<string>) {
		removeToast(event.detail);
	}
</script>

<!-- Toast container for each position -->
<div class="toast-container">
	<!-- Top Right -->
	{#if $toasts.some(t => t.position === 'top-right')}
		<div class="toast-position top-right fixed top-0 right-0 p-4 space-y-2 z-50 pointer-events-none">
			{#each $toasts.filter(t => t.position === 'top-right') as toast (toast.id)}
				<div class="pointer-events-auto">
					<Toast
						{...toast}
						on:dismiss={handleDismiss}
					/>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Top Left -->
	{#if $toasts.some(t => t.position === 'top-left')}
		<div class="toast-position top-left fixed top-0 left-0 p-4 space-y-2 z-50 pointer-events-none">
			{#each $toasts.filter(t => t.position === 'top-left') as toast (toast.id)}
				<div class="pointer-events-auto">
					<Toast
						{...toast}
						on:dismiss={handleDismiss}
					/>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Bottom Right -->
	{#if $toasts.some(t => t.position === 'bottom-right')}
		<div class="toast-position bottom-right fixed bottom-0 right-0 p-4 space-y-2 z-50 pointer-events-none">
			{#each $toasts.filter(t => t.position === 'bottom-right') as toast (toast.id)}
				<div class="pointer-events-auto">
					<Toast
						{...toast}
						on:dismiss={handleDismiss}
					/>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Bottom Left -->
	{#if $toasts.some(t => t.position === 'bottom-left')}
		<div class="toast-position bottom-left fixed bottom-0 left-0 p-4 space-y-2 z-50 pointer-events-none">
			{#each $toasts.filter(t => t.position === 'bottom-left') as toast (toast.id)}
				<div class="pointer-events-auto">
					<Toast
						{...toast}
						on:dismiss={handleDismiss}
					/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.toast-position {
		max-width: 100vw;
		overflow: hidden;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.toast-position {
			left: 1rem !important;
			right: 1rem !important;
			width: auto;
		}

		.pointer-events-auto {
			max-width: calc(100vw - 2rem);
		}
	}
</style> 