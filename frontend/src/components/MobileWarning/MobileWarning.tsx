/**
 * MobileWarning Component
 *
 * Full-screen overlay shown when viewport width is less than 1280px.
 * Encourages users to view on desktop for the best experience.
 */

import { useState, useEffect } from 'react';

const MIN_WIDTH = 1280;

export function MobileWarning() {
  const [isTooSmall, setIsTooSmall] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsTooSmall(window.innerWidth < MIN_WIDTH);
    };

    // Check on mount
    checkWidth();

    // Check on resize
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  if (!isTooSmall) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-wc-blue flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-wc-dark flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-wc-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-wc-white mb-3">
          Best Viewed on Desktop
        </h1>
        <p className="text-gray-400 mb-6">
          This interactive demo requires a screen width of at least {MIN_WIDTH}px
          for the optimal experience.
        </p>

        {/* Current width indicator */}
        <div className="bg-wc-dark rounded-lg p-4 text-sm">
          <div className="flex justify-between text-gray-400 mb-2">
            <span>Your screen width</span>
            <span className="text-wc-red font-medium">{window.innerWidth}px</span>
          </div>
          <div className="flex justify-between text-gray-400">
            <span>Required width</span>
            <span className="text-wc-accent font-medium">{MIN_WIDTH}px</span>
          </div>
        </div>

        {/* Suggestion */}
        <p className="text-xs text-gray-500 mt-6">
          Try rotating your device to landscape mode, or visit on a laptop/desktop computer.
        </p>
      </div>
    </div>
  );
}
