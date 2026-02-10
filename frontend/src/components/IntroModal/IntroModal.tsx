/**
 * IntroModal Component
 *
 * Compact welcome modal shown on first load to explain the demo.
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import { useGarage } from '../../context/GarageContext';

export function IntroModal() {
  const { state, dispatch } = useGarage();

  if (!state.showIntroModal) {
    return null;
  }

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_INTRO_MODAL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
        {/* Header with USSF branding stripe - compact */}
        <div className="bg-gradient-to-r from-ussf-red via-white to-ussf-navy p-0.5">
          <div className="bg-ussf-navy px-4 py-4 text-center">
            <h1 className="text-lg font-bold text-white font-[var(--font-headline)]">
              FIFA World Cup 2026
            </h1>
            <h2 className="text-sm text-ussf-gold font-medium">
              MetLife Stadium Parking
            </h2>
          </div>
        </div>

        {/* Content - compact */}
        <div className="p-4">
          <p className="text-gray-600 mb-4 text-center text-sm">
            Experience dynamic pricing in real-time. Prices adjust based on demand, time, and occupancy.
          </p>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* Feature 1 */}
            <div className="bg-ussf-gray rounded-lg p-2 text-center border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ussf-navy text-[10px]">Select Spot</h3>
            </div>

            {/* Feature 2 */}
            <div className="bg-ussf-gray rounded-lg p-2 text-center border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-1">
                <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ussf-navy text-[10px]">30s Hold</h3>
            </div>

            {/* Feature 3 */}
            <div className="bg-ussf-gray rounded-lg p-2 text-center border border-gray-200">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-1">
                <svg className="w-4 h-4 text-ussf-red" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
                </svg>
              </div>
              <h3 className="font-semibold text-ussf-navy text-[10px]">Watch Prices</h3>
            </div>
          </div>

          {/* Pricing info - compact */}
          <div className="bg-ussf-navy/5 rounded-lg p-3 mb-3 text-xs border border-ussf-navy/10">
            <p className="text-gray-600">
              Prices calculated via three-layer engine: base price, context multipliers, and elasticity.
              Range: <span className="text-ussf-navy font-semibold">$5 - $50</span>/hr
            </p>
          </div>

          {/* Simulation hints */}
          <div className="bg-emerald-50 rounded-lg p-3 mb-4 text-xs border border-emerald-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-600 font-semibold">Simulation Mode</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 rounded text-[10px] text-emerald-700 font-medium">Sim: ON</span>
            </div>
            <p className="text-gray-600">
              Enable <span className="font-medium">Sim</span> and press <span className="font-medium">Play</span> to watch AI-driven bookings fill the garage as game time approaches.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-ussf-red text-white rounded-lg font-bold text-sm hover:bg-ussf-red-dark transition-colors shadow"
          >
            Start Exploring
          </button>

          <p className="text-center text-[10px] text-gray-400 mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">?</kbd> to reopen
          </p>
        </div>
      </div>
    </div>
  );
}
