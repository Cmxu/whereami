<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/utils/api';

	export let gameId: string;

	interface LeaderboardEntry {
		userId: string;
		username: string;
		score: number;
		percentage: number;
		playedAt: string;
		rank: number;
	}

	interface LeaderboardData {
		averageScore: number;
		averagePercentage: number;
		totalPlays: number;
		uniquePlayers: number;
		leaderboard: LeaderboardEntry[];
	}

	let leaderboardData: LeaderboardData | null = null;
	let loading = true;
	let error = '';

	onMount(() => {
		loadLeaderboard();
	});

	async function loadLeaderboard() {
		try {
			loading = true;
			error = '';
			leaderboardData = await api.getGameLeaderboard(gameId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load leaderboard';
		} finally {
			loading = false;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatScore(score: number): string {
		return score.toLocaleString();
	}

	function getPercentageColor(percentage: number): string {
		if (percentage >= 90) return 'text-green-600';
		if (percentage >= 75) return 'text-blue-600';
		if (percentage >= 60) return 'text-yellow-600';
		if (percentage >= 40) return 'text-orange-600';
		return 'text-red-600';
	}

	function getRankIcon(rank: number): string {
		switch (rank) {
			case 1: return '🥇';
			case 2: return '🥈';
			case 3: return '🥉';
			default: return `${rank}`;
		}
	}
</script>

<div class="game-leaderboard">
	<!-- Loading State -->
	{#if loading}
		<div class="loading-container text-center py-8">
			<div class="loading-spinner mx-auto mb-4"></div>
			<p style="color: var(--text-secondary);">Loading leaderboard...</p>
		</div>
	{/if}

	<!-- Error State -->
	{#if error && !loading}
		<div class="error-container text-center py-8">
			<div class="text-red-500 text-4xl mb-2">⚠️</div>
			<p class="text-red-600">{error}</p>
			<button class="btn-secondary mt-3" on:click={loadLeaderboard}>
				🔄 Try Again
			</button>
		</div>
	{/if}

	<!-- Leaderboard Content -->
	{#if leaderboardData && !loading}
		<!-- Statistics Summary -->
		<div class="card p-6 mb-6">
			<h2 class="text-xl font-semibold mb-4" style="color: var(--text-primary);">Leaderboard & Stats</h2>
			<div class="stats-summary grid grid-cols-2 md:grid-cols-4 gap-4">
				<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="stat-value text-2xl font-bold text-blue-600">
						{formatScore(leaderboardData.averageScore)}
					</div>
					<div class="stat-label text-sm" style="color: var(--text-secondary);">Average Score</div>
				</div>
				<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="stat-value text-2xl font-bold text-green-600">
						{leaderboardData.averagePercentage}%
					</div>
					<div class="stat-label text-sm" style="color: var(--text-secondary);">Average Accuracy</div>
				</div>
				<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="stat-value text-2xl font-bold text-purple-600">
						{leaderboardData.totalPlays}
					</div>
					<div class="stat-label text-sm" style="color: var(--text-secondary);">Total Plays</div>
				</div>
				<div class="stat-item text-center p-3 rounded-lg" style="background-color: var(--bg-tertiary);">
					<div class="stat-value text-2xl font-bold text-orange-600">
						{leaderboardData.uniquePlayers}
					</div>
					<div class="stat-label text-sm" style="color: var(--text-secondary);">Players</div>
				</div>
			</div>
		</div>

		<!-- Leaderboard Table -->
		{#if leaderboardData.leaderboard.length > 0}
			<div class="leaderboard-table card p-6">
				<h3 class="text-lg font-semibold mb-4" style="color: var(--text-primary);">Top Players</h3>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b" style="border-color: var(--border-color);">
								<th class="text-left py-2 px-2" style="color: var(--text-secondary);">Rank</th>
								<th class="text-left py-2 px-2" style="color: var(--text-secondary);">Player</th>
								<th class="text-right py-2 px-2" style="color: var(--text-secondary);">Score</th>
								<th class="text-right py-2 px-2" style="color: var(--text-secondary);">Accuracy</th>
								<th class="text-right py-2 px-2" style="color: var(--text-secondary);">Date</th>
							</tr>
						</thead>
						<tbody>
							{#each leaderboardData.leaderboard as entry}
								<tr class="border-b" style="border-color: var(--border-color);">
									<td class="py-3 px-2">
										<div class="flex items-center gap-2">
											<span class="text-lg">
												{getRankIcon(entry.rank)}
											</span>
										</div>
									</td>
									<td class="py-3 px-2">
										<div class="player-info">
											<div class="font-medium" style="color: var(--text-primary);">{entry.username}</div>
										</div>
									</td>
									<td class="py-3 px-2 text-right">
										<div class="font-bold text-lg" style="color: var(--text-primary);">
											{formatScore(entry.score)}
										</div>
									</td>
									<td class="py-3 px-2 text-right">
										<div class="font-medium {getPercentageColor(entry.percentage)}">
											{entry.percentage}%
										</div>
									</td>
									<td class="py-3 px-2 text-right">
										<div class="text-sm" style="color: var(--text-tertiary);">
											{formatDate(entry.playedAt)}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				{#if leaderboardData.uniquePlayers > 20}
					<div class="mt-4 text-center">
						<p class="text-sm" style="color: var(--text-tertiary);">
							Showing top 20 of {leaderboardData.uniquePlayers} players
						</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="no-scores card p-8 text-center">
				<div class="text-4xl mb-3">🎯</div>
				<h3 class="text-lg font-semibold mb-2" style="color: var(--text-primary);">No Scores Yet</h3>
				<p style="color: var(--text-secondary);">Be the first to complete this game and claim the top spot!</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border-color);
		border-top: 3px solid #3b82f6;
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

	.stat-card {
		transition: transform 0.2s ease;
	}

	.stat-card:hover {
		transform: translateY(-2px);
	}

	.leaderboard-table table {
		border-collapse: separate;
		border-spacing: 0;
	}

	.leaderboard-table th {
		font-weight: 600;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.leaderboard-table tr:hover {
		background-color: var(--bg-tertiary);
	}

	@media (max-width: 768px) {
		.stats-summary {
			grid-template-columns: repeat(2, 1fr);
		}
		
		.leaderboard-table th:last-child,
		.leaderboard-table td:last-child {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.leaderboard-table th:nth-child(4),
		.leaderboard-table td:nth-child(4) {
			display: none;
		}
	}
</style> 