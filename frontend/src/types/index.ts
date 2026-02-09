/**
 * TypeScript interfaces matching backend Pydantic models.
 * These types ensure type safety for WebSocket communication.
 */

// ── Enums ───────────────────────────────────────────────────────────

export type SpotType = 'STANDARD' | 'EV' | 'MOTORCYCLE';
export type ReservationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

// ── Data Models ─────────────────────────────────────────────────────

/**
 * A parking space in the garage grid.
 */
export interface Space {
  id: string;                    // Format: "R{row}C{col}" e.g. "R0C5"
  type: SpotType;
  zone: 'A' | 'B' | 'C';         // A=near entrance, B=middle, C=far
  row: number;
  col: number;
  distance_to_entrance: number;
}

/**
 * A parking reservation (booking).
 */
export interface Reservation {
  id: string;                    // UUID
  space_id: string;
  start_time: number;            // Decimal hour (e.g., 14.5 = 2:30 PM)
  end_time: number;
  price_locked: number;          // $/hr at booking time
  total_cost: number;            // price_locked * duration
  is_simulated: boolean;         // False for user bookings
  status: ReservationStatus;
}

/**
 * An entry in the event log.
 */
export interface EventLogEntry {
  timestamp: number;             // Decimal hour (sim time)
  event_type: string;
  details: string;
}

/**
 * Full price breakdown from the three-layer pricing engine.
 */
export interface PriceResult {
  final_price: number;           // Guardrailed price [$5, $50]
  base_price: number;            // Layer 1: by spot type
  context_price: number;         // After Layer 2 multipliers
  occupancy_multiplier: number;
  time_multiplier: number;
  demand_multiplier: number;
  location_multiplier: number;
  event_multiplier: number;
  elasticity: number;            // Calculated segment elasticity
  elasticity_adjustment: number; // Layer 3 multiplier
  optimization_note: string;     // Human explanation
}

/**
 * The complete garage state from the server.
 */
export interface GarageState {
  current_time: number;          // Decimal hour [6.0, 23.98]
  is_playing: boolean;
  playback_speed: number;
  spaces: Space[];
  reservations: Reservation[];
  held_space_ids: Record<string, number>;  // {space_id: hold_expires_at}
  simulation_enabled: boolean;
  event_log: EventLogEntry[];
}

/**
 * Dashboard metrics computed by the server.
 */
export interface Metrics {
  total_revenue: number;
  occupancy_rate: number;        // 0.0 to 1.0
  occupancy_count: number;
  total_spaces: number;
  avg_price_this_hour: number;
  bookings_this_hour: number;
}

// ── Server -> Client Messages ───────────────────────────────────────

export interface StateSnapshot {
  type: 'state_snapshot';
  state: GarageState;
  prices: Record<string, PriceResult>;  // {space_id: PriceResult}
  metrics: Metrics;
}

export interface SpotHeld {
  type: 'spot_held';
  space_id: string;
  price_result: PriceResult;
  hold_expires_at: number;       // Wall-clock Unix timestamp
}

export interface SpotReleased {
  type: 'spot_released';
  space_id: string;
}

export interface BookingConfirmed {
  type: 'booking_confirmed';
  reservation: Reservation;
}

export interface BookingFailed {
  type: 'booking_failed';
  space_id: string;
  reason: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

/**
 * Statistics returned at the end of the simulation day.
 */
export interface SimulationStats {
  total_spaces: number;
  active_count: number;
  occupancy_rate: number;
  sim_bookings: number;
  manual_bookings: number;
  total_bookings: number;
  total_revenue: number;
  avg_price: number;
}

/**
 * Message sent when simulation reaches end of day (11:59 PM).
 */
export interface DayComplete {
  type: 'day_complete';
  stats: SimulationStats;
}

/**
 * Union type for all possible server messages.
 */
export type ServerMessage =
  | StateSnapshot
  | SpotHeld
  | SpotReleased
  | BookingConfirmed
  | BookingFailed
  | ErrorMessage
  | DayComplete;

// ── Client -> Server Messages ───────────────────────────────────────

export interface SelectSpotMessage {
  type: 'select_spot';
  space_id: string;
}

export interface ReleaseSpotMessage {
  type: 'release_spot';
  space_id: string;
}

export interface BookSpotMessage {
  type: 'book_spot';
  space_id: string;
  duration_hours: number;        // 1-4
}

export interface SetPlayingMessage {
  type: 'set_playing';
  is_playing: boolean;
}

export interface SetTimeMessage {
  type: 'set_time';
  time: number;                  // Decimal hour
}

export interface ResetMessage {
  type: 'reset';
}

export interface GetStateMessage {
  type: 'get_state';
}

export interface SetSimulationMessage {
  type: 'set_simulation';
  enabled: boolean;
}

/**
 * Union type for all client messages.
 */
export type ClientMessage =
  | SelectSpotMessage
  | ReleaseSpotMessage
  | BookSpotMessage
  | SetPlayingMessage
  | SetTimeMessage
  | ResetMessage
  | GetStateMessage
  | SetSimulationMessage;
