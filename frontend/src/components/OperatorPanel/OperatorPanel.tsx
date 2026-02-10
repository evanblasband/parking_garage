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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { HistoryDataPoint } from '../../context/GarageContext';
import type { PriceResult } from '../../types';

// ── Constants ────────────────────────────────────────────────────────

// Demand forecast curve (from backend settings)
const DEMAND_FORECAST_DATA = [
  { hour: 6, demand: 0.05, label: '6AM' },
  { hour: 7, demand: 0.08, label: '7AM' },
  { hour: 8, demand: 0.10, label: '8AM' },
  { hour: 9, demand: 0.12, label: '9AM' },
  { hour: 10, demand: 0.15, label: '10AM' },
  { hour: 11, demand: 0.20, label: '11AM' },
  { hour: 12, demand: 0.25, label: '12PM' },
  { hour: 13, demand: 0.30, label: '1PM' },
  { hour: 14, demand: 0.40, label: '2PM' },
  { hour: 15, demand: 0.50, label: '3PM' },
  { hour: 16, demand: 0.60, label: '4PM' },
  { hour: 17, demand: 0.75, label: '5PM' },
  { hour: 18, demand: 0.90, label: '6PM' },
  { hour: 19, demand: 1.00, label: '7PM' },
  { hour: 20, demand: 0.70, label: '8PM' },
  { hour: 21, demand: 0.40, label: '9PM' },
  { hour: 22, demand: 0.20, label: '10PM' },
  { hour: 23, demand: 0.10, label: '11PM' },
];

// Price bins for histogram ($5 increments)
const PRICE_BINS = [
  { min: 5, max: 10, label: '$5-10' },
  { min: 10, max: 15, label: '$10-15' },
  { min: 15, max: 20, label: '$15-20' },
  { min: 20, max: 25, label: '$20-25' },
  { min: 25, max: 30, label: '$25-30' },
  { min: 30, max: 35, label: '$30-35' },
  { min: 35, max: 40, label: '$35-40' },
  { min: 40, max: 45, label: '$40-45' },
  { min: 45, max: 50, label: '$45-50' },
];

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

/**
 * Calculate projected end-of-day revenue based on demand curve and current metrics.
 * Uses demand-curve-weighted extrapolation.
 */
function calculateProjectedRevenue(
  currentTime: number,
  currentRevenue: number,
  avgPrice: number
): number {
  // If no data yet, can't project
  if (currentTime <= 6 || avgPrice <= 0) {
    return 0;
  }

  // Sum up remaining demand from current time to 11 PM
  const currentHour = Math.floor(currentTime);
  let remainingDemandSum = 0;
  let pastDemandSum = 0;

  for (const point of DEMAND_FORECAST_DATA) {
    if (point.hour < currentHour) {
      pastDemandSum += point.demand;
    } else if (point.hour >= currentHour) {
      remainingDemandSum += point.demand;
    }
  }

  // If we've passed all demand, just return current revenue
  if (remainingDemandSum === 0 || pastDemandSum === 0) {
    return currentRevenue;
  }

  // Extrapolate: current revenue scaled by remaining demand ratio
  const demandRatio = remainingDemandSum / pastDemandSum;
  const projectedAdditional = currentRevenue * demandRatio;

  return currentRevenue + projectedAdditional;
}

function computePriceDistribution(prices: Record<string, PriceResult>): { label: string; count: number; color: string }[] {
  const priceValues = Object.values(prices).map(p => p.final_price);

  return PRICE_BINS.map((bin, index) => {
    const count = priceValues.filter(p => p >= bin.min && p < bin.max).length;
    // Color gradient from green (low prices) to red (high prices)
    const hue = 120 - (index / (PRICE_BINS.length - 1)) * 120; // 120 (green) to 0 (red)
    return {
      label: bin.label,
      count,
      color: `hsl(${hue}, 70%, 50%)`,
    };
  });
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

interface PriceHistogramProps {
  prices: Record<string, PriceResult>;
}

function PriceHistogram({ prices }: PriceHistogramProps) {
  const distribution = computePriceDistribution(prices);
  const hasData = distribution.some(d => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-16 flex items-center justify-center text-[9px] text-white/30">
        No price data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={64}>
      <BarChart data={distribution} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <XAxis dataKey="label" hide />
        <YAxis hide />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2742',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '10px',
            padding: '4px 8px',
          }}
          formatter={(value) => [`${value} spots`, 'Count']}
          labelFormatter={(label) => `Price: ${label}`}
        />
        <Bar dataKey="count" isAnimationActive={false}>
          {distribution.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface DemandCurveProps {
  currentTime: number;
}

function DemandCurve({ currentTime }: DemandCurveProps) {
  return (
    <ResponsiveContainer width="100%" height={64}>
      <LineChart data={DEMAND_FORECAST_DATA} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id="demandGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#BB2533" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#BB2533" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="hour"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8 }}
          tickFormatter={(h) => h === 6 || h === 12 || h === 19 || h === 23 ? formatTimeLabel(h) : ''}
          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
          tickLine={false}
        />
        <YAxis hide domain={[0, 1]} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2742',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '10px',
            padding: '4px 8px',
          }}
          formatter={(value) => [`${Math.round((value as number) * 100)}%`, 'Demand']}
          labelFormatter={(hour) => formatTimeLabel(hour as number)}
        />
        <ReferenceLine
          x={Math.floor(currentTime)}
          stroke="#d4b380"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <Line
          type="monotone"
          dataKey="demand"
          stroke="#BB2533"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function OperatorPanel() {
  const { state } = useGarage();
  const { garageState, metrics, historyData, prices } = state;

  if (!garageState || !metrics) {
    return (
      <div className="text-xs text-white/60">Loading...</div>
    );
  }

  const gameCountdown = getGameCountdown(garageState.current_time);
  const occupancyPercent = Math.round(metrics.occupancy_rate * 100);
  const projectedRevenue = calculateProjectedRevenue(
    garageState.current_time,
    metrics.total_revenue,
    metrics.avg_price_this_hour
  );

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
          {projectedRevenue > 0 && projectedRevenue > metrics.total_revenue && (
            <div className="text-[10px] text-white/40 mt-0.5">
              Projected: <span className="text-ussf-gold/70">{formatCurrency(projectedRevenue)}</span>
            </div>
          )}
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

        {/* Price Distribution Histogram */}
        <div className="bg-ussf-navy-light/30 rounded-lg p-2">
          <div className="text-[9px] text-white/50 uppercase tracking-wider mb-1">
            Price Distribution
          </div>
          <PriceHistogram prices={prices} />
          <div className="flex justify-between text-[8px] text-white/30 mt-1">
            <span>$5</span>
            <span>$50</span>
          </div>
        </div>

        {/* Demand Forecast Curve */}
        <div className="bg-ussf-navy-light/30 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[9px] text-white/50 uppercase tracking-wider">
              Demand Forecast
            </div>
            <div className="text-[8px] text-ussf-gold">
              Now: {formatTimeLabel(garageState.current_time)}
            </div>
          </div>
          <DemandCurve currentTime={garageState.current_time} />
        </div>
      </div>
    </div>
  );
}
