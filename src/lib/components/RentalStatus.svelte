<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  import type { RentalItem, RentalItemAction } from '$lib/types';

  const dispatch = createEventDispatcher<{ manage: string }>();

  let { items = [] as RentalItem[] } = $props();

  function handleActionClick(item: RentalItem, action: RentalItemAction) {
    if (action.type !== 'manage') {
      return;
    }
    const propertyId = action.propertyId ?? item.propertyId;
    if (!propertyId) {
      return;
    }
    dispatch('manage', propertyId);
  }
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
            <li class="list-group-item py-3">
              <div class="d-flex flex-column gap-2">
                <div class="rental-item-content" class:with-actions={Boolean(item.actions?.length)}>
                  {@html item.contentHtml}
                </div>
                {#if item.actions?.length}
                  <div class="d-flex flex-wrap align-items-center gap-2">
                    {#each item.actions as action, index (action.type + (action.propertyId ?? '') + index)}
                      <button
                        type="button"
                        class={action.className ?? 'btn btn-primary btn-sm'}
                        aria-label={action.ariaLabel ?? action.label}
                        onclick={() => handleActionClick(item, action)}
                      >
                        {action.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        {/if}
      </ul>
    </div>
  </div>
</section>

<style>
  .rental-item-content.with-actions {
    margin-bottom: 0.25rem;
  }
</style>
