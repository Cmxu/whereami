<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	
	export let type: 'success' | 'error' | 'warning' | 'info' = 'info';
	export let message: string;
	export let duration: number = 5000;
	export let position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' = 'top-right';
	export let dismissible: boolean = true;
	export let id: string;

	const dispatch = createEventDispatcher<{
		dismiss: string;
	}>();

	let visible = false;
	let timeoutId: ReturnType<typeof setTimeout>;

	const icons = {
		success: '✅',
		error: '❌',
		warning: '⚠️',
		info: 'ℹ️'
	};

	const colors = {
		success: 'bg-green-50 border-green-500 text-green-800',
		error: 'bg-red-50 border-red-500 text-red-800',
		warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
		info: 'bg-blue-50 border-blue-500 text-blue-800'
	};

	onMount(() => {
		visible = true;
		
		if (duration > 0) {
			timeoutId = setTimeout(() => {
				dismiss();
			}, duration);
		}

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});

	function dismiss() {
		visible = false;
		setTimeout(() => {
			dispatch('dismiss', id);
		}, 300); // Wait for exit animation
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && dismissible) {
			dismiss();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<div
		class="toast fixed z-50 max-w-sm w-full shadow-lg rounded-lg border-l-4 p-4 transition-all duration-300 {colors[type]}"
		class:top-4={position.includes('top')}
		class:bottom-4={position.includes('bottom')}
		class:right-4={position.includes('right')}
		class:left-4={position.includes('left')}
		class:slide-in-right={position.includes('right')}
		class:slide-in-left={position.includes('left')}
		role="alert"
		aria-live="polite"
	>
		<div class="flex items-start">
			<div class="flex-shrink-0 mr-3">
				<span class="text-lg">{icons[type]}</span>
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium leading-5">
					{message}
				</p>
			</div>
			{#if dismissible}
				<div class="ml-3 flex-shrink-0">
					<button
						class="inline-flex text-sm font-medium hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-opacity duration-200"
						on:click={dismiss}
						aria-label="Dismiss notification"
					>
						<span class="sr-only">Close</span>
						<span class="text-lg">×</span>
					</button>
				</div>
			{/if}
		</div>
		
		<!-- Progress bar for auto-dismiss -->
		{#if duration > 0}
			<div class="progress-container mt-2 h-1 bg-black/10 rounded-full overflow-hidden">
				<div 
					class="progress-bar h-full bg-current opacity-30 transition-all duration-linear"
					style="animation-duration: {duration}ms"
				></div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.slide-in-right {
		transform: translateX(0);
		animation: slideInRight 0.3s ease-out;
	}

	.slide-in-left {
		transform: translateX(0);
		animation: slideInLeft 0.3s ease-out;
	}

	@keyframes slideInRight {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideInLeft {
		from {
			transform: translateX(-100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.progress-bar {
		animation-name: shrink;
		animation-timing-function: linear;
		animation-fill-mode: forwards;
	}

	@keyframes shrink {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
			transition: none;
		}
		
		.progress-bar {
			animation: none;
		}
	}
</style> 