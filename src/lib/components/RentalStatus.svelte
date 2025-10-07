<script lang="ts">
  import type { RentalItem } from '$lib/types';

  let { items = [] as RentalItem[] } = $props();
</script>

<section class="col-12 col-lg-6">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-warning">Rental Income Status</div>
    <div class="card-body income-status-body">
      <ul id="incomeStatus" class="list-group list-group-flush">
        {#if items.length === 0}
          <li class="list-group-item text-muted">Rental updates will appear here.</li>
        {:else}
          {#each items as item (item.id)}
            <li class="list-group-item">
              {@html item.contentHtml}
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
</section>
