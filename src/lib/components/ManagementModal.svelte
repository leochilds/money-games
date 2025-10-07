<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  type BootstrapModal = {
    show: () => void;
    hide: () => void;
    dispose: () => void;
  };

  const dispatch = createEventDispatcher<{
    sectionchange: string;
    show: void;
    hide: void;
  }>();

  let {
    open = false,
    activeSection = 'overview',
    subtitle = '',
    summaryHtml = '',
    overviewHtml = '',
    leasingHtml = '',
    financingHtml = '',
    transactionsHtml = '',
    maintenanceHtml = ''
  } = $props();

  let modalElement: HTMLDivElement | null = null;
  let modalInstance: BootstrapModal | null = null;

  function handleSectionChange(section: string) {
    activeSection = section;
    dispatch('sectionchange', section);
  }

  function getButtonClass(section: string) {
    return `management-nav-link${activeSection === section ? ' active' : ''}`;
  }

  async function ensureModalInstance() {
    if (!modalElement || typeof window === 'undefined') {
      return;
    }

    if (modalInstance) {
      return;
    }

    const bootstrap = (window as unknown as { bootstrap?: { Modal?: any } }).bootstrap;

    if (bootstrap?.Modal) {
      modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement, {
        focus: true
      }) as BootstrapModal;
      modalElement.addEventListener('shown.bs.modal', handleShownEvent);
      modalElement.addEventListener('hidden.bs.modal', handleHiddenEvent);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    await ensureModalInstance();
  }

  function handleShownEvent() {
    dispatch('show');
  }

  function handleHiddenEvent() {
    dispatch('hide');
  }

  function showModal() {
    ensureModalInstance().then(() => {
      modalInstance?.show();
    });
  }

  function hideModal() {
    modalInstance?.hide();
  }

  onMount(() => {
    ensureModalInstance();
  });

  onDestroy(() => {
    if (modalElement) {
      modalElement.removeEventListener('shown.bs.modal', handleShownEvent);
      modalElement.removeEventListener('hidden.bs.modal', handleHiddenEvent);
    }
    modalInstance?.dispose();
    modalInstance = null;
  });

  $effect(() => {
    if (open) {
      showModal();
    } else {
      hideModal();
    }
  });
</script>

<div
  bind:this={modalElement}
  class="modal fade"
  id="managementModal"
  tabindex="-1"
  aria-labelledby="managementModalLabel"
  aria-modal="true"
  role="dialog"
  data-bs-focus="true"
>
  <div class="modal-dialog modal-dialog-scrollable modal-xl">
    <div class="modal-content management-modal">
      <div class="modal-header">
        <div>
          <h5 class="modal-title" id="managementModalLabel">Property management</h5>
          <p id="managementModalSubtitle" class="mb-0 small text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="modal"
          aria-label="Close management hub"
        ></button>
      </div>
      <div class="modal-body">
        <div class="management-summary" id="managementModalSummary">
          {@html summaryHtml}
        </div>
        <div class="management-layout">
          <div
            id="managementSectionNav"
            class="management-nav"
            role="tablist"
            aria-orientation="vertical"
          >
            <button
              type="button"
              class={getButtonClass('overview')}
              data-section="overview"
              id="management-tab-overview"
              aria-controls="management-panel-overview"
              aria-pressed={activeSection === 'overview'}
              onclick={() => handleSectionChange('overview')}
            >
              Overview
            </button>
            <button
              type="button"
              class={getButtonClass('leasing')}
              data-section="leasing"
              id="management-tab-leasing"
              aria-controls="management-panel-leasing"
              aria-pressed={activeSection === 'leasing'}
              onclick={() => handleSectionChange('leasing')}
            >
              Leasing
            </button>
            <button
              type="button"
              class={getButtonClass('financing')}
              data-section="financing"
              id="management-tab-financing"
              aria-controls="management-panel-financing"
              aria-pressed={activeSection === 'financing'}
              onclick={() => handleSectionChange('financing')}
            >
              Financing
            </button>
            <button
              type="button"
              class={getButtonClass('transactions')}
              data-section="transactions"
              id="management-tab-transactions"
              aria-controls="management-panel-transactions"
              aria-pressed={activeSection === 'transactions'}
              onclick={() => handleSectionChange('transactions')}
            >
              Buying &amp; Selling
            </button>
            <button
              type="button"
              class={getButtonClass('maintenance')}
              data-section="maintenance"
              id="management-tab-maintenance"
              aria-controls="management-panel-maintenance"
              aria-pressed={activeSection === 'maintenance'}
              onclick={() => handleSectionChange('maintenance')}
            >
              Maintenance
            </button>
          </div>
          <div class="management-content">
            <div
              id="management-panel-overview"
              class={`management-section${activeSection === 'overview' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-overview"
            >
              <div id="managementOverview">
                {@html overviewHtml}
              </div>
            </div>
            <div
              id="management-panel-leasing"
              class={`management-section${activeSection === 'leasing' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-leasing"
            >
              <div id="managementLeasing">
                {@html leasingHtml}
              </div>
            </div>
            <div
              id="management-panel-financing"
              class={`management-section${activeSection === 'financing' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-financing"
            >
              <div id="managementFinancing">
                {@html financingHtml}
              </div>
            </div>
            <div
              id="management-panel-transactions"
              class={`management-section${activeSection === 'transactions' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-transactions"
            >
              <div id="managementTransactions">
                {@html transactionsHtml}
              </div>
            </div>
            <div
              id="management-panel-maintenance"
              class={`management-section${activeSection === 'maintenance' ? ' active' : ''}`}
              role="tabpanel"
              aria-labelledby="management-tab-maintenance"
            >
              <div id="managementMaintenance">
                {@html maintenanceHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
          Close
        </button>
      </div>
    </div>
  </div>
</div>
