/**
 * OperatorPanel Component
 *
 * Compact right sidebar displaying real-time metrics in a dense grid layout.
 * Designed to leave room for future charts and visualizations.
 */

import { useGarage } from '../../context/GarageContext';

// ── Helper Functions ────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyDetailed(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getOccupancyColor(rate: number): string {
  if (rate >= 0.85) return 'text-red-400';
  if (rate >= 0.5) return 'text-yellow-400';
  return 'text-green-400';
}

function getGameCountdown(currentTime: number): { hours: number; minutes: number; isPast: boolean } {
  const gameHour = 19;
  const diff = gameHour - currentTime;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, isPast: true };
  }

  return {
    hours: Math.floor(diff),
    minutes: Math.round((diff - Math.floor(diff)) * 60),
    isPast: false,
  };
}

// ── Main Component ──────────────────────────────────────────────────

export function OperatorPanel() {
  const { state } = useGarage();
  const { garageState, metrics } = state;

  if (!garageState || !metrics) {
    return (
      <div className="text-xs text-gray-400">Loading...</div>
    );
  }

  const gameCountdown = getGameCountdown(garageState.current_time);
  const occupancyPercent = Math.round(metrics.occupancy_rate * 100);

  return (
    <div className="space-y-3">
      {/* Header with game badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Dashboard</h2>
        <div className="px-1.5 py-0.5 bg-wc-red/20 text-wc-red text-[10px] font-medium rounded">
          {gameCountdown.isPast ? 'LIVE' : `${gameCountdown.hours}h ${gameCountdown.minutes}m`}
        </div>
      </div>

      {/* Primary Metrics - Large display */}
      <div className="bg-wc-dark/80 rounded-lg p-3">
        {/* Revenue - Hero metric */}
        <div className="text-center pb-2 border-b border-gray-700/50 mb-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Revenue</div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(metrics.total_revenue)}
          </div>
        </div>

        {/* Occupancy bar */}
        <div className="mb-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Occupancy</span>
            <span className={`text-sm font-bold ${getOccupancyColor(metrics.occupancy_rate)}`}>
              {occupancyPercent}%
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                occupancyPercent >= 85 ? 'bg-red-500' :
                occupancyPercent >= 50 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-gray-500 text-right mt-0.5">
            {metrics.occupancy_count} / {metrics.total_spaces}
          </div>
        </div>
      </div>

      {/* Secondary Metrics - Compact grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-wc-dark/60 rounded p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Avg Price</div>
          <div className="text-base font-semibold text-wc-white">
            {metrics.avg_price_this_hour > 0 ? formatCurrencyDetailed(metrics.avg_price_this_hour) : '—'}
          </div>
          <div className="text-[9px] text-gray-500">per hour</div>
        </div>

        <div className="bg-wc-dark/60 rounded p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Bookings</div>
          <div className="text-base font-semibold text-wc-white">
            {metrics.bookings_this_hour}
          </div>
          <div className="text-[9px] text-gray-500">this hour</div>
        </div>
      </div>

      {/* Price Range - Inline */}
      <div className="flex justify-between text-[10px] text-gray-500 px-1">
        <span>Floor: <span className="text-gray-400">$5</span></span>
        <span>Ceiling: <span className="text-gray-400">$50</span></span>
      </div>

      {/* Placeholder for future charts */}
      <div className="border border-dashed border-gray-700 rounded-lg p-3 text-center">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider">Charts Coming Soon</div>
        <div className="text-[9px] text-gray-700 mt-1">Occupancy & Revenue Trends</div>
      </div>
    </div>
  );
}
