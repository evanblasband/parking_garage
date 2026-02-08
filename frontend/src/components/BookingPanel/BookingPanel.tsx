/**
 * BookingPanel Component
 *
 * Slide-out side panel that appears when a spot is selected.
 * Shows:
 * - Spot details (ID, type, zone)
 * - Locked price with countdown
 * - Price breakdown (expandable)
 * - Duration selector (1-4 hours)
 * - Total cost
 * - Book button
 * - Booking confirmation
 */

import { useState, useEffect } from 'react';
import { useGarage } from '../../context/GarageContext';
import type { SpotType } from '../../types';

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Get display name for spot type.
 */
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

/**
 * Get badge color for spot type.
 */
function getSpotTypeBadgeColor(type: SpotType): string {
  switch (type) {
    case 'EV':
      return 'bg-blue-500';
    case 'MOTORCYCLE':
      return 'bg-purple-500';
    default:
      return 'bg-green-500';
  }
}

/**
 * Get badge color for zone.
 */
function getZoneBadgeColor(zone: string): string {
  switch (zone) {
    case 'A':
      return 'bg-wc-gold text-gray-900';
    case 'B':
      return 'bg-gray-500';
    default:
      return 'bg-gray-700';
  }
}

/**
 * Format currency.
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format a pricing multiplier with color coding for visual indication.
 *
 * Multipliers > 1.0 increase the price (shown in red).
 * Multipliers < 1.0 decrease the price (shown in green).
 * Multipliers near 1.0 are neutral (shown in gray).
 *
 * @param mult - The multiplier value (e.g., 1.5 = 50% increase, 0.8 = 20% decrease)
 * @returns Object with formatted value string and Tailwind color class
 *
 * @example
 * formatMultiplier(1.5)  // { value: "1.50×", color: "text-red-400" }
 * formatMultiplier(0.8)  // { value: "0.80×", color: "text-green-400" }
 * formatMultiplier(1.0)  // { value: "1.00×", color: "text-gray-400" }
 */
function formatMultiplier(mult: number): { value: string; color: string } {
  if (mult > 1.05) {
    return { value: `${mult.toFixed(2)}×`, color: 'text-red-400' };
  } else if (mult < 0.95) {
    return { value: `${mult.toFixed(2)}×`, color: 'text-green-400' };
  }
  return { value: `${mult.toFixed(2)}×`, color: 'text-gray-400' };
}

// ── Main Component ──────────────────────────────────────────────────

export function BookingPanel() {
  const { state, send, dispatch } = useGarage();
  const { garageState, selectedSpaceId, holdInfo, lastBooking } = state;

  const [duration, setDuration] = useState(2);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  // Get selected space details
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

  // Don't render if nothing selected
  if (!selectedSpaceId && !lastBooking) {
    return null;
  }

  // Show confirmation if we just booked
  if (lastBooking) {
    return (
      <div className="fixed right-0 top-0 h-full w-96 bg-wc-dark shadow-2xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-green-400">Booking Confirmed!</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Confirmation details */}
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
              <span className="font-medium">Reservation Complete</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Spot</span>
                <span className="font-medium">{lastBooking.space_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration</span>
                <span className="font-medium">
                  {lastBooking.end_time - lastBooking.start_time} hour(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rate</span>
                <span className="font-medium">{formatCurrency(lastBooking.price_locked)}/hr</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-700">
                <span className="text-gray-400">Total</span>
                <span className="font-bold text-wc-gold text-lg">
                  {formatCurrency(lastBooking.total_cost)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
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
      <div className="fixed right-0 top-0 h-full w-96 bg-wc-dark shadow-2xl z-50">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Loading...</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-full transition-colors"
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
    <div className="fixed right-0 top-0 h-full w-96 bg-wc-dark shadow-2xl z-50 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">{selectedSpace.id}</h2>
            <div className="flex gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getSpotTypeBadgeColor(selectedSpace.type)}`}>
                {getSpotTypeName(selectedSpace.type)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getZoneBadgeColor(selectedSpace.zone)}`}>
                Zone {selectedSpace.zone}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Price display */}
        <div className="bg-wc-blue/50 rounded-lg p-4 mb-4">
          <div className="flex items-baseline justify-between">
            <span className="text-4xl font-bold text-wc-gold">
              {formatCurrency(priceResult.final_price)}
            </span>
            <span className="text-gray-400">/hour</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span className="text-sm text-yellow-400">
              Price locked for {remainingSeconds}s
            </span>
          </div>
        </div>

        {/* Price breakdown toggle */}
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="w-full flex items-center justify-between py-2 px-3 bg-gray-800 hover:bg-gray-700 rounded-lg mb-4 transition-colors"
        >
          <span className="text-sm text-gray-400">Price breakdown</span>
          <svg
            className={`w-4 h-4 transition-transform ${showBreakdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Price breakdown details */}
        {showBreakdown && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Base price ({selectedSpace.type})</span>
              <span>{formatCurrency(priceResult.base_price)}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="text-xs text-gray-500 mb-2">MULTIPLIERS</div>
              {[
                { label: 'Occupancy', value: priceResult.occupancy_multiplier },
                { label: 'Time of day', value: priceResult.time_multiplier },
                { label: 'Demand', value: priceResult.demand_multiplier },
                { label: 'Location', value: priceResult.location_multiplier },
                { label: 'Event (World Cup)', value: priceResult.event_multiplier },
              ].map(({ label, value }) => {
                const formatted = formatMultiplier(value);
                return (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-400">{label}</span>
                    <span className={formatted.color}>{formatted.value}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Context price</span>
                <span>{formatCurrency(priceResult.context_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Elasticity ({priceResult.elasticity.toFixed(2)})</span>
                <span className={formatMultiplier(priceResult.elasticity_adjustment).color}>
                  {formatMultiplier(priceResult.elasticity_adjustment).value}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 italic mt-2">
              {priceResult.optimization_note}
            </div>
          </div>
        )}

        {/* Duration selector */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Duration</label>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((hrs) => (
              <button
                key={hrs}
                onClick={() => setDuration(hrs)}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  duration === hrs
                    ? 'bg-wc-gold text-gray-900'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {hrs}hr
              </button>
            ))}
          </div>
        </div>

        {/* Total cost */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-baseline">
            <span className="text-gray-400">Total</span>
            <span className="text-3xl font-bold text-wc-white">
              {formatCurrency(totalCost)}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatCurrency(priceResult.final_price)} × {duration} hour{duration > 1 ? 's' : ''}
          </div>
        </div>

        {/* Book button */}
        <button
          onClick={handleBook}
          disabled={remainingSeconds <= 0}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
            remainingSeconds > 0
              ? 'bg-wc-gold text-gray-900 hover:bg-yellow-400'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {remainingSeconds > 0 ? 'Confirm Booking' : 'Hold Expired'}
        </button>

        {/* Cancel link */}
        <button
          onClick={handleClose}
          className="w-full mt-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
