'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __YOEJA_MOUNTED__?: boolean;
  }
}

export default function YoejaRoot() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.__YOEJA_MOUNTED__) {
      return;
    }
    window.__YOEJA_MOUNTED__ = true;

    // Ensure native History API is used directly by Yoeja's BrowserRouter
    // so Next.js App Router does not intercept internal SPA route transitions.
    try {
      const nativePushState = History.prototype.pushState.bind(window.history);
      const nativeReplaceState = History.prototype.replaceState.bind(window.history);
      window.history.pushState = nativePushState;
      window.history.replaceState = nativeReplaceState;
    } catch {
      // Ignore if read-only
    }

    const existingScript = document.querySelector('script[data-yoeja-entry="true"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.type = 'module';
      script.crossOrigin = 'anonymous';
      script.src = '/assets/index-CvcnnhRG.js';
      script.setAttribute('data-yoeja-entry', 'true');
      document.head.appendChild(script);
    }
  }, []);

  return <div id="root" suppressHydrationWarning />;
}
