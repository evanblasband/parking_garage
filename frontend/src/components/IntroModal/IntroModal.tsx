/**
 * IntroModal Component
 *
 * Welcome modal shown on first load to explain the demo.
 * Can be re-opened via the "?" button in the header.
 * Stores preference in localStorage.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-wc-dark rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl">
        {/* Header with USA flag gradient - red, white, blue */}
        <div className="bg-gradient-to-r from-wc-red via-wc-white to-wc-blue p-1">
          <div className="bg-wc-dark p-8 text-center">
            {/* Logo/Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-wc-red/20 flex items-center justify-center">
                <svg className="w-10 h-10 text-wc-accent" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-wc-white mb-2">
              FIFA World Cup 2026
            </h1>
            <h2 className="text-xl text-wc-accent font-medium mb-2">
              MetLife Stadium Parking
            </h2>
            <p className="text-gray-400 text-sm">
              Dynamic Pricing Demo
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <p className="text-gray-300 mb-6 text-center">
            Experience a revenue-maximizing variable pricing system for parking.
            Watch prices change in real-time based on demand, time, and occupancy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Feature 1 */}
            <div className="bg-wc-blue/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h3 className="font-medium mb-1">Select a Spot</h3>
              <p className="text-xs text-gray-400">
                Click any available space to see the current price
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-wc-blue/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <h3 className="font-medium mb-1">30-Second Hold</h3>
              <p className="text-xs text-gray-400">
                Price is locked when you select a spot
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-wc-blue/30 rounded-lg p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-wc-red/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-wc-red" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
                </svg>
              </div>
              <h3 className="font-medium mb-1">Watch Prices Change</h3>
              <p className="text-xs text-gray-400">
                Play the simulation to see dynamic pricing in action
              </p>
            </div>
          </div>

          {/* Pricing info */}
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-sm">
            <h4 className="font-medium text-wc-accent mb-2">How Pricing Works</h4>
            <p className="text-gray-400">
              Prices are calculated using a three-layer engine: base price by spot type,
              multipliers for occupancy/time/demand/location/event, and elasticity optimization.
              Prices range from <span className="text-wc-white">$5</span> to{' '}
              <span className="text-wc-white">$50</span> per hour.
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={handleDismiss}
            className="w-full py-4 bg-wc-red text-white rounded-lg font-bold text-lg hover:bg-red-700 transition-colors"
          >
            Start Exploring
          </button>

          <p className="text-center text-xs text-gray-500 mt-4">
            Press <kbd className="px-2 py-0.5 bg-gray-700 rounded">?</kbd> anytime to reopen this guide
          </p>
        </div>
      </div>
    </div>
  );
}
