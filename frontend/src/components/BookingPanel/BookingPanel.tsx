/**
 * BookingPanel Component
 *
 * Slide-out side panel for booking a parking spot.
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import { useState, useEffect } from 'react';
import { useGarage } from '../../context/GarageContext';
import type { SpotType } from '../../types';

// ── Helper Functions ────────────────────────────────────────────────

function getSpotTypeName(type: SpotType): string {
  switch (type) {
    case 'EV':
      return 'EV Charging';
    case 'MOTORCYCLE':
      return 'Motorcycle';
    default:
      return 'Standard';
  }
}

function getSpotTypeBadgeColor(type: SpotType): string {
  switch (type) {
    case 'EV':
      return 'bg-teal-500 text-white';
    case 'MOTORCYCLE':
      return 'bg-violet-500 text-white';
    default:
      return 'bg-emerald-500 text-white';
  }
}

function getZoneBadgeColor(zone: string): string {
  switch (zone) {
    case 'A':
      return 'bg-ussf-red text-white';
    case 'B':
      return 'bg-ussf-navy text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatMultiplier(mult: number): { value: string; color: string } {
  if (mult > 1.05) {
    return { value: `${mult.toFixed(2)}×`, color: 'text-ussf-red' };
  } else if (mult < 0.95) {
    return { value: `${mult.toFixed(2)}×`, color: 'text-emerald-600' };
  }
  return { value: `${mult.toFixed(2)}×`, color: 'text-gray-500' };
}

// ── Main Component ──────────────────────────────────────────────────

export function BookingPanel() {
  const { state, send, dispatch } = useGarage();
  const { garageState, selectedSpaceId, holdInfo, lastBooking } = state;

  const [duration, setDuration] = useState(2);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  const selectedSpace = garageState?.spaces.find((s) => s.id === selectedSpaceId);

  // Update countdown timer
  useEffect(() => {
    if (!holdInfo) {
      setRemainingSeconds(30);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now() / 1000;
      const remaining = Math.max(0, Math.ceil(holdInfo.expiresAt - now));
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        dispatch({ type: 'CLEAR_HOLD' });
        dispatch({ type: 'SET_ERROR', payload: 'Hold expired. Please select the spot again.' });
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [holdInfo, dispatch]);

  // Reset duration when selecting a new spot
  useEffect(() => {
    setDuration(2);
    setShowBreakdown(false);
  }, [selectedSpaceId]);

  const handleClose = () => {
    if (selectedSpaceId) {
      send({ type: 'release_spot', space_id: selectedSpaceId });
    }
    dispatch({ type: 'SET_SELECTED_SPACE', payload: null });
    dispatch({ type: 'CLEAR_LAST_BOOKING' });
  };

  const handleBook = () => {
    if (!selectedSpaceId || !holdInfo) return;
    send({ type: 'book_spot', space_id: selectedSpaceId, duration_hours: duration });
  };

  if (!selectedSpaceId && !lastBooking) {
    return null;
  }

  // Show confirmation if we just booked
  if (lastBooking) {
    return (
      <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-emerald-600 font-[var(--font-headline)]">Booking Confirmed!</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-ussf-navy"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span className="font-semibold text-emerald-800 text-sm">Reservation Complete</span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Spot</span>
                <span className="font-medium text-ussf-navy">{lastBooking.space_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration</span>
                <span className="font-medium text-ussf-navy">
                  {lastBooking.end_time - lastBooking.start_time} hour(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Rate</span>
                <span className="font-medium text-ussf-navy">{formatCurrency(lastBooking.price_locked)}/hr</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-emerald-200">
                <span className="text-gray-600">Total</span>
                <span className="font-bold text-ussf-navy text-base">
                  {formatCurrency(lastBooking.total_cost)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full py-2 bg-ussf-navy hover:bg-ussf-navy-light text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Main booking panel
  if (!selectedSpace || !holdInfo) {
    return (
      <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-50 border-l border-gray-200">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-ussf-navy">Loading...</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-ussf-navy"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { priceResult } = holdInfo;
  const totalCost = priceResult.final_price * duration;

  return (
    <div className="fixed right-0 top-0 h-full w-72 bg-white shadow-2xl z-50 overflow-y-auto border-l border-gray-200">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-ussf-navy font-[var(--font-headline)]">{selectedSpace.id}</h2>
            <div className="flex gap-1.5 mt-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getSpotTypeBadgeColor(selectedSpace.type)}`}>
                {getSpotTypeName(selectedSpace.type)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getZoneBadgeColor(selectedSpace.zone)}`}>
                Zone {selectedSpace.zone}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-ussf-navy"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Price display */}
        <div className="bg-ussf-gray rounded-lg p-3 mb-3 border border-gray-200">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-ussf-navy font-[var(--font-headline)]">
              {formatCurrency(priceResult.final_price)}
            </span>
            <span className="text-gray-500 text-sm">/hour</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <svg className="w-3.5 h-3.5 text-ussf-gold" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-xs text-ussf-gold font-medium">
              Price locked for {remainingSeconds}s
            </span>
          </div>
        </div>

        {/* Price breakdown toggle */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between py-1.5 px-2 bg-gray-100 hover:bg-gray-200 rounded-lg mb-3 transition-colors"
        >
          <span className="text-xs text-gray-600">Price breakdown</span>
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Price breakdown details */}
        {showBreakdown && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs space-y-1.5 border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-600">Base ({selectedSpace.type})</span>
              <span className="text-ussf-navy font-medium">{formatCurrency(priceResult.base_price)}</span>
            </div>
            <div className="border-t border-gray-200 pt-1.5 mt-1.5">
              <div className="text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Multipliers</div>
              {[
                { label: 'Occupancy', value: priceResult.occupancy_multiplier },
                { label: 'Time', value: priceResult.time_multiplier },
                { label: 'Demand', value: priceResult.demand_multiplier },
                { label: 'Location', value: priceResult.location_multiplier },
                { label: 'Event', value: priceResult.event_multiplier },
              ].map(({ label, value }) => {
                const formatted = formatMultiplier(value);
                return (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-600">{label}</span>
                    <span className={formatted.color}>{formatted.value}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-200 pt-1.5 mt-1.5">
              <div className="flex justify-between">
                <span className="text-gray-600">Context</span>
                <span className="text-ussf-navy font-medium">{formatCurrency(priceResult.context_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Elasticity ({priceResult.elasticity.toFixed(2)})</span>
                <span className={formatMultiplier(priceResult.elasticity_adjustment).color}>
                  {formatMultiplier(priceResult.elasticity_adjustment).value}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-gray-500 italic mt-1.5">
              {priceResult.optimization_note}
            </div>
          </div>
        )}

        {/* Duration selector */}
        <div className="mb-3">
          <label className="block text-xs text-gray-600 mb-1.5 font-medium">Duration</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((hrs) => (
              <button
                key={hrs}
                onClick={() => setDuration(hrs)}
                className={`py-2 rounded-lg font-semibold text-sm transition-colors ${
                  duration === hrs
                    ? 'bg-ussf-red text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-ussf-navy'
                }`}
              >
                {hrs}hr
              </button>
            ))}
          </div>
        </div>

        {/* Total cost */}
        <div className="bg-ussf-navy rounded-lg p-3 mb-4">
          <div className="flex justify-between items-baseline">
            <span className="text-white/70 text-xs">Total</span>
            <span className="text-xl font-bold text-white font-[var(--font-headline)]">
              {formatCurrency(totalCost)}
            </span>
          </div>
          <div className="text-[10px] text-white/50 mt-0.5 text-right">
            {formatCurrency(priceResult.final_price)} × {duration} hour{duration > 1 ? 's' : ''}
          </div>
        </div>

        {/* Book button */}
        <button
          onClick={handleBook}
          disabled={remainingSeconds <= 0}
          className={`w-full py-2.5 rounded-lg font-bold text-sm transition-colors ${
            remainingSeconds > 0
              ? 'bg-ussf-red text-white hover:bg-ussf-red-dark'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {remainingSeconds > 0 ? 'Confirm Booking' : 'Hold Expired'}
        </button>

        {/* Cancel link */}
        <button
          onClick={handleClose}
          className="w-full mt-2 py-1.5 text-xs text-gray-500 hover:text-ussf-navy transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
