<script lang="ts">
  import type { HistoryEntry } from '$lib/types';

  let { entries = [] as HistoryEntry[] } = $props();
</script>

<section class="col-12 col-lg-6">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-secondary text-white">Activity History</div>
    <div class="card-body">
      <div id="historyLog" class="history-log border rounded p-3 bg-white" aria-live="polite">
        {#if entries.length === 0}
          <p class="text-muted mb-0">Game activity will appear here as events occur.</p>
        {:else}
          {#each entries as entry (entry.id)}
            <div class="mb-2">
              {@html entry.contentHtml}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>
