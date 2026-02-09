"""
Simulation Engine for Parking Garage Demo.

This module handles the automated simulation of parking garage activity:
- Auto-booking: Price-sensitive random bookings weighted by inverse price
- Auto-clearing: Expired reservations cleared, early departures handled
- Event logging: Track all simulated activity for transparency

The simulation aims to create realistic parking patterns leading up to a
World Cup game at 7 PM, with the garage reaching ~90% occupancy by game time.
"""

import random
import uuid
from typing import TYPE_CHECKING

from backend.config.settings import (
    DEMAND_FORECAST,
    ReservationStatus,
    garage_config,
    pricing_config,
)
from backend.engine.pricing import calculate_price
from backend.models.garage import EventLogEntry, GarageState
from backend.models.reservation import Reservation

if TYPE_CHECKING:
    from backend.models.space import Space


# ── Configuration ────────────────────────────────────────────────────

# Base booking rate per tick (probability at demand=1.0)
# At 500ms ticks and 0.05 sim-hours per tick, this creates ~2-4 bookings per sim-hour at peak
BASE_BOOKING_RATE = 0.15

# Early departure probability per tick for active reservations
EARLY_DEPARTURE_RATE = 0.02  # 2% per tick (~10% over 5 ticks)

# Duration weights for booking duration selection (hours -> relative weight)
DURATION_WEIGHTS = {
    1: 0.15,  # 15% chance of 1-hour booking
    2: 0.35,  # 35% chance of 2-hour booking
    3: 0.30,  # 30% chance of 3-hour booking
    4: 0.20,  # 20% chance of 4-hour booking
}

# Maximum events to keep in log
MAX_EVENT_LOG_SIZE = 50


# ── Helper Functions ─────────────────────────────────────────────────

def _get_available_spaces(
    garage_state: GarageState,
    held_space_ids: set[str],
) -> list["Space"]:
    """Get list of spaces that are currently available for booking.

    A space is available if:
    - It has no active reservation covering the current time
    - It is not currently held by any user

    Args:
        garage_state: Current garage state
        held_space_ids: Set of space IDs currently held by users

    Returns:
        List of available Space objects
    """
    current_time = garage_state.current_time
    occupied_ids = set()

    for r in garage_state.reservations:
        if (
            r.status == ReservationStatus.ACTIVE
            and r.start_time <= current_time < r.end_time
        ):
            occupied_ids.add(r.space_id)

    available = []
    for space in garage_state.spaces:
        if space.id not in occupied_ids and space.id not in held_space_ids:
            available.append(space)

    return available


def _get_demand_factor(current_time: float) -> float:
    """Get the demand factor for the current simulation time.

    Interpolates between hourly demand forecast values.

    Args:
        current_time: Current simulation time as decimal hour

    Returns:
        Demand factor between 0.0 and 1.0
    """
    hour = int(current_time)
    next_hour = hour + 1
    fraction = current_time - hour

    # Get demand values, defaulting to 0.1 for hours outside the forecast
    demand_now = DEMAND_FORECAST.get(hour, 0.1)
    demand_next = DEMAND_FORECAST.get(next_hour, 0.1)

    # Linear interpolation
    return demand_now + fraction * (demand_next - demand_now)


def _select_weighted_space(
    available_spaces: list["Space"],
    garage_state: GarageState,
) -> "Space | None":
    """Select a space weighted by inverse price (cheaper = more likely).

    Uses price-sensitive selection to simulate realistic booking behavior
    where customers prefer lower-priced spots.

    Args:
        available_spaces: List of available spaces
        garage_state: Current garage state for price calculation

    Returns:
        Selected Space or None if no spaces available
    """
    if not available_spaces:
        return None

    # Calculate prices and weights for each space
    weights = []
    for space in available_spaces:
        price_result = calculate_price(
            space=space,
            current_time=garage_state.current_time,
            garage_state=garage_state,
        )
        # Inverse price weighting: lower price = higher weight
        # Add small epsilon to avoid division by zero
        weight = 1.0 / (price_result.final_price + 0.01)
        weights.append(weight)

    # Normalize weights
    total_weight = sum(weights)
    if total_weight == 0:
        return random.choice(available_spaces)

    # Weighted random selection
    r = random.random() * total_weight
    cumulative = 0.0
    for space, weight in zip(available_spaces, weights):
        cumulative += weight
        if r <= cumulative:
            return space

    return available_spaces[-1]


def _select_duration(current_time: float, sim_end_time: float) -> int:
    """Select a booking duration weighted by configured probabilities.

    Ensures the booking doesn't extend past the simulation end time.

    Args:
        current_time: Current simulation time
        sim_end_time: Simulation end time (e.g., 23.98)

    Returns:
        Duration in hours (1-4)
    """
    # Calculate maximum possible duration
    max_duration = min(4, int(sim_end_time - current_time))
    if max_duration < 1:
        return 1

    # Filter weights to only include valid durations
    valid_weights = {d: w for d, w in DURATION_WEIGHTS.items() if d <= max_duration}

    # Weighted selection
    durations = list(valid_weights.keys())
    weights = list(valid_weights.values())
    total = sum(weights)

    r = random.random() * total
    cumulative = 0.0
    for duration, weight in zip(durations, weights):
        cumulative += weight
        if r <= cumulative:
            return duration

    return durations[-1]


def _add_event(
    garage_state: GarageState,
    event_type: str,
    details: str,
) -> None:
    """Add an event to the garage state's event log.

    Maintains a rolling window of MAX_EVENT_LOG_SIZE events.

    Args:
        garage_state: Current garage state
        event_type: Type of event (e.g., "booking", "departure", "early_departure")
        details: Human-readable description of the event
    """
    entry = EventLogEntry(
        timestamp=garage_state.current_time,
        event_type=event_type,
        details=details,
    )
    garage_state.event_log.append(entry)

    # Trim to max size
    if len(garage_state.event_log) > MAX_EVENT_LOG_SIZE:
        garage_state.event_log = garage_state.event_log[-MAX_EVENT_LOG_SIZE:]


# ── Main Simulation Functions ────────────────────────────────────────

def run_auto_booking(
    garage_state: GarageState,
    held_space_ids: set[str],
) -> list[Reservation]:
    """Generate automatic bookings based on demand and pricing.

    This function is called once per tick and may generate 0 or more bookings
    based on the current demand factor and random chance.

    Booking probability is modulated by:
    - Base booking rate
    - Current demand factor (from DEMAND_FORECAST)
    - Available space count (higher availability = more bookings possible)

    Args:
        garage_state: Current garage state (will be modified)
        held_space_ids: Set of space IDs currently held by users

    Returns:
        List of new Reservation objects created
    """
    new_reservations = []

    # Get current demand factor
    demand_factor = _get_demand_factor(garage_state.current_time)

    # Calculate booking probability for this tick
    booking_probability = BASE_BOOKING_RATE * demand_factor

    # Boost booking rate when occupancy is low to fill up faster
    available_spaces = _get_available_spaces(garage_state, held_space_ids)
    total_spaces = len(garage_state.spaces)
    availability_rate = len(available_spaces) / total_spaces if total_spaces > 0 else 0

    # If more than 50% available, increase booking rate
    if availability_rate > 0.5:
        booking_probability *= 1.5

    # Determine if we should make a booking this tick
    if random.random() > booking_probability:
        return new_reservations

    # Select a space to book
    space = _select_weighted_space(available_spaces, garage_state)
    if space is None:
        return new_reservations

    # Calculate price
    price_result = calculate_price(
        space=space,
        current_time=garage_state.current_time,
        garage_state=garage_state,
    )

    # Select duration
    sim_end = garage_config.sim_end_hour + garage_config.sim_end_minute / 60.0
    duration = _select_duration(garage_state.current_time, sim_end)

    # Create reservation
    reservation = Reservation(
        id=f"sim-{uuid.uuid4().hex[:8]}",
        space_id=space.id,
        start_time=garage_state.current_time,
        end_time=garage_state.current_time + duration,
        price_locked=price_result.final_price,
        total_cost=round(price_result.final_price * duration, 2),
        is_simulated=True,
        status=ReservationStatus.ACTIVE,
    )

    garage_state.reservations.append(reservation)
    new_reservations.append(reservation)

    # Log the event
    _add_event(
        garage_state,
        "sim_booking",
        f"Auto-booked {space.id} ({space.type.value}) for {duration}hr at ${price_result.final_price:.2f}/hr",
    )

    return new_reservations


def run_auto_clearing(garage_state: GarageState) -> list[str]:
    """Handle automatic clearing of reservations.

    This function:
    1. Marks expired reservations as COMPLETED
    2. Randomly triggers early departures (EARLY_DEPARTURE_RATE chance per tick)

    Args:
        garage_state: Current garage state (will be modified)

    Returns:
        List of space IDs that were cleared (for broadcasting updates)
    """
    cleared_space_ids = []
    current_time = garage_state.current_time

    for reservation in garage_state.reservations:
        if reservation.status != ReservationStatus.ACTIVE:
            continue

        # Check for natural expiration
        if current_time >= reservation.end_time:
            reservation.status = ReservationStatus.COMPLETED
            cleared_space_ids.append(reservation.space_id)
            _add_event(
                garage_state,
                "departure",
                f"Reservation completed for {reservation.space_id}",
            )
            continue

        # Check for early departure (only for simulated bookings)
        if reservation.is_simulated and random.random() < EARLY_DEPARTURE_RATE:
            reservation.status = ReservationStatus.COMPLETED
            cleared_space_ids.append(reservation.space_id)

            # Calculate how early they left
            remaining = reservation.end_time - current_time
            _add_event(
                garage_state,
                "early_departure",
                f"Early departure from {reservation.space_id} ({remaining:.1f}hr remaining)",
            )

    return cleared_space_ids


def run_simulation_tick(
    garage_state: GarageState,
    held_space_ids: set[str],
) -> dict:
    """Run one tick of the simulation engine.

    This is the main entry point called from the tick loop in main.py.
    It orchestrates auto-booking and auto-clearing in the correct order.

    Args:
        garage_state: Current garage state (will be modified)
        held_space_ids: Set of space IDs currently held by users

    Returns:
        Dictionary with simulation results:
        - new_bookings: List of new Reservation objects
        - cleared_spaces: List of space IDs that were cleared
    """
    # Run auto-clearing first (frees up spaces for booking)
    cleared_spaces = run_auto_clearing(garage_state)

    # Then run auto-booking
    new_bookings = run_auto_booking(garage_state, held_space_ids)

    return {
        "new_bookings": new_bookings,
        "cleared_spaces": cleared_spaces,
    }


def get_simulation_stats(garage_state: GarageState) -> dict:
    """Calculate statistics about the simulation.

    Used for end-of-day summary and monitoring.

    Args:
        garage_state: Current garage state

    Returns:
        Dictionary with simulation statistics
    """
    total_spaces = len(garage_state.spaces)
    current_time = garage_state.current_time

    # Count active reservations at current time
    active_count = sum(
        1
        for r in garage_state.reservations
        if r.status == ReservationStatus.ACTIVE
        and r.start_time <= current_time < r.end_time
    )

    # Count total bookings (simulated vs manual)
    sim_bookings = sum(1 for r in garage_state.reservations if r.is_simulated)
    manual_bookings = sum(1 for r in garage_state.reservations if not r.is_simulated)

    # Calculate total revenue
    total_revenue = sum(r.total_cost for r in garage_state.reservations)

    # Calculate average price
    if garage_state.reservations:
        avg_price = sum(r.price_locked for r in garage_state.reservations) / len(garage_state.reservations)
    else:
        avg_price = 0.0

    return {
        "total_spaces": total_spaces,
        "active_count": active_count,
        "occupancy_rate": active_count / total_spaces if total_spaces > 0 else 0,
        "sim_bookings": sim_bookings,
        "manual_bookings": manual_bookings,
        "total_bookings": sim_bookings + manual_bookings,
        "total_revenue": round(total_revenue, 2),
        "avg_price": round(avg_price, 2),
    }
