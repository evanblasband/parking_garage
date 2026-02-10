/**
 * SystemPanel Component
 *
 * Collapsible bottom drawer displaying system transparency information:
 * - Event log with rolling window of last 50 entries
 *
 * Themed with U.S. Soccer Federation 2025/2026 branding.
 */

import { useState } from 'react';
import { useGarage } from '../../context/GarageContext';
import type { EventLogEntry } from '../../types';

// ── Helper Functions ────────────────────────────────────────────────

function formatTime(decimalHour: number): string {
  const hours = Math.floor(decimalHour);
  const minutes = Math.round((decimalHour - hours) * 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getEventIcon(eventType: string): string {
  const type = eventType.toLowerCase();
  switch (type) {
    case 'booking':
      return '👤';  // Manual booking - user icon
    case 'sim_booking':
      return '🤖';  // Simulated booking - robot icon
    case 'departure':
      return '🚗';
    case 'early_departure':
      return '🏃';
    case 'post_game_departure':
      return '🚪';
    case 'price_change':
      return '💰';
    case 'hold':
      return '⏳';
    case 'release':
      return '🔓';
    default:
      return '📋';
  }
}

function getEventColor(eventType: string): string {
  const type = eventType.toLowerCase();
  switch (type) {
    case 'booking':
      return 'text-emerald-400';  // Manual booking - green
    case 'sim_booking':
      return 'text-teal-400';  // Simulated booking - teal
    case 'departure':
      return 'text-amber-400';
    case 'early_departure':
      return 'text-orange-400';
    case 'post_game_departure':
      return 'text-red-400';
    case 'price_change':
      return 'text-violet-400';
    case 'hold':
      return 'text-blue-400';
    case 'release':
      return 'text-gray-400';
    default:
      return 'text-white/60';
  }
}

// ── Sub-Components ──────────────────────────────────────────────────

type EventFilter = 'all' | 'manual' | 'sim';

interface EventLogProps {
  events: EventLogEntry[];
  filter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
}

function EventLog({ events, filter, onFilterChange }: EventLogProps) {
  // Filter events based on selection
  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    if (filter === 'manual') {
      // Manual events: booking (not sim_booking), departure from manual bookings
      return event.event_type === 'booking';
    }
    if (filter === 'sim') {
      // Simulated events
      return event.event_type === 'sim_booking' ||
             event.event_type === 'departure' ||
             event.event_type === 'early_departure' ||
             event.event_type === 'post_game_departure';
    }
    return true;
  });

  // Show last 50 events, newest first
  const recentEvents = [...filteredEvents].reverse().slice(0, 50);

  return (
    <div className="flex flex-col h-full">
      {/* Filter buttons */}
      <div className="flex gap-1 mb-2 flex-shrink-0">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            filter === 'all'
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onFilterChange('manual')}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            filter === 'manual'
              ? 'bg-emerald-500/30 text-emerald-300'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
        >
          👤 Manual Only
        </button>
        <button
          onClick={() => onFilterChange('sim')}
          className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
            filter === 'sim'
              ? 'bg-teal-500/30 text-teal-300'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
        >
          🤖 Simulation Only
        </button>
      </div>

      {/* Event list */}
      {recentEvents.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-white/30 text-sm">
          {filter === 'manual'
            ? 'No manual bookings yet. Click a spot to book.'
            : filter === 'sim'
            ? 'No simulation events. Enable Auto and press Play.'
            : 'No events yet. Start the simulation to see activity.'}
        </div>
      ) : (
        <div className="space-y-0.5 overflow-y-auto flex-1 pr-2">
          {recentEvents.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className={`flex items-start gap-2 text-xs py-1 border-b border-white/5 last:border-0 ${
                event.event_type === 'booking' ? 'bg-emerald-500/10 -mx-1 px-1 rounded' : ''
              }`}
            >
              <span className="text-sm leading-none mt-0.5">{getEventIcon(event.event_type)}</span>
              <span className="text-white/40 w-20 flex-shrink-0 font-mono text-[11px]">
                {formatTime(event.timestamp)}
              </span>
              <span className={`font-medium w-28 flex-shrink-0 ${getEventColor(event.event_type)}`}>
                {event.event_type.replace(/_/g, ' ')}
              </span>
              <span className="text-white/70 flex-1">{event.details}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────

export function SystemPanel() {
  const { state } = useGarage();
  const { garageState } = state;
  const [isExpanded, setIsExpanded] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  const eventLog = garageState?.event_log || [];
  const manualBookingCount = eventLog.filter(e => e.event_type === 'booking').length;

  return (
    <div
      className={`fixed bottom-0 left-0 right-56 bg-ussf-navy border-t border-ussf-navy-light shadow-lg transition-all duration-300 z-40 ${
        isExpanded ? 'h-56' : 'h-9'
      }`}
    >
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full h-9 px-4 flex items-center justify-between bg-ussf-navy-light/50 hover:bg-ussf-navy-light transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-white/60 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-semibold text-white">Event Log</span>
          {eventLog.length > 0 && (
            <span className="px-1.5 py-0.5 bg-ussf-navy rounded text-[10px] text-white/60">
              {eventLog.length} events
            </span>
          )}
          {manualBookingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-emerald-500/30 rounded text-[10px] text-emerald-300">
              👤 {manualBookingCount} manual
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/40">
          {isExpanded ? 'Click to collapse' : 'Click to expand'}
        </span>
      </button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="h-[calc(100%-2.25rem)] p-3 overflow-hidden">
          <EventLog events={eventLog} filter={eventFilter} onFilterChange={setEventFilter} />
        </div>
      )}
    </div>
  );
}
