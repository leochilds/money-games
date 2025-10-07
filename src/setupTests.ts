import '@testing-library/jest-dom/vitest';

// Provide a minimal ResizeObserver implementation for components relying on it during tests.
class ResizeObserverStub implements ResizeObserver {
  observe(): void {
    // no-op
  }
  unobserve(): void {
    // no-op
  }
  disconnect(): void {
    // no-op
  }
}

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: ResizeObserver }).ResizeObserver = ResizeObserverStub;
}
