from enum import Enum
from pydantic import BaseModel


class SpotType(str, Enum):
    STANDARD = "STANDARD"
    EV = "EV"
    MOTORCYCLE = "MOTORCYCLE"


class ReservationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class PricingConfig(BaseModel):
    base_prices: dict[SpotType, float] = {
        SpotType.STANDARD: 10.0,
        SpotType.EV: 15.0,
        SpotType.MOTORCYCLE: 5.0,
    }

    # Price elasticity of demand by spot type
    elasticity_by_type: dict[SpotType, float] = {
        SpotType.STANDARD: 1.0,  # Unit elastic baseline; adjusted by zone/timing
        SpotType.EV: 0.7,  # Inelastic — captive demand
        SpotType.MOTORCYCLE: 1.1,  # Slightly elastic
    }

    # Zone-based elasticity modifiers
    elasticity_by_zone: dict[str, float] = {
        "A": 0.9,  # Near entrance — inelastic (convenience premium)
        "B": 1.0,  # Middle — neutral
        "C": 1.3,  # Far — elastic (reduce price for volume)
    }

    # Timing-based elasticity modifiers
    last_minute_elasticity_modifier: float = 0.7  # <1hr before game — very inelastic
    advance_elasticity_modifier: float = 1.2  # >4hr before game — elastic

    # Event multiplier
    event_multiplier: float = 2.0  # World Cup multiplier

    # Guardrails
    price_floor: float = 5.0  # $/hr minimum
    price_ceiling: float = 50.0  # $/hr maximum

    # Occupancy multiplier breakpoints (occupancy_pct -> multiplier)
    occupancy_multipliers: list[tuple[float, float]] = [
        (0.0, 1.0),
        (0.50, 1.0),
        (0.70, 1.5),
        (0.85, 2.5),
        (0.95, 3.5),
        (1.0, 4.0),
    ]

    # Location multiplier by zone
    location_multipliers: dict[str, float] = {
        "A": 1.3,  # Premium — near entrance
        "B": 1.0,  # Standard
        "C": 0.8,  # Discount — far from entrance
    }

    # Time-of-day multipliers (hours before game -> multiplier)
    time_multipliers: list[tuple[float, float]] = [
        (13.0, 0.5),  # 13+ hours before game (early morning)
        (8.0, 0.7),   # 8+ hours before
        (4.0, 1.0),   # 4+ hours before
        (2.0, 1.5),   # 2+ hours before
        (1.0, 2.0),   # 1 hour before
        (0.0, 2.5),   # Game time
        (-1.0, 1.5),  # 1 hour after game start
        (-4.0, 0.8),  # Late — game winding down
    ]


class GarageConfig(BaseModel):
    rows: int = 10
    cols: int = 10
    game_hour: int = 19  # 7 PM
    spot_hold_seconds: int = 30
    sim_start_hour: int = 6  # 6 AM
    sim_end_hour: int = 23  # 11 PM
    sim_end_minute: int = 59


# Hourly demand forecast curve (hour -> demand factor 0.0-1.0)
# Peaks at hour 19 (7 PM game time)
DEMAND_FORECAST: dict[int, float] = {
    6: 0.05,
    7: 0.08,
    8: 0.10,
    9: 0.12,
    10: 0.15,
    11: 0.20,
    12: 0.25,
    13: 0.30,
    14: 0.40,
    15: 0.50,
    16: 0.60,
    17: 0.75,
    18: 0.90,
    19: 1.00,
    20: 0.70,
    21: 0.40,
    22: 0.20,
    23: 0.10,
}


# Default instances
pricing_config = PricingConfig()
garage_config = GarageConfig()
