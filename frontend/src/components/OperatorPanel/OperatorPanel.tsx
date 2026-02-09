/**
 * OperatorPanel Component
 *
 * Right sidebar displaying real-time metrics:
 * - Total revenue
 * - Occupancy rate
 * - Average price this hour
 * - Bookings this hour
 * - Game countdown
 */

import { useGarage } from '../../context/GarageContext';

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Format currency for display.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage for display.
 */
function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Get color class based on occupancy level.
 */
function getOccupancyColor(rate: number): string {
  if (rate >= 0.85) return 'text-red-400';
  if (rate >= 0.5) return 'text-yellow-400';
  return 'text-green-400';
}

/**
 * Calculate time until game (7 PM).
 */
function getGameCountdown(currentTime: number): { hours: number; minutes: number; isPast: boolean } {
  const gameHour = 19;
  const diff = gameHour - currentTime;

  if (diff <= 0) {
    return { hours: 0, minutes: 0, isPast: true };
  }

  const hours = Math.floor(diff);
  const minutes = Math.round((diff - hours) * 60);

  return { hours, minutes, isPast: false };
}

// ── MetricCard Component ────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
  icon?: React.ReactNode;
}

function MetricCard({ label, value, subtitle, valueColor = 'text-wc-white', icon }: MetricCardProps) {
  return (
    <div className="bg-wc-dark/80 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function OperatorPanel() {
  const { state } = useGarage();
  const { garageState, metrics } = state;

  if (!garageState || !metrics) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-wc-accent mb-4">Operator Dashboard</h2>
        <div className="text-gray-400">Loading metrics...</div>
      </div>
    );
  }

  const gameCountdown = getGameCountdown(garageState.current_time);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-wc-accent mb-4">Operator Dashboard</h2>

      {/* Revenue */}
      <MetricCard
        label="Total Revenue"
        value={formatCurrency(metrics.total_revenue)}
        valueColor="text-green-400"
        icon={
          <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
          </svg>
        }
      />

      {/* Occupancy */}
      <MetricCard
        label="Occupancy"
        value={formatPercent(metrics.occupancy_rate)}
        subtitle={`${metrics.occupancy_count} / ${metrics.total_spaces} spots`}
        valueColor={getOccupancyColor(metrics.occupancy_rate)}
        icon={
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
          </svg>
        }
      />

      {/* Average Price */}
      <MetricCard
        label="Avg Price/Hr"
        value={metrics.avg_price_this_hour > 0 ? formatCurrency(metrics.avg_price_this_hour) : '—'}
        subtitle="This hour's bookings"
        icon={
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
          </svg>
        }
      />

      {/* Bookings This Hour */}
      <MetricCard
        label="Bookings"
        value={metrics.bookings_this_hour.toString()}
        subtitle="This hour"
        icon={
          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
          </svg>
        }
      />

      {/* Game Countdown */}
      <div className="bg-wc-red/20 border border-wc-red/40 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-wc-red uppercase tracking-wide font-medium">
            FIFA World Cup 2026
          </span>
        </div>
        <div className="text-sm font-medium">
          {gameCountdown.isPast ? (
            <span className="text-wc-accent">Game in progress!</span>
          ) : (
            <>
              <span className="text-wc-white">Kickoff at </span>
              <span className="text-wc-accent">7:00 PM</span>
              <div className="text-xs text-gray-400 mt-1">
                {gameCountdown.hours}h {gameCountdown.minutes}m remaining
              </div>
            </>
          )}
        </div>
      </div>

      {/* Price Range */}
      <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-700">
        <div className="flex justify-between mb-1">
          <span>Price floor</span>
          <span className="text-wc-white">$5.00/hr</span>
        </div>
        <div className="flex justify-between">
          <span>Price ceiling</span>
          <span className="text-wc-white">$50.00/hr</span>
        </div>
      </div>
    </div>
  );
}
