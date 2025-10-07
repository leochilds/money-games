<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  type BootstrapModal = {
    show: () => void;
    hide: () => void;
    dispose: () => void;
  };

  const dispatch = createEventDispatcher<{
    show: void;
    hide: void;
    depositselect: number;
    fixedperiodselect: number;
    termselect: number;
    paymenttypechange: boolean;
    confirm: void;
    cancel: void;
  }>();

  let {
    open = false,
    propertyName = '',
    propertySummary = '',
    depositOptionsHtml = '',
    fixedPeriodOptionsHtml = '',
    termOptionsHtml = '',
    paymentTypeOptionsHtml = '',
    paymentPreviewHtml = '',
    affordabilityNoteHtml = ''
  } = $props();

  let modalElement: HTMLDivElement | null = null;
  let modalInstance: BootstrapModal | null = null;
  let depositOptionsElement: HTMLDivElement | null = null;
  let fixedPeriodOptionsElement: HTMLDivElement | null = null;
  let termOptionsElement: HTMLDivElement | null = null;
  let paymentTypeOptionsElement: HTMLDivElement | null = null;

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

  function handleDepositClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-deposit-ratio]');
    if (!button) return;
    const ratio = Number.parseFloat(button.dataset.depositRatio ?? '');
    if (!Number.isFinite(ratio)) return;
    dispatch('depositselect', ratio);
  }

  function handleTermClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-term-years]');
    if (!button) return;
    const years = Number.parseInt(button.dataset.termYears ?? '', 10);
    if (!Number.isFinite(years)) return;
    dispatch('termselect', years);
  }

  function handleFixedPeriodClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-fixed-period-years]');
    if (!button || button.disabled) return;
    const years = Number.parseInt(button.dataset.fixedPeriodYears ?? '', 10);
    if (!Number.isFinite(years)) return;
    dispatch('fixedperiodselect', years);
  }

  function handlePaymentTypeClick(event: MouseEvent) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-interest-only]');
    if (!button) return;
    dispatch('paymenttypechange', button.dataset.interestOnly === 'true');
  }

  function handleConfirmClick(event: MouseEvent) {
    event.preventDefault();
    dispatch('confirm');
  }

  function handleCancelClick() {
    dispatch('cancel');
  }

  onMount(() => {
    ensureModalInstance();
    depositOptionsElement?.addEventListener('click', handleDepositClick);
    fixedPeriodOptionsElement?.addEventListener('click', handleFixedPeriodClick);
    termOptionsElement?.addEventListener('click', handleTermClick);
    paymentTypeOptionsElement?.addEventListener('click', handlePaymentTypeClick);
  });

  onDestroy(() => {
    if (modalElement) {
      modalElement.removeEventListener('shown.bs.modal', handleShownEvent);
      modalElement.removeEventListener('hidden.bs.modal', handleHiddenEvent);
    }
    depositOptionsElement?.removeEventListener('click', handleDepositClick);
    fixedPeriodOptionsElement?.removeEventListener('click', handleFixedPeriodClick);
    termOptionsElement?.removeEventListener('click', handleTermClick);
    paymentTypeOptionsElement?.removeEventListener('click', handlePaymentTypeClick);
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
  id="financePropertyModal"
  tabindex="-1"
  aria-labelledby="financePropertyModalLabel"
  aria-hidden="true"
>
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="financePropertyModalLabel">Finance property</h5>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="modal"
          aria-label="Close"
          onclick={handleCancelClick}
        ></button>
      </div>
      <div class="modal-body">
        <div class="mb-3">
          <h6 id="financePropertyName" class="mb-1">{propertyName}</h6>
          <p id="financePropertySummary" class="small text-muted mb-0">{propertySummary}</p>
        </div>
        <div class="mb-3">
          <h6 class="mb-2">Choose deposit</h6>
          <div
            bind:this={depositOptionsElement}
            id="financeDepositOptions"
            class="d-flex flex-wrap gap-2"
            role="group"
            aria-label="Select deposit ratio"
          >
            {@html depositOptionsHtml}
          </div>
        </div>
        <div class="mb-3">
          <h6 class="mb-2">Fixed-rate period</h6>
          <div
            bind:this={fixedPeriodOptionsElement}
            id="financeFixedPeriodOptions"
            class="d-flex flex-wrap gap-2"
            role="group"
            aria-label="Select fixed-rate period"
          >
            {@html fixedPeriodOptionsHtml}
          </div>
        </div>
        <div class="mb-3">
          <h6 class="mb-2">Total term length</h6>
          <div
            bind:this={termOptionsElement}
            id="financeTermOptions"
            class="d-flex flex-wrap gap-2"
            role="group"
            aria-label="Select mortgage term length"
          >
            {@html termOptionsHtml}
          </div>
        </div>
        <div class="mb-3">
          <h6 class="mb-2">Payment structure</h6>
          <div
            bind:this={paymentTypeOptionsElement}
            id="financePaymentTypeOptions"
            class="btn-group"
            role="group"
            aria-label="Select payment structure"
          >
            {@html paymentTypeOptionsHtml}
          </div>
        </div>
        <div class="mb-3">
          <h6 class="mb-2">Payment preview</h6>
          <div id="financePaymentPreview" class="small bg-light border rounded p-3">
            {@html paymentPreviewHtml}
          </div>
          <div id="financeAffordabilityNote" class="small mt-2">
            {@html affordabilityNoteHtml}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button
          type="button"
          class="btn btn-outline-secondary"
          data-bs-dismiss="modal"
          onclick={handleCancelClick}
        >
          Cancel
        </button>
        <button type="button" id="confirmFinanceButton" class="btn btn-primary" onclick={handleConfirmClick}>
          Confirm mortgage
        </button>
      </div>
    </div>
  </div>
</div>
