/**
 * OperatorPanel Component
 *
 * Right sidebar displaying real-time metrics with sparkline charts.
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import { useGarage } from '../../context/GarageContext';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { HistoryDataPoint } from '../../context/GarageContext';

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
  if (rate >= 0.85) return 'text-ussf-red';
  if (rate >= 0.5) return 'text-amber-500';
  return 'text-emerald-500';
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

function formatTimeLabel(time: number): string {
  const hours = Math.floor(time);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}${period}`;
}

// ── Chart Components ─────────────────────────────────────────────────

interface SparklineChartProps {
  data: HistoryDataPoint[];
  dataKey: 'occupancy' | 'revenue';
  color: string;
  gradientId: string;
}

function SparklineChart({ data, dataKey, color, gradientId }: SparklineChartProps) {
  if (data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center text-[9px] text-white/30">
        Collecting data...
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis hide domain={dataKey === 'occupancy' ? [0, 100] : ['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2742',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '10px',
            padding: '4px 8px',
          }}
          labelFormatter={(value) => formatTimeLabel(value as number)}
          formatter={(value) => {
            const numValue = value as number;
            return dataKey === 'occupancy'
              ? [`${numValue}%`, 'Occupancy']
              : [`$${numValue.toLocaleString()}`, 'Revenue'];
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function OperatorPanel() {
  const { state } = useGarage();
  const { garageState, metrics, historyData } = state;

  if (!garageState || !metrics) {
    return (
      <div className="text-xs text-white/60">Loading...</div>
    );
  }

  const gameCountdown = getGameCountdown(garageState.current_time);
  const occupancyPercent = Math.round(metrics.occupancy_rate * 100);

  return (
    <div className="space-y-3">
      {/* Header with game badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white font-[var(--font-headline)]">Dashboard</h2>
        <div className="px-2 py-0.5 bg-ussf-red text-white text-[10px] font-semibold rounded">
          {gameCountdown.isPast ? 'LIVE' : `${gameCountdown.hours}h ${gameCountdown.minutes}m`}
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="bg-ussf-navy-light/50 rounded-lg p-3">
        {/* Revenue - Hero metric */}
        <div className="text-center pb-2 border-b border-white/10 mb-2">
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Revenue</div>
          <div className="text-2xl font-bold text-ussf-gold font-[var(--font-headline)]">
            {formatCurrency(metrics.total_revenue)}
          </div>
        </div>

        {/* Occupancy bar */}
        <div className="mb-2">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Occupancy</span>
            <span className={`text-sm font-bold ${getOccupancyColor(metrics.occupancy_rate)}`}>
              {occupancyPercent}%
            </span>
          </div>
          <div className="h-2 bg-ussf-navy rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                occupancyPercent >= 85 ? 'bg-ussf-red' :
                occupancyPercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-white/50 text-right mt-0.5">
            {metrics.occupancy_count} / {metrics.total_spaces}
          </div>
        </div>
      </div>

      {/* Secondary Metrics - Compact grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-ussf-navy-light/30 rounded p-2">
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Avg Price</div>
          <div className="text-base font-semibold text-white">
            {metrics.avg_price_this_hour > 0 ? formatCurrencyDetailed(metrics.avg_price_this_hour) : '—'}
          </div>
          <div className="text-[9px] text-white/40">per hour</div>
        </div>

        <div className="bg-ussf-navy-light/30 rounded p-2">
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Bookings</div>
          <div className="text-base font-semibold text-white">
            {metrics.bookings_this_hour}
          </div>
          <div className="text-[9px] text-white/40">this hour</div>
        </div>
      </div>

      {/* Price Range - Inline */}
      <div className="flex justify-between text-[10px] text-white/40 px-1">
        <span>Floor: <span className="text-white/60">$5</span></span>
        <span>Ceiling: <span className="text-white/60">$50</span></span>
      </div>

      {/* Trend Charts */}
      <div className="space-y-2">
        {/* Occupancy Trend */}
        <div className="bg-ussf-navy-light/30 rounded-lg p-2">
          <div className="text-[9px] text-white/50 uppercase tracking-wider mb-1">
            Occupancy Trend
          </div>
          <SparklineChart
            data={historyData}
            dataKey="occupancy"
            color="#10b981"
            gradientId="occupancyGradient"
          />
        </div>

        {/* Revenue Trend */}
        <div className="bg-ussf-navy-light/30 rounded-lg p-2">
          <div className="text-[9px] text-white/50 uppercase tracking-wider mb-1">
            Revenue Trend
          </div>
          <SparklineChart
            data={historyData}
            dataKey="revenue"
            color="#d4b380"
            gradientId="revenueGradient"
          />
        </div>
      </div>
    </div>
  );
}
