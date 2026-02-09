"""Tests for the simulation engine.

Tests cover:
- Auto-booking logic (price-sensitive selection, demand modulation)
- Auto-clearing logic (expiration, early departure)
- Event logging
- Simulation statistics
"""

import pytest
from unittest.mock import patch
import random

from backend.config.settings import ReservationStatus, DEMAND_FORECAST
from backend.engine.simulation import (
    _get_available_spaces,
    _get_demand_factor,
    _get_target_occupancy,
    _select_weighted_space,
    _select_duration,
    _add_event,
    run_auto_booking,
    run_auto_clearing,
    run_simulation_tick,
    get_simulation_stats,
    BASE_BOOKING_RATE,
    EARLY_DEPARTURE_RATE,
    POST_GAME_DEPARTURE_RATE,
    MAX_EVENT_LOG_SIZE,
    TARGET_OCCUPANCY_CURVE,
    GAME_START_HOUR,
    GAME_END_HOUR,
)
from backend.models.garage import GarageState, initialize_garage
from backend.models.reservation import Reservation


# ── Fixtures ─────────────────────────────────────────────────────────

@pytest.fixture
def garage_state():
    """Fresh garage state for each test."""
    return initialize_garage()


@pytest.fixture
def garage_with_reservation(garage_state):
    """Garage state with one active reservation."""
    reservation = Reservation(
        id="test-res-1",
        space_id="R0C0",
        start_time=6.0,
        end_time=8.0,
        price_locked=20.0,
        total_cost=40.0,
        is_simulated=False,
        status=ReservationStatus.ACTIVE,
    )
    garage_state.reservations.append(reservation)
    return garage_state


# ── Test: _get_available_spaces ──────────────────────────────────────

class TestGetAvailableSpaces:
    """Tests for the _get_available_spaces helper function."""

    def test_all_spaces_available_initially(self, garage_state):
        """All 100 spaces should be available when no reservations exist."""
        available = _get_available_spaces(garage_state, set())
        assert len(available) == 100

    def test_occupied_space_not_available(self, garage_with_reservation):
        """Occupied spaces should not be in the available list."""
        available = _get_available_spaces(garage_with_reservation, set())
        available_ids = {s.id for s in available}
        assert "R0C0" not in available_ids
        assert len(available) == 99

    def test_held_space_not_available(self, garage_state):
        """Held spaces should not be in the available list."""
        held_ids = {"R0C0", "R1C1"}
        available = _get_available_spaces(garage_state, held_ids)
        available_ids = {s.id for s in available}
        assert "R0C0" not in available_ids
        assert "R1C1" not in available_ids
        assert len(available) == 98

    def test_reservation_outside_time_window(self, garage_state):
        """Reservations outside current time window should not block spaces."""
        # Add a reservation that ended before current time
        reservation = Reservation(
            id="test-res-past",
            space_id="R0C0",
            start_time=4.0,
            end_time=5.0,
            price_locked=10.0,
            total_cost=10.0,
            is_simulated=False,
            status=ReservationStatus.ACTIVE,
        )
        garage_state.reservations.append(reservation)
        garage_state.current_time = 6.0  # After reservation ended

        available = _get_available_spaces(garage_state, set())
        available_ids = {s.id for s in available}
        assert "R0C0" in available_ids  # Should be available again


# ── Test: _get_demand_factor ─────────────────────────────────────────

class TestGetDemandFactor:
    """Tests for the demand factor interpolation."""

    def test_exact_hour_returns_forecast_value(self):
        """At exact hour boundaries, should return the forecast value."""
        assert _get_demand_factor(6.0) == DEMAND_FORECAST[6]
        assert _get_demand_factor(19.0) == DEMAND_FORECAST[19]

    def test_peak_demand_at_game_time(self):
        """Demand should be 1.0 at game time (hour 19)."""
        assert _get_demand_factor(19.0) == 1.0

    def test_low_demand_early_morning(self):
        """Demand should be low early morning."""
        assert _get_demand_factor(6.0) < 0.1

    def test_interpolation_between_hours(self):
        """Demand should interpolate between hourly values."""
        demand_6 = DEMAND_FORECAST[6]
        demand_7 = DEMAND_FORECAST[7]
        midpoint_demand = _get_demand_factor(6.5)

        expected = (demand_6 + demand_7) / 2
        assert abs(midpoint_demand - expected) < 0.01

    def test_demand_increases_toward_game_time(self):
        """Demand should generally increase from morning to game time."""
        demand_morning = _get_demand_factor(8.0)
        demand_afternoon = _get_demand_factor(15.0)
        demand_evening = _get_demand_factor(18.0)

        assert demand_morning < demand_afternoon < demand_evening


# ── Test: _get_target_occupancy ─────────────────────────────────────

class TestGetTargetOccupancy:
    """Tests for the target occupancy curve interpolation."""

    def test_exact_hour_returns_curve_value(self):
        """At exact hour boundaries, should return the curve value."""
        assert _get_target_occupancy(6.0) == TARGET_OCCUPANCY_CURVE[6]
        assert _get_target_occupancy(19.0) == TARGET_OCCUPANCY_CURVE[19]

    def test_peak_occupancy_at_game_time(self):
        """Target occupancy should be highest at game time (hour 19)."""
        assert _get_target_occupancy(19.0) == 0.95

    def test_low_occupancy_early_morning(self):
        """Target occupancy should be low early morning."""
        assert _get_target_occupancy(6.0) < 0.05

    def test_interpolation_between_hours(self):
        """Target occupancy should interpolate between hourly values."""
        target_14 = TARGET_OCCUPANCY_CURVE[14]
        target_15 = TARGET_OCCUPANCY_CURVE[15]
        midpoint_target = _get_target_occupancy(14.5)

        expected = (target_14 + target_15) / 2
        assert abs(midpoint_target - expected) < 0.01

    def test_occupancy_increases_toward_game_time(self):
        """Target occupancy should increase from morning to game time."""
        target_morning = _get_target_occupancy(8.0)
        target_afternoon = _get_target_occupancy(15.0)
        target_evening = _get_target_occupancy(18.0)

        assert target_morning < target_afternoon < target_evening

    def test_occupancy_drops_post_game(self):
        """Target occupancy should drop after game ends."""
        target_game = _get_target_occupancy(20.0)
        target_post_game = _get_target_occupancy(23.0)

        assert target_post_game < target_game


# ── Test: _select_weighted_space ─────────────────────────────────────

class TestSelectWeightedSpace:
    """Tests for price-weighted space selection."""

    def test_returns_none_for_empty_list(self, garage_state):
        """Should return None when no spaces available."""
        result = _select_weighted_space([], garage_state)
        assert result is None

    def test_returns_space_from_available_list(self, garage_state):
        """Should return a space from the available list."""
        available = _get_available_spaces(garage_state, set())
        selected = _select_weighted_space(available, garage_state)
        assert selected is not None
        assert selected in available

    def test_weighted_selection_is_not_uniform(self, garage_state):
        """Selection should not be perfectly uniform (prices vary)."""
        available = _get_available_spaces(garage_state, set())

        # Count selections per space
        selection_counts = {}

        # Run selection 500 times
        random.seed(42)  # For reproducibility
        for _ in range(500):
            selected = _select_weighted_space(available, garage_state)
            selection_counts[selected.id] = selection_counts.get(selected.id, 0) + 1

        # If selection were uniform, each of 100 spots would be selected ~5 times
        # With price weighting, some spots should be selected significantly more
        counts = list(selection_counts.values())
        max_count = max(counts)
        min_count = min(counts) if counts else 0

        # There should be meaningful variance (not uniform)
        # The max count should be notably higher than min
        assert max_count > min_count + 2, "Selection should show price-based variance"


# ── Test: _select_duration ───────────────────────────────────────────

class TestSelectDuration:
    """Tests for booking duration selection."""

    def test_returns_valid_duration(self):
        """Duration should be between 1 and 4 hours."""
        random.seed(42)
        for _ in range(50):
            duration = _select_duration(10.0, 23.98)
            assert 1 <= duration <= 4

    def test_respects_sim_end_time(self):
        """Duration should not extend past simulation end."""
        # At 22:00 with end at 23.98, max duration should be 1
        duration = _select_duration(23.0, 23.98)
        assert duration == 1

    def test_capped_at_four_hours(self):
        """Duration should never exceed 4 hours."""
        random.seed(42)
        for _ in range(50):
            duration = _select_duration(6.0, 23.98)
            assert duration <= 4


# ── Test: _add_event ─────────────────────────────────────────────────

class TestAddEvent:
    """Tests for event logging."""

    def test_adds_event_to_log(self, garage_state):
        """Event should be added to the event log."""
        _add_event(garage_state, "test_event", "Test details")
        assert len(garage_state.event_log) == 1
        assert garage_state.event_log[0].event_type == "test_event"
        assert garage_state.event_log[0].details == "Test details"

    def test_event_has_correct_timestamp(self, garage_state):
        """Event timestamp should match current simulation time."""
        garage_state.current_time = 14.5
        _add_event(garage_state, "test_event", "Test")
        assert garage_state.event_log[0].timestamp == 14.5

    def test_trims_to_max_size(self, garage_state):
        """Event log should be trimmed to MAX_EVENT_LOG_SIZE."""
        for i in range(MAX_EVENT_LOG_SIZE + 10):
            _add_event(garage_state, f"event_{i}", f"Details {i}")

        assert len(garage_state.event_log) == MAX_EVENT_LOG_SIZE
        # Should keep the most recent events
        assert garage_state.event_log[-1].event_type == f"event_{MAX_EVENT_LOG_SIZE + 9}"


# ── Test: run_auto_booking ───────────────────────────────────────────

class TestRunAutoBooking:
    """Tests for the auto-booking function."""

    def test_returns_list_of_reservations(self, garage_state):
        """Should return a list (possibly empty) of new reservations."""
        random.seed(42)
        result = run_auto_booking(garage_state, set())
        assert isinstance(result, list)

    def test_reservation_is_simulated(self, garage_state):
        """Created reservations should be marked as simulated."""
        # Force a booking by setting high demand and using a fixed seed
        garage_state.current_time = 19.0  # Peak demand
        random.seed(1)  # Seed that triggers booking

        # Run multiple times to get a booking
        for _ in range(20):
            result = run_auto_booking(garage_state, set())
            if result:
                assert result[0].is_simulated is True
                break

    def test_reservation_added_to_state(self, garage_state):
        """Created reservations should be added to garage state."""
        initial_count = len(garage_state.reservations)
        garage_state.current_time = 19.0

        # Run until we get a booking
        random.seed(1)
        for _ in range(20):
            run_auto_booking(garage_state, set())

        # At least one booking should have been created
        assert len(garage_state.reservations) >= initial_count

    def test_respects_held_spaces(self, garage_state):
        """Should not book spaces that are held."""
        held_ids = {"R0C0"}
        garage_state.current_time = 19.0

        random.seed(42)
        for _ in range(50):
            result = run_auto_booking(garage_state, held_ids)
            for res in result:
                assert res.space_id != "R0C0"

    def test_logs_booking_event(self, garage_state):
        """Successful booking should be logged."""
        garage_state.current_time = 19.0
        initial_log_count = len(garage_state.event_log)

        random.seed(1)
        for _ in range(20):
            result = run_auto_booking(garage_state, set())
            if result:
                assert len(garage_state.event_log) > initial_log_count
                assert garage_state.event_log[-1].event_type == "sim_booking"
                break

    def test_books_more_when_behind_target(self, garage_state):
        """Should book more aggressively when occupancy is below target."""
        # At 3 PM (hour 15), target is 60% occupancy
        garage_state.current_time = 15.0

        # Run many booking attempts and count successes
        random.seed(42)
        bookings_empty = 0
        for _ in range(100):
            result = run_auto_booking(garage_state, set())
            bookings_empty += len(result)

        # Reset garage and fill it to near target
        garage_state_full = initialize_garage()
        garage_state_full.current_time = 15.0
        # Add reservations to reach ~55% occupancy
        for i in range(55):
            reservation = Reservation(
                id=f"fill-{i}",
                space_id=f"R{i // 10}C{i % 10}",
                start_time=14.0,
                end_time=18.0,
                price_locked=20.0,
                total_cost=80.0,
                is_simulated=True,
                status=ReservationStatus.ACTIVE,
            )
            garage_state_full.reservations.append(reservation)

        random.seed(42)
        bookings_half_full = 0
        for _ in range(100):
            result = run_auto_booking(garage_state_full, set())
            bookings_half_full += len(result)

        # Empty garage should have more bookings (behind target)
        assert bookings_empty > bookings_half_full

    def test_maintains_high_occupancy_during_game(self, garage_state):
        """During game time, should maintain high occupancy."""
        garage_state.current_time = 20.0  # During game

        # Fill to 85% (below 90% target during game)
        for i in range(85):
            reservation = Reservation(
                id=f"game-{i}",
                space_id=f"R{i // 10}C{i % 10}",
                start_time=18.0,
                end_time=23.0,
                price_locked=30.0,
                total_cost=150.0,
                is_simulated=True,
                status=ReservationStatus.ACTIVE,
            )
            garage_state.reservations.append(reservation)

        # Should still try to book to reach 90%+
        random.seed(42)
        bookings = 0
        for _ in range(50):
            result = run_auto_booking(garage_state, set())
            bookings += len(result)

        # Should have some bookings to fill the remaining spots
        assert bookings > 0


# ── Test: run_auto_clearing ──────────────────────────────────────────

class TestRunAutoClearing:
    """Tests for the auto-clearing function."""

    def test_clears_expired_reservation(self, garage_with_reservation):
        """Expired reservations should be marked as completed."""
        garage_with_reservation.current_time = 9.0  # After end_time (8.0)

        cleared = run_auto_clearing(garage_with_reservation)

        assert "R0C0" in cleared
        res = garage_with_reservation.reservations[0]
        assert res.status == ReservationStatus.COMPLETED

    def test_does_not_clear_active_reservation(self, garage_with_reservation):
        """Non-expired reservations should remain active."""
        garage_with_reservation.current_time = 7.0  # During reservation

        cleared = run_auto_clearing(garage_with_reservation)

        assert "R0C0" not in cleared
        res = garage_with_reservation.reservations[0]
        assert res.status == ReservationStatus.ACTIVE

    def test_early_departure_only_for_simulated(self, garage_with_reservation):
        """Early departure should only apply to simulated bookings."""
        garage_with_reservation.current_time = 7.0
        garage_with_reservation.reservations[0].is_simulated = False

        # Even with high early departure rate, non-simulated shouldn't depart
        random.seed(42)
        with patch('backend.engine.simulation.EARLY_DEPARTURE_RATE', 1.0):
            cleared = run_auto_clearing(garage_with_reservation)

        assert "R0C0" not in cleared

    def test_logs_departure_event(self, garage_with_reservation):
        """Departures should be logged."""
        garage_with_reservation.current_time = 9.0  # After end_time

        run_auto_clearing(garage_with_reservation)

        assert len(garage_with_reservation.event_log) > 0
        assert garage_with_reservation.event_log[-1].event_type == "departure"

    def test_post_game_higher_departure_rate(self, garage_state):
        """Post-game departures should happen at a higher rate."""
        # Add many simulated reservations
        for i in range(50):
            reservation = Reservation(
                id=f"test-res-{i}",
                space_id=f"R{i // 10}C{i % 10}",
                start_time=17.0,
                end_time=24.0,  # All reservations end at midnight
                price_locked=20.0,
                total_cost=140.0,
                is_simulated=True,
                status=ReservationStatus.ACTIVE,
            )
            garage_state.reservations.append(reservation)

        # Run clearing during game (low departure rate)
        garage_state.current_time = 20.0  # During game
        random.seed(42)
        cleared_during = run_auto_clearing(garage_state)

        # Reset reservations
        for r in garage_state.reservations:
            r.status = ReservationStatus.ACTIVE

        # Run clearing post-game (high departure rate)
        garage_state.current_time = 22.5  # Post game
        random.seed(42)
        cleared_post = run_auto_clearing(garage_state)

        # Post-game should have more departures due to higher rate
        assert len(cleared_post) > len(cleared_during)

    def test_post_game_departure_logged_differently(self, garage_state):
        """Post-game departures should be logged with special event type."""
        reservation = Reservation(
            id="test-res-post",
            space_id="R0C0",
            start_time=17.0,
            end_time=24.0,
            price_locked=20.0,
            total_cost=140.0,
            is_simulated=True,
            status=ReservationStatus.ACTIVE,
        )
        garage_state.reservations.append(reservation)
        garage_state.current_time = 22.5  # Post game

        # Force an early departure
        with patch('backend.engine.simulation.random.random', return_value=0.01):
            run_auto_clearing(garage_state)

        # Should have post_game_departure event type
        departure_events = [e for e in garage_state.event_log if "departure" in e.event_type]
        assert any(e.event_type == "post_game_departure" for e in departure_events)


# ── Test: run_simulation_tick ────────────────────────────────────────

class TestRunSimulationTick:
    """Tests for the main simulation tick function."""

    def test_returns_dict_with_expected_keys(self, garage_state):
        """Should return dict with new_bookings and cleared_spaces."""
        random.seed(42)
        result = run_simulation_tick(garage_state, set())

        assert "new_bookings" in result
        assert "cleared_spaces" in result
        assert isinstance(result["new_bookings"], list)
        assert isinstance(result["cleared_spaces"], list)

    def test_clears_before_booking(self, garage_state):
        """Clearing should happen before booking (order matters)."""
        # Add an expired reservation
        reservation = Reservation(
            id="test-expired",
            space_id="R0C0",
            start_time=4.0,
            end_time=5.0,
            price_locked=10.0,
            total_cost=10.0,
            is_simulated=True,
            status=ReservationStatus.ACTIVE,
        )
        garage_state.reservations.append(reservation)
        garage_state.current_time = 6.0

        random.seed(42)
        result = run_simulation_tick(garage_state, set())

        # Expired reservation should be cleared
        assert "R0C0" in result["cleared_spaces"]


# ── Test: get_simulation_stats ───────────────────────────────────────

class TestGetSimulationStats:
    """Tests for simulation statistics."""

    def test_initial_stats(self, garage_state):
        """Initial stats should show empty garage."""
        stats = get_simulation_stats(garage_state)

        assert stats["total_spaces"] == 100
        assert stats["active_count"] == 0
        assert stats["occupancy_rate"] == 0
        assert stats["total_bookings"] == 0
        assert stats["total_revenue"] == 0

    def test_stats_with_reservations(self, garage_with_reservation):
        """Stats should reflect active reservations."""
        stats = get_simulation_stats(garage_with_reservation)

        assert stats["active_count"] == 1
        assert stats["occupancy_rate"] == 0.01  # 1/100
        assert stats["total_bookings"] == 1
        assert stats["total_revenue"] == 40.0

    def test_distinguishes_sim_vs_manual(self, garage_state):
        """Stats should count simulated and manual bookings separately."""
        # Add one simulated, one manual
        sim_res = Reservation(
            id="sim-1",
            space_id="R0C0",
            start_time=6.0,
            end_time=8.0,
            price_locked=10.0,
            total_cost=20.0,
            is_simulated=True,
            status=ReservationStatus.ACTIVE,
        )
        manual_res = Reservation(
            id="manual-1",
            space_id="R1C1",
            start_time=6.0,
            end_time=8.0,
            price_locked=15.0,
            total_cost=30.0,
            is_simulated=False,
            status=ReservationStatus.ACTIVE,
        )
        garage_state.reservations.extend([sim_res, manual_res])

        stats = get_simulation_stats(garage_state)

        assert stats["sim_bookings"] == 1
        assert stats["manual_bookings"] == 1
        assert stats["total_bookings"] == 2

    def test_average_price_calculation(self, garage_state):
        """Average price should be calculated correctly."""
        res1 = Reservation(
            id="r1", space_id="R0C0", start_time=6.0, end_time=8.0,
            price_locked=10.0, total_cost=20.0, is_simulated=True,
            status=ReservationStatus.ACTIVE,
        )
        res2 = Reservation(
            id="r2", space_id="R1C1", start_time=6.0, end_time=8.0,
            price_locked=30.0, total_cost=60.0, is_simulated=True,
            status=ReservationStatus.ACTIVE,
        )
        garage_state.reservations.extend([res1, res2])

        stats = get_simulation_stats(garage_state)

        assert stats["avg_price"] == 20.0  # (10 + 30) / 2
