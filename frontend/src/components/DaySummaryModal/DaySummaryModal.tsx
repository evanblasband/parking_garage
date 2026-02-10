/**
 * DaySummaryModal Component
 *
 * Modal displayed when the simulation reaches end of day (11:59 PM).
 * Shows final statistics and trend charts for the day.
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { useGarage, type HistoryDataPoint } from '../../context/GarageContext';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatTime(decimalHour: number): string {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

interface TrendChartProps {
  data: HistoryDataPoint[];
  dataKey: 'occupancy' | 'revenue';
  color: string;
  label: string;
  formatValue: (value: number) => string;
}

function TrendChart({ data, dataKey, color, label, formatValue }: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center text-gray-400 text-xs">
        No data available
      </div>
    );
  }

  return (
    <div className="h-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tickFormatter={(t) => formatTime(t)}
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={dataKey === 'occupancy' ? [0, 100] : ['auto', 'auto']} />
          <Tooltip
            formatter={(value) => [formatValue(value as number), label]}
            labelFormatter={(t) => formatTime(t as number)}
            contentStyle={{
              backgroundColor: '#1F2742',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'white',
            }}
          />
          <ReferenceLine x={19} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#gradient-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DaySummaryModal() {
  const { state, dispatch, send } = useGarage();
  const { dayCompleteStats, historyData } = state;

  if (!dayCompleteStats) {
    return null;
  }

  // Calculate peak occupancy from history data
  const peakOccupancy = historyData.length > 0
    ? Math.max(...historyData.map(d => d.occupancy))
    : Math.round(dayCompleteStats.occupancy_rate * 100);

  const handleDismiss = () => {
    dispatch({ type: 'DISMISS_DAY_COMPLETE' });
  };

  const handleRestart = () => {
    dispatch({ type: 'DISMISS_DAY_COMPLETE' });
    send({ type: 'reset' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-ussf-red via-white to-ussf-navy p-0.5">
          <div className="bg-ussf-navy px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white font-[var(--font-headline)]">
                Day Complete!
              </h1>
              <p className="text-white/60 text-xs">
                Simulation finished at 11:59 PM
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4">
          <div className="grid grid-cols-4 gap-2 mb-4">
            {/* Total Revenue */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                Revenue
              </div>
              <div className="text-sm font-bold text-emerald-600 font-[var(--font-headline)]">
                {formatCurrency(dayCompleteStats.total_revenue)}
              </div>
            </div>

            {/* Total Bookings */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                Bookings
              </div>
              <div className="text-sm font-bold text-blue-600 font-[var(--font-headline)]">
                {dayCompleteStats.total_bookings}
              </div>
              <div className="text-[9px] text-gray-500">
                {dayCompleteStats.sim_bookings}🤖 / {dayCompleteStats.manual_bookings}👤
              </div>
            </div>

            {/* Peak Occupancy */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                Peak Occ.
              </div>
              <div className="text-sm font-bold text-amber-600 font-[var(--font-headline)]">
                {peakOccupancy}%
              </div>
              <div className="text-[9px] text-gray-500">
                Final: {Math.round(dayCompleteStats.occupancy_rate * 100)}%
              </div>
            </div>

            {/* Average Price */}
            <div className="bg-violet-50 border border-violet-200 rounded-md p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                Avg Price
              </div>
              <div className="text-sm font-bold text-violet-600 font-[var(--font-headline)]">
                {formatCurrency(dayCompleteStats.avg_price)}
              </div>
              <div className="text-[9px] text-gray-500">
                per hour
              </div>
            </div>
          </div>

          {/* Trend Charts */}
          {historyData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {/* Occupancy Trend */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  Occupancy Trend
                </div>
                <TrendChart
                  data={historyData}
                  dataKey="occupancy"
                  color="#f59e0b"
                  label="Occupancy"
                  formatValue={(v) => `${v}%`}
                />
              </div>

              {/* Revenue Trend */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">
                  Revenue Trend
                </div>
                <TrendChart
                  data={historyData}
                  dataKey="revenue"
                  color="#10b981"
                  label="Revenue"
                  formatValue={(v) => formatCurrency(v)}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRestart}
              className="flex-1 py-2 bg-ussf-red text-white text-sm rounded-md font-semibold hover:bg-ussf-red-dark transition-colors shadow"
            >
              Restart Simulation
            </button>
            <button
              onClick={handleDismiss}
              className="flex-1 py-2 bg-gray-200 text-ussf-navy text-sm rounded-md font-semibold hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
