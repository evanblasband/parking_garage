import pytest

from backend.config.settings import (
    DEMAND_FORECAST,
    GarageConfig,
    PricingConfig,
    ReservationStatus,
    SpotType,
)
from backend.engine.pricing import (
    PriceResult,
    _get_demand_multiplier,
    _get_elasticity,
    _get_occupancy_multiplier,
    _get_occupancy_rate,
    _get_time_multiplier,
    _interpolate,
    calculate_price,
)
from backend.models.garage import GarageState, initialize_garage
from backend.models.reservation import Reservation
from backend.models.space import Space


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_space(
    zone: str = "B",
    spot_type: SpotType = SpotType.STANDARD,
    row: int = 5,
    col: int = 5,
) -> Space:
    return Space(
        id=f"R{row}C{col}",
        type=spot_type,
        zone=zone,
        row=row,
        col=col,
        distance_to_entrance=float(row),
    )


def _make_reservation(
    space_id: str = "R0C0",
    start: float = 10.0,
    end: float = 12.0,
    status: ReservationStatus = ReservationStatus.ACTIVE,
) -> Reservation:
    return Reservation(
        id="res-1",
        space_id=space_id,
        start_time=start,
        end_time=end,
        price_locked=10.0,
        total_cost=20.0,
        status=status,
    )


def _garage_with_reservations(
    n_reserved: int, total_spaces: int = 100, current_time: float = 14.0
) -> GarageState:
    """Create a GarageState with n_reserved active reservations covering current_time."""
    state = initialize_garage()
    for i in range(n_reserved):
        state.reservations.append(
            Reservation(
                id=f"res-{i}",
                space_id=state.spaces[i].id,
                start_time=current_time - 1.0,
                end_time=current_time + 1.0,
                price_locked=10.0,
                total_cost=20.0,
                status=ReservationStatus.ACTIVE,
            )
        )
    return state


# ===========================================================================
# Interpolation tests
# ===========================================================================

class TestInterpolate:
    """Test _interpolate helper for linear interpolation between breakpoints."""

    def test_exact_breakpoint(self):
        """Returns exact output when value matches a breakpoint."""
        bp = [(0.0, 1.0), (0.5, 1.0), (1.0, 4.0)]
        assert _interpolate(0.5, bp) == 1.0

    def test_midpoint(self):
        """Interpolates linearly between two breakpoints."""
        bp = [(0.0, 1.0), (1.0, 3.0)]
        assert _interpolate(0.5, bp) == pytest.approx(2.0)

    def test_below_range(self):
        """Clamps to first output below the range."""
        bp = [(0.5, 1.0), (1.0, 4.0)]
        assert _interpolate(0.0, bp) == 1.0

    def test_above_range(self):
        """Clamps to last output above the range."""
        bp = [(0.0, 1.0), (1.0, 4.0)]
        assert _interpolate(2.0, bp) == 4.0

    def test_quarter_point(self):
        """Interpolates at 25% between two breakpoints."""
        bp = [(0.0, 0.0), (1.0, 100.0)]
        assert _interpolate(0.25, bp) == pytest.approx(25.0)


# ===========================================================================
# Occupancy rate tests
# ===========================================================================

class TestOccupancyRate:
    """Test _get_occupancy_rate calculation."""

    def test_zero_occupancy(self):
        """No reservations → 0% occupancy."""
        state = initialize_garage()
        assert _get_occupancy_rate(state, 14.0) == 0.0

    def test_partial_occupancy(self):
        """25 of 100 spaces reserved → 25%."""
        state = _garage_with_reservations(25)
        assert _get_occupancy_rate(state, 14.0) == pytest.approx(0.25)

    def test_full_occupancy(self):
        """All 100 spaces reserved → 100%."""
        state = _garage_with_reservations(100)
        assert _get_occupancy_rate(state, 14.0) == pytest.approx(1.0)

    def test_time_window_filtering(self):
        """Only reservations covering current_time are counted."""
        state = initialize_garage()
        # Reservation from 10-12, but current_time is 14 → not counted
        state.reservations.append(_make_reservation(start=10.0, end=12.0))
        assert _get_occupancy_rate(state, 14.0) == 0.0

        # Same reservation but current_time is 11 → counted
        assert _get_occupancy_rate(state, 11.0) == pytest.approx(1 / 100)


# ===========================================================================
# Occupancy multiplier tests
# ===========================================================================

class TestOccupancyMultiplier:
    """Test occupancy-based price multiplier at various occupancy levels."""

    @pytest.fixture
    def config(self):
        return PricingConfig()

    def test_zero_occupancy(self, config):
        """0% occupancy → 1.0x multiplier."""
        state = _garage_with_reservations(0)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(1.0)

    def test_fifty_percent(self, config):
        """50% occupancy → 1.0x (flat region)."""
        state = _garage_with_reservations(50)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(1.0)

    def test_sixty_percent(self, config):
        """60% occupancy → between 1.0x and 1.5x (interpolated)."""
        state = _garage_with_reservations(60)
        mult = _get_occupancy_multiplier(state, 14.0, config)
        assert 1.0 < mult < 1.5

    def test_seventy_percent(self, config):
        """70% occupancy → 1.5x."""
        state = _garage_with_reservations(70)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(1.5)

    def test_eighty_five_percent(self, config):
        """85% occupancy → 2.5x."""
        state = _garage_with_reservations(85)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(2.5)

    def test_ninety_five_percent(self, config):
        """95% occupancy → 3.5x."""
        state = _garage_with_reservations(95)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(3.5)

    def test_full_occupancy(self, config):
        """100% occupancy → 4.0x."""
        state = _garage_with_reservations(100)
        assert _get_occupancy_multiplier(state, 14.0, config) == pytest.approx(4.0)


# ===========================================================================
# Time multiplier tests
# ===========================================================================

class TestTimeMultiplier:
    """Test time-of-day multiplier relative to game time (7 PM / hour 19)."""

    @pytest.fixture
    def config(self):
        return PricingConfig()

    def test_early_morning(self, config):
        """6 AM = 13 hours before game → 0.5x."""
        assert _get_time_multiplier(6.0, 19, config) == pytest.approx(0.5)

    def test_midday(self, config):
        """11 AM = 8 hours before → 0.7x."""
        assert _get_time_multiplier(11.0, 19, config) == pytest.approx(0.7)

    def test_afternoon(self, config):
        """3 PM = 4 hours before → 1.0x."""
        assert _get_time_multiplier(15.0, 19, config) == pytest.approx(1.0)

    def test_near_game(self, config):
        """6 PM = 1 hour before → 2.0x."""
        assert _get_time_multiplier(18.0, 19, config) == pytest.approx(2.0)

    def test_game_time(self, config):
        """7 PM = game time → 2.5x."""
        assert _get_time_multiplier(19.0, 19, config) == pytest.approx(2.5)

    def test_after_game(self, config):
        """8 PM = 1 hour after → 1.5x."""
        assert _get_time_multiplier(20.0, 19, config) == pytest.approx(1.5)


# ===========================================================================
# Demand multiplier tests
# ===========================================================================

class TestDemandMultiplier:
    """Test demand forecast multiplier from the hourly curve."""

    def test_exact_hour(self):
        """Exact hour returns the forecast value."""
        assert _get_demand_multiplier(19.0) == pytest.approx(1.0)

    def test_early_morning(self):
        """6 AM → 0.05."""
        assert _get_demand_multiplier(6.0) == pytest.approx(0.05)

    def test_fractional_hour(self):
        """18.5 → halfway between 0.90 (hour 18) and 1.00 (hour 19)."""
        assert _get_demand_multiplier(18.5) == pytest.approx(0.95)

    def test_peak(self):
        """Peak at hour 19 → 1.0."""
        assert _get_demand_multiplier(19.0) == pytest.approx(1.0)


# ===========================================================================
# Location multiplier tests
# ===========================================================================

class TestLocationMultiplier:
    """Test zone-based location multiplier."""

    def test_zone_a(self):
        config = PricingConfig()
        assert config.location_multipliers["A"] == 1.3

    def test_zone_b(self):
        config = PricingConfig()
        assert config.location_multipliers["B"] == 1.0

    def test_zone_c(self):
        config = PricingConfig()
        assert config.location_multipliers["C"] == 0.8


# ===========================================================================
# Elasticity tests
# ===========================================================================

class TestElasticity:
    """Test elasticity calculation across types, zones, and timing modifiers."""

    @pytest.fixture
    def config(self):
        return PricingConfig()

    def test_standard_zone_a(self, config):
        """Standard × Zone A: 1.0 × 0.9 = 0.9 (inelastic)."""
        space = _make_space(zone="A", spot_type=SpotType.STANDARD)
        e = _get_elasticity(space, 14.0, 19, None, config)
        assert e == pytest.approx(0.9)

    def test_standard_zone_b(self, config):
        """Standard × Zone B: 1.0 × 1.0 = 1.0 (unit elastic)."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        e = _get_elasticity(space, 14.0, 19, None, config)
        assert e == pytest.approx(1.0)

    def test_standard_zone_c(self, config):
        """Standard × Zone C: 1.0 × 1.3 = 1.3 (elastic)."""
        space = _make_space(zone="C", spot_type=SpotType.STANDARD)
        e = _get_elasticity(space, 14.0, 19, None, config)
        assert e == pytest.approx(1.3)

    def test_ev_zone_a(self, config):
        """EV × Zone A: 0.7 × 0.9 = 0.63 (very inelastic)."""
        space = _make_space(zone="A", spot_type=SpotType.EV)
        e = _get_elasticity(space, 14.0, 19, None, config)
        assert e == pytest.approx(0.63)

    def test_motorcycle_zone_c(self, config):
        """Motorcycle × Zone C: 1.1 × 1.3 = 1.43 (elastic)."""
        space = _make_space(zone="C", spot_type=SpotType.MOTORCYCLE)
        e = _get_elasticity(space, 14.0, 19, None, config)
        assert e == pytest.approx(1.43)

    def test_last_minute_modifier(self, config):
        """Last-minute booking (<1hr before game) applies 0.7 modifier."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        # current_time=18.5 → 0.5 hours before game → last-minute
        e = _get_elasticity(space, 18.5, 19, booking_lead_time=0.5, config=config)
        assert e == pytest.approx(1.0 * 1.0 * 0.7)

    def test_advance_modifier(self, config):
        """Advance booking (>4hr before game) applies 1.2 modifier."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        # current_time=10.0 → 9 hours before game → advance
        e = _get_elasticity(space, 10.0, 19, booking_lead_time=9.0, config=config)
        assert e == pytest.approx(1.0 * 1.0 * 1.2)

    def test_no_timing_modifier_without_lead_time(self, config):
        """No timing modifier when booking_lead_time is None."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        # Even at last-minute time, None lead_time → no modifier
        e = _get_elasticity(space, 18.5, 19, booking_lead_time=None, config=config)
        assert e == pytest.approx(1.0)


# ===========================================================================
# Guardrail tests
# ===========================================================================

class TestGuardrails:
    """Test that final price is clamped between floor and ceiling."""

    def test_floor_hit(self):
        """Very low context price still results in at least $5."""
        # Early morning, empty garage, motorcycle Zone C → very low price
        space = _make_space(zone="C", spot_type=SpotType.MOTORCYCLE)
        state = initialize_garage()
        result = calculate_price(space, 6.0, state)
        assert result.final_price >= 5.0

    def test_ceiling_hit(self):
        """Extreme scenario: full garage + game time → capped at $50."""
        space = _make_space(zone="A", spot_type=SpotType.EV)
        state = _garage_with_reservations(100, current_time=19.0)
        result = calculate_price(space, 19.0, state)
        assert result.final_price <= 50.0

    def test_within_range(self):
        """Normal scenario price falls between floor and ceiling."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        state = _garage_with_reservations(50)
        result = calculate_price(space, 14.0, state)
        assert 5.0 <= result.final_price <= 50.0


# ===========================================================================
# Full pipeline tests
# ===========================================================================

class TestFullPipeline:
    """Test calculate_price end-to-end with various scenarios."""

    def test_returns_price_result(self):
        """calculate_price returns a PriceResult with all fields."""
        space = _make_space()
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        assert isinstance(result, PriceResult)
        assert result.base_price > 0
        assert result.context_price > 0
        assert result.final_price > 0

    def test_price_result_fields(self):
        """PriceResult contains all expected breakdown fields."""
        space = _make_space()
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        assert result.occupancy_multiplier >= 1.0
        assert result.time_multiplier > 0
        assert result.demand_multiplier > 0
        assert result.location_multiplier > 0
        assert result.event_multiplier == 2.0
        assert result.elasticity > 0
        assert result.elasticity_adjustment > 0
        assert isinstance(result.optimization_note, str)
        assert len(result.optimization_note) > 0

    def test_inelastic_scenario(self):
        """EV Zone A: inelastic → price pushed up from context price."""
        space = _make_space(zone="A", spot_type=SpotType.EV)
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        # EV Zone A: elasticity = 0.7 × 0.9 = 0.63, adjustment = 1.37
        assert result.elasticity == pytest.approx(0.63)
        assert result.elasticity_adjustment == pytest.approx(1.37)
        assert "Inelastic" in result.optimization_note

    def test_elastic_scenario(self):
        """Standard Zone C: elastic → price reduced from context price."""
        space = _make_space(zone="C", spot_type=SpotType.STANDARD)
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        # Standard Zone C: elasticity = 1.0 × 1.3 = 1.3, adjustment ≈ 0.769
        assert result.elasticity == pytest.approx(1.3)
        assert result.elasticity_adjustment == pytest.approx(1.0 / 1.3, abs=0.001)
        assert "Elastic" in result.optimization_note

    def test_unit_elastic_scenario(self):
        """Standard Zone B: unit elastic → no adjustment."""
        space = _make_space(zone="B", spot_type=SpotType.STANDARD)
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        assert result.elasticity == pytest.approx(1.0)
        assert result.elasticity_adjustment == pytest.approx(1.0)
        assert "Unit elastic" in result.optimization_note

    def test_high_occupancy_increases_price(self):
        """Higher occupancy leads to higher prices."""
        space = _make_space()
        state_low = _garage_with_reservations(0)
        state_high = _garage_with_reservations(90)
        price_low = calculate_price(space, 14.0, state_low).final_price
        price_high = calculate_price(space, 14.0, state_high).final_price
        assert price_high > price_low


# ===========================================================================
# Edge case tests
# ===========================================================================

class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_zero_occupancy_pricing(self):
        """Empty garage still produces a valid price."""
        space = _make_space()
        state = initialize_garage()
        result = calculate_price(space, 14.0, state)
        assert result.final_price > 0
        assert result.occupancy_multiplier == 1.0

    def test_full_occupancy_pricing(self):
        """Full garage produces valid price at ceiling region."""
        space = _make_space(zone="A", spot_type=SpotType.EV)
        state = _garage_with_reservations(100, current_time=19.0)
        result = calculate_price(space, 19.0, state)
        assert result.final_price > 0
        assert result.occupancy_multiplier == pytest.approx(4.0)

    def test_none_lead_time(self):
        """None lead_time results in no timing modifier on elasticity."""
        space = _make_space()
        state = initialize_garage()
        result = calculate_price(space, 18.5, state, booking_lead_time=None)
        # Standard Zone B with no timing modifier → elasticity = 1.0
        assert result.elasticity == pytest.approx(1.0)

    def test_cancelled_reservations_not_counted(self):
        """Cancelled reservations don't count toward occupancy."""
        state = initialize_garage()
        state.reservations.append(
            _make_reservation(start=13.0, end=15.0, status=ReservationStatus.CANCELLED)
        )
        assert _get_occupancy_rate(state, 14.0) == 0.0

    def test_completed_reservations_not_counted(self):
        """Completed reservations don't count toward occupancy."""
        state = initialize_garage()
        state.reservations.append(
            _make_reservation(start=13.0, end=15.0, status=ReservationStatus.COMPLETED)
        )
        assert _get_occupancy_rate(state, 14.0) == 0.0
