/**
 * DaySummaryModal Component
 *
 * Modal displayed when the simulation reaches end of day (11:59 PM).
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import { useGarage } from '../../context/GarageContext';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function DaySummaryModal() {
  const { state, dispatch, send } = useGarage();
  const { dayCompleteStats } = state;

  if (!dayCompleteStats) {
    return null;
  }

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_DAY_COMPLETE' });
  };

  const handleRestart = () => {
    dispatch({ type: 'DISMISS_DAY_COMPLETE' });
    send({ type: 'reset' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-ussf-red via-white to-ussf-navy p-1">
          <div className="bg-ussf-navy p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 font-[var(--font-headline)]">
              Day Complete!
            </h1>
            <p className="text-white/60 text-sm">
              Simulation finished at 11:59 PM
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Total Revenue */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Total Revenue
              </div>
              <div className="text-2xl font-bold text-emerald-600 font-[var(--font-headline)]">
                {formatCurrency(dayCompleteStats.total_revenue)}
              </div>
            </div>

            {/* Total Bookings */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Total Bookings
              </div>
              <div className="text-2xl font-bold text-blue-600 font-[var(--font-headline)]">
                {dayCompleteStats.total_bookings}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dayCompleteStats.sim_bookings} sim / {dayCompleteStats.manual_bookings} manual
              </div>
            </div>

            {/* Peak Occupancy */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Final Occupancy
              </div>
              <div className="text-2xl font-bold text-amber-600 font-[var(--font-headline)]">
                {Math.round(dayCompleteStats.occupancy_rate * 100)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {dayCompleteStats.active_count} / {dayCompleteStats.total_spaces} spots
              </div>
            </div>

            {/* Average Price */}
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Average Price
              </div>
              <div className="text-2xl font-bold text-violet-600 font-[var(--font-headline)]">
                {formatCurrency(dayCompleteStats.avg_price)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                per hour
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleRestart}
              className="flex-1 py-3 bg-ussf-red text-white rounded-lg font-semibold hover:bg-ussf-red-dark transition-colors shadow"
            >
              Restart Simulation
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 bg-gray-200 text-ussf-navy rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
