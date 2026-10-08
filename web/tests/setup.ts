import { vi } from 'vitest'

// Unit tests never talk to Supabase, but src/api/client.ts needs a URL and key
// to construct the client when a test imports it.
if (!import.meta.env.VITE_SUPABASE_URL) vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'unit-test-anon-key')

// jsdom lacks these browser APIs, which Syncfusion components use.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList
}
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}
if (typeof window !== 'undefined') {
  // jsdom does not implement pseudo-element styles and logs every call; Syncfusion asks for them.
  const getComputedStyle = window.getComputedStyle.bind(window)
  window.getComputedStyle = (element: Element) => getComputedStyle(element)
}
