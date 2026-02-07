from pydantic import BaseModel

from backend.config.settings import (
    DEMAND_FORECAST,
    GarageConfig,
    PricingConfig,
    ReservationStatus,
    SpotType,
    garage_config,
    pricing_config,
)
from backend.models.garage import GarageState
from backend.models.space import Space


class PriceResult(BaseModel):
    final_price: float
    base_price: float
    context_price: float
    occupancy_multiplier: float
    time_multiplier: float
    demand_multiplier: float
    location_multiplier: float
    event_multiplier: float
    elasticity: float
    elasticity_adjustment: float
    optimization_note: str


def calculate_price(
    space: Space,
    current_time: float,
    garage_state: GarageState,
    booking_lead_time: float | None = None,
    config: PricingConfig | None = None,
    garage_cfg: GarageConfig | None = None,
) -> PriceResult:
    """Calculate the revenue-maximizing price for a space at a given time.

    Three-layer pricing engine:
      Layer 1: Base price by spot type
      Layer 2: Context multipliers (occupancy, time, demand, location, event)
      Layer 3: Elasticity optimization (adjust price based on segment elasticity)
    """
    if config is None:
        config = pricing_config
    if garage_cfg is None:
        garage_cfg = garage_config

    # Layer 1: Base price
    base_price = config.base_prices[space.type]

    # Layer 2: Context multipliers
    occ_mult = _get_occupancy_multiplier(garage_state, current_time, config)
    time_mult = _get_time_multiplier(current_time, garage_cfg.game_hour, config)
    demand_mult = _get_demand_multiplier(current_time)
    location_mult = config.location_multipliers[space.zone]
    event_mult = config.event_multiplier

    context_price = base_price * occ_mult * time_mult * demand_mult * location_mult * event_mult

    # Layer 3: Elasticity optimization
    elasticity = _get_elasticity(space, current_time, garage_cfg.game_hour, booking_lead_time, config)

    if elasticity < 1.0:
        # Inelastic: push price UP
        elasticity_adj = 1.0 + (1.0 - elasticity)
        note = f"Inelastic segment (e={elasticity:.2f}): price pushed up {(elasticity_adj - 1) * 100:.0f}%"
    elif elasticity > 1.0:
        # Elastic: pull price DOWN for volume
        elasticity_adj = 1.0 / elasticity
        note = f"Elastic segment (e={elasticity:.2f}): price reduced {(1 - elasticity_adj) * 100:.0f}%"
    else:
        elasticity_adj = 1.0
        note = "Unit elastic (e=1.00): no adjustment"

    final_price = context_price * elasticity_adj

    # Guardrails
    final_price = max(config.price_floor, min(config.price_ceiling, final_price))

    return PriceResult(
        final_price=round(final_price, 2),
        base_price=base_price,
        context_price=round(context_price, 2),
        occupancy_multiplier=round(occ_mult, 4),
        time_multiplier=round(time_mult, 4),
        demand_multiplier=round(demand_mult, 4),
        location_multiplier=location_mult,
        event_multiplier=event_mult,
        elasticity=round(elasticity, 4),
        elasticity_adjustment=round(elasticity_adj, 4),
        optimization_note=note,
    )


def _interpolate(value: float, breakpoints: list[tuple[float, float]]) -> float:
    """Linear interpolation between sorted (input, output) breakpoint tuples.

    Clamps to first/last output at boundaries.
    Breakpoints must be sorted by input value (ascending).
    """
    if not breakpoints:
        return 1.0

    # Sort by input value to ensure ascending order
    breakpoints = sorted(breakpoints, key=lambda bp: bp[0])

    # Clamp below first breakpoint
    if value <= breakpoints[0][0]:
        return breakpoints[0][1]

    # Clamp above last breakpoint
    if value >= breakpoints[-1][0]:
        return breakpoints[-1][1]

    # Find surrounding breakpoints and interpolate
    for i in range(len(breakpoints) - 1):
        x0, y0 = breakpoints[i]
        x1, y1 = breakpoints[i + 1]
        if x0 <= value <= x1:
            t = (value - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)

    return breakpoints[-1][1]


def _get_occupancy_rate(garage_state: GarageState, current_time: float) -> float:
    """Calculate current occupancy rate based on active reservations at current_time."""
    total_spaces = len(garage_state.spaces)
    if total_spaces == 0:
        return 0.0

    occupied = sum(
        1
        for r in garage_state.reservations
        if r.status == ReservationStatus.ACTIVE
        and r.start_time <= current_time < r.end_time
    )
    return occupied / total_spaces


def _get_occupancy_multiplier(
    garage_state: GarageState, current_time: float, config: PricingConfig
) -> float:
    """Get the occupancy-based price multiplier using non-linear interpolation."""
    occ_rate = _get_occupancy_rate(garage_state, current_time)
    return _interpolate(occ_rate, config.occupancy_multipliers)


def _get_time_multiplier(
    current_time: float, game_hour: int, config: PricingConfig
) -> float:
    """Get time-of-day multiplier based on hours before/after game time.

    Breakpoints are defined as (hours_before_game, multiplier) where
    negative hours_before_game means after game start.
    """
    hours_before_game = game_hour - current_time
    return _interpolate(hours_before_game, config.time_multipliers)


def _get_demand_multiplier(current_time: float) -> float:
    """Get demand forecast multiplier by interpolating the hourly demand curve."""
    hours = sorted(DEMAND_FORECAST.keys())

    # Build breakpoints from the forecast
    breakpoints = [(float(h), DEMAND_FORECAST[h]) for h in hours]
    return _interpolate(current_time, breakpoints)


def _get_elasticity(
    space: Space,
    current_time: float,
    game_hour: int,
    booking_lead_time: float | None,
    config: PricingConfig,
) -> float:
    """Calculate the effective price elasticity for a segment.

    Combines type-based elasticity with zone modifier, then applies timing modifier
    if booking_lead_time is provided.
    """
    # Base elasticity by type
    type_elasticity = config.elasticity_by_type[space.type]

    # Zone modifier
    zone_modifier = config.elasticity_by_zone[space.zone]

    # Combined elasticity = type × zone
    elasticity = type_elasticity * zone_modifier

    # Timing modifier (only if lead time is provided)
    if booking_lead_time is not None:
        hours_before_game = game_hour - current_time
        if hours_before_game < 1.0:
            # Last-minute booking — very inelastic
            elasticity *= config.last_minute_elasticity_modifier
        elif hours_before_game > 4.0:
            # Advance booking — elastic
            elasticity *= config.advance_elasticity_modifier

    return elasticity
