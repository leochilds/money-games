<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import favicon from '$lib/assets/favicon.svg';

  let { children }: { children?: Snippet } = $props();

  const bootstrapIntegrity =
    'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH';
  const bootstrapScriptIntegrity =
    'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz';

  let bodyClassApplied = false;

  onMount(() => {
    if (typeof document === 'undefined') return;

    document.body.classList.add('bg-light');
    bodyClassApplied = true;

    const existing = document.querySelector(
      'script[data-managed="bootstrap-cdn-bundle"]'
    );

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js';
      script.integrity = bootstrapScriptIntegrity;
      script.crossOrigin = 'anonymous';
      script.defer = true;
      script.dataset.managed = 'bootstrap-cdn-bundle';
      document.head.appendChild(script);
    }
  });

  onDestroy(() => {
    if (typeof document === 'undefined') return;
    if (bodyClassApplied) {
      document.body.classList.remove('bg-light');
      bodyClassApplied = false;
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    integrity={bootstrapIntegrity}
    crossorigin="anonymous"
  />
</svelte:head>

<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
  <div class="container">
    <span class="navbar-brand mb-0 h1">Money Games</span>
    <span class="navbar-text">Property Tycoon Simulator</span>
  </div>
</nav>

<main class="container my-4">{@render children?.()}</main>

<footer class="py-4 bg-dark text-white">
  <div class="container text-center">
    <small>
      Tip: Try to balance cash on hand with new investments to maximise income growth.
    </small>
  </div>
</footer>
