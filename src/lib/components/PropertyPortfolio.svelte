<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PropertyCard } from '$lib/types';

  const dispatch = createEventDispatcher<{
    manage: string;
    purchase: string;
  }>();

  let {
    title = 'Property Portfolio',
    description =
      'Purchase properties to build your rental empire. Each property generates rent at the end of every in-game month. Owned properties are highlighted below.',
    properties = [] as PropertyCard[],
    showEmptyStateMessage = true
  } = $props();

  function handleManage(propertyId: string) {
    dispatch('manage', propertyId);
  }

  function handlePurchase(propertyId: string) {
    dispatch('purchase', propertyId);
  }
</script>

<section class="col-12">
  <div class="card shadow-sm h-100">
    <div class="card-header bg-info text-white">{title}</div>
    <div class="card-body">
      <p>{description}</p>
      <div id="propertyList" class="row row-cols-1 row-cols-md-2 row-cols-xxl-3 g-3">
        {#if properties.length === 0}
          {#if showEmptyStateMessage}
            <div class="col">
              <div class="alert alert-info" role="status">
                Properties will appear here once the market data is loaded.
              </div>
            </div>
          {/if}
        {:else}
          {#each properties as property (property.id)}
            <div class="col">
              <div class={`card property-card h-100${property.owned ? ' owned' : ''}`}>
                <div class="card-body d-flex flex-column gap-2">
                  <h5 class="card-title">{property.name}</h5>
                  <p class="card-text">{property.description}</p>
                  {#if property.summaryHtml}
                    <p class="mb-2 small">
                      {@html property.summaryHtml}
                    </p>
                  {/if}
                  {#if property.featureTags?.length}
                    <ul class="list-inline small text-muted mb-2">
                      {#each property.featureTags as feature}
                        <li class="list-inline-item badge bg-light text-dark border">{feature}</li>
                      {/each}
                    </ul>
                  {/if}
                  {#if property.locationDetailsHtml}
                    <p class="small text-muted mb-2">
                      {@html property.locationDetailsHtml}
                    </p>
                  {/if}
                  {#if property.demandHtml}
                    <p class="small text-muted mb-2">
                      {@html property.demandHtml}
                    </p>
                  {/if}
                  {#if property.maintenanceLabel}
                    <div class="mb-2">
                      <p class="small text-muted mb-1">
                        <strong>Maintenance:</strong> {property.maintenanceLabel}
                      </p>
                      <div class="progress maintenance-progress">
                        <div
                          class="progress-bar"
                          role="progressbar"
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={property.maintenancePercent ?? 0}
                          style={`width: ${Math.max(Math.min(property.maintenancePercent ?? 0, 100), 0)}%`}
                        >
                          {Math.round(property.maintenancePercent ?? 0)}%
                        </div>
                      </div>
                    </div>
                  {/if}
                  {#if property.statusChips?.length}
                    <div class="d-flex flex-wrap gap-2 mb-2">
                      {#each property.statusChips as chip}
                        <span class={`badge ${chip.variant ?? 'bg-secondary'}`}>{chip.label}</span>
                      {/each}
                    </div>
                  {/if}
                  {#if property.costHtml}
                    <p class="mb-1">
                      {@html property.costHtml}
                    </p>
                  {/if}
                  {#if property.rentHtml}
                    <p class="mb-1">
                      {@html property.rentHtml}
                    </p>
                  {/if}
                  <div class="mt-auto d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      class="btn btn-primary"
                      onclick={() => handleManage(property.id)}
                      aria-label={`Manage ${property.name}`}
                    >
                      {property.manageLabel ?? 'Manage'}
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-success"
                      onclick={() => handlePurchase(property.id)}
                      disabled={property.disablePurchase}
                    >
                      Purchase
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</section>
