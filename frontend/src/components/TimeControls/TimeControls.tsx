/**
 * TimeControls Component
 *
 * Provides simulation time controls:
 * - Current time display (large, prominent)
 * - Time slider (6 AM - 11:59 PM)
 * - Play/Pause button
 */

import { useGarage } from '../../context/GarageContext';

// ── Helper Functions ────────────────────────────────────────────────

/**
 * Convert decimal hours to formatted time string.
 *
 * The simulation uses decimal hours for time representation.
 * This function converts to human-readable 12-hour format.
 *
 * @param decimalHours - Time as decimal hours (e.g., 14.5 = 2:30 PM, 6.0 = 6:00 AM)
 * @returns Formatted time string (e.g., "2:30 PM")
 *
 * @example
 * formatTime(6.0)   // "6:00 AM"
 * formatTime(14.5)  // "2:30 PM"
 * formatTime(19.0)  // "7:00 PM"
 * formatTime(23.75) // "11:45 PM"
 */
function formatTime(decimalHours: number): string {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Calculate time until game (7 PM).
 */
function getTimeUntilGame(currentTime: number): string {
  const gameHour = 19;
  const diff = gameHour - currentTime;

  if (diff <= 0) {
    return 'Game in progress';
  }

  const hours = Math.floor(diff);
  const minutes = Math.round((diff - hours) * 60);

  if (hours === 0) {
    return `${minutes}m until kickoff`;
  }

  return `${hours}h ${minutes}m until kickoff`;
}

// ── Main Component ──────────────────────────────────────────────────

export function TimeControls() {
  const { state, send } = useGarage();
  const { garageState } = state;

  if (!garageState) {
    return null;
  }

  const { current_time, is_playing } = garageState;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    send({ type: 'set_time', time: newTime });
  };

  const handlePlayPause = () => {
    send({ type: 'set_playing', is_playing: !is_playing });
  };

  const handleReset = () => {
    send({ type: 'reset' });
  };

  const handleSimulationToggle = () => {
    send({ type: 'set_simulation', enabled: !garageState.simulation_enabled });
  };

  const handleSpeedChange = (speed: 1 | 2 | 5 | 10) => {
    send({ type: 'set_speed', speed });
  };

  const currentSpeed = garageState.playback_speed;

  return (
    <div className="bg-wc-dark rounded-lg p-3 mb-4">
      <div className="flex items-center gap-4">
        {/* Current time display - more compact */}
        <div className="flex flex-col items-center min-w-[100px]">
          <span className="text-2xl font-bold text-wc-white tracking-tight">
            {formatTime(current_time)}
          </span>
          <span className="text-[10px] text-wc-accent">
            {getTimeUntilGame(current_time)}
          </span>
        </div>

        {/* Controls - more compact */}
        <div className="flex items-center gap-2">
          {/* Play/Pause button */}
          <button
            onClick={handlePlayPause}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              is_playing
                ? 'bg-wc-red hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-500'
            }`}
            title={is_playing ? 'Pause' : 'Play'}
          >
            {is_playing ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
            title="Reset to 6 AM"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          {/* Simulation toggle */}
          <button
            onClick={handleSimulationToggle}
            className={`px-2 py-1.5 rounded text-[10px] font-medium transition-colors ${
              garageState.simulation_enabled
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={garageState.simulation_enabled ? 'Disable auto-booking' : 'Enable auto-booking'}
          >
            {garageState.simulation_enabled ? 'Auto: ON' : 'Auto: OFF'}
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-600" />

          {/* Speed controls - compact */}
          <div className="flex items-center gap-0.5">
            {([1, 2, 5, 10] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={`px-1.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  currentSpeed === speed
                    ? 'bg-wc-red text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title={`${speed}x speed`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Time slider */}
        <div className="flex-1 flex flex-col gap-0.5">
          <input
            type="range"
            min="6"
            max="23.98"
            step="0.05"
            value={current_time}
            onChange={handleSliderChange}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, #BF0A30 0%, #BF0A30 ${
                ((current_time - 6) / (23.98 - 6)) * 100
              }%, #374151 ${((current_time - 6) / (23.98 - 6)) * 100}%, #374151 100%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>6 AM</span>
            <span>12 PM</span>
            <span>7 PM</span>
            <span>11:59 PM</span>
          </div>
        </div>
      </div>

      {/* Status indicator - more compact */}
      {is_playing && (
        <div className="mt-2 flex items-center gap-3 text-[10px]">
          <div className="flex items-center gap-1.5 text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {currentSpeed}x ({(10 / currentSpeed).toFixed(1)}s/hr)
          </div>
          {garageState.simulation_enabled && (
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Auto-booking
            </div>
          )}
        </div>
      )}
    </div>
  );
}
